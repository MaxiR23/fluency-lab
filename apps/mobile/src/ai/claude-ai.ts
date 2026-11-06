// The key goes only in the x-api-key header of ENDPOINT. No outcome, cause or
// log carries it.
import { TUTOR_MODEL, tutorReplySchema, type TokenUsage } from "@fluency-lab/shared";

import type { AiFailure, AiOutcome, AiPort } from "@/ai/ai-port";
import type { FailureCause } from "@/auth/auth-port";
import type { KeyReadOutcome } from "@/keys/key-port";
import { DEADLINE, withinDeadline } from "@/utils/deadline";
import { providerMessages } from "@/utils/provider-messages";
import { toTutorReply } from "@/utils/tutor-reply";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2026-10-21";
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_TOKENS = 1024;

// INFO: no minLength, maxLength, minimum, maximum or minItems: the provider does not
// support them in structured outputs. Limits are applied by toTutorReply.
export const TUTOR_REPLY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "corrections", "explanation", "newWords"],
  properties: {
    reply: { type: "string" },
    corrections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["original", "corrected"],
        properties: { original: { type: "string" }, corrected: { type: "string" } },
      },
    },
    explanation: { type: "string" },
    newWords: { type: "array", items: { type: "string" } },
  },
} as const;

export type ClaudeAiConfig = {
  fetchFn: typeof fetch;
  readKey: () => Promise<KeyReadOutcome>;
  timeoutMs?: number;
};

type Fetched = { status: number; text: string | null };

const plainIdentifier = /^[A-Za-z_$][\w$]{0,63}$/;
const plainErrorType = /^[a-z_]{1,64}$/;

function fail(failure: AiFailure, cause: FailureCause, usage?: TokenUsage): AiOutcome {
  return usage === undefined ? { ok: false, failure, cause } : { ok: false, failure, cause, usage };
}

// INFO: detail is always null: a thrown message or a provider message could echo the key.
function thrownCause(thrown: unknown): FailureCause {
  const name =
    thrown instanceof Error && plainIdentifier.test(thrown.name) ? thrown.name : "unknown";
  return { name, detail: null };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    // INFO: not a swallowed failure: the caller turns it into a bad_response outcome.
    return { ok: false };
  }
}

function errorType(text: string | null): string | null {
  if (text === null) return null;
  const parsed = parseJson(text);
  if (!parsed.ok || !isRecord(parsed.value) || !isRecord(parsed.value.error)) return null;
  const type = parsed.value.error.type;
  return typeof type === "string" && plainErrorType.test(type) ? type : null;
}

function statusFailure(status: number, type: string | null): AiFailure {
  if (status === 401 || type === "authentication_error") return "invalid_key";
  if (status === 429) return "rate_limited";
  if (status === 529 || type === "overloaded_error") return "overloaded";
  if (status === 400 || status === 402 || status === 403) return "rejected";
  return "unavailable";
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function optionalCount(value: unknown): number | null {
  return value === undefined || value === null ? 0 : count(value);
}

function readUsage(value: unknown): TokenUsage | null {
  if (!isRecord(value)) return null;
  const inputTokens = count(value.input_tokens);
  const outputTokens = count(value.output_tokens);
  const cacheCreationInputTokens = optionalCount(value.cache_creation_input_tokens);
  const cacheReadInputTokens = optionalCount(value.cache_read_input_tokens);
  if (
    inputTokens === null ||
    outputTokens === null ||
    cacheCreationInputTokens === null ||
    cacheReadInputTokens === null
  ) {
    return null;
  }
  return { inputTokens, outputTokens, cacheCreationInputTokens, cacheReadInputTokens };
}

function textOf(content: unknown): string | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (isRecord(block) && block.type === "text" && typeof block.text === "string") {
      return block.text;
    }
  }
  return null;
}

const badResponse = (usage?: TokenUsage): AiOutcome =>
  fail("bad_response", { name: "BadResponse", detail: null }, usage);

function readSuccess(text: string | null): AiOutcome {
  if (text === null) return badResponse();
  const body = parseJson(text);
  if (!body.ok || !isRecord(body.value)) return badResponse();
  // INFO: from here the provider answered, so a failure still carries what was billed.
  const usage = readUsage(body.value.usage) ?? undefined;
  if (body.value.stop_reason === "refusal") {
    return fail("refused", { name: "Refusal", detail: null }, usage);
  }
  if (body.value.stop_reason === "max_tokens") return badResponse(usage);
  const replyText = textOf(body.value.content);
  if (replyText === null) return badResponse(usage);
  const reply = parseJson(replyText);
  if (!reply.ok) return badResponse(usage);
  const payload = tutorReplySchema.safeParse(reply.value);
  if (!payload.success) return badResponse(usage);
  const normalized = toTutorReply(payload.data);
  if (normalized === null || usage === undefined) return badResponse(usage);
  return { ok: true, value: { ...normalized, model: TUTOR_MODEL, usage } };
}

export function createClaudeAi(config: ClaudeAiConfig): AiPort {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return {
    async reply(request) {
      const key = await config.readKey();
      if (!key.ok) return fail("key_unreadable", { name: "KeyRead", detail: null });
      const apiKey = key.value;
      if (apiKey === null) return { ok: false, failure: "missing_key" };
      const messages = providerMessages(request.turns);
      if (messages.length === 0) return badResponse();
      const body = JSON.stringify({
        model: TUTOR_MODEL,
        max_tokens: MAX_TOKENS,
        system: request.system,
        messages,
        thinking: { type: "disabled" },
        output_config: { format: { type: "json_schema", schema: TUTOR_REPLY_JSON_SCHEMA } },
      });
      let fetched: Fetched | typeof DEADLINE;
      try {
        fetched = await withinDeadline<Fetched>(timeoutMs, async (signal) => {
          const res = await config.fetchFn(ENDPOINT, {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "anthropic-version": API_VERSION,
              "content-type": "application/json",
            },
            body,
            signal,
          });
          return { status: res.status, text: await readText(res) };
        });
      } catch (thrown) {
        return fail("network", thrownCause(thrown));
      }
      if (fetched === DEADLINE) return fail("network", { name: "Timeout", detail: null });
      if (fetched.status < 200 || fetched.status >= 300) {
        const type = errorType(fetched.text);
        return fail(statusFailure(fetched.status, type), {
          name: "HttpError",
          code: type ?? `http_${fetched.status}`,
          detail: null,
        });
      }
      return readSuccess(fetched.text);
    },
  };
}

// INFO: null means the body could not be read; the status still decides the failure.
async function readText(res: Response): Promise<string | null> {
  try {
    return await res.text();
  } catch {
    return null;
  }
}
