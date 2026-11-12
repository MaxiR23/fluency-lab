// The key goes only in the x-api-key header of ENDPOINT. No outcome, cause or
// log carries it.
import {
  NOTE_KINDS,
  PRACTICE_KINDS,
  PRACTICE_REVIEW_MODEL,
  PRACTICE_SOLVER_MODEL,
  PRACTICE_WRITER_MODEL,
  TUTOR_MODEL,
  answerGradeSchema,
  contextSummarySchema,
  practiceExercisePayloadSchema,
  practiceReviewSchema,
  practiceSolutionSchema,
  studyNotePayloadSchema,
  threadReplySchema,
  tutorReplySchema,
  type ModelId,
  type TokenUsage,
} from "@fluency-lab/shared";

import type { AiFailure, AiPort, TutorRequest } from "@/ai/ai-port";
import type { FailureCause } from "@/auth/auth-port";
import type { KeyReadOutcome } from "@/keys/key-port";
import { toContextSummary } from "@/utils/chat-context";
import { DEADLINE, withinDeadline } from "@/utils/deadline";
import { toAnswerGrade } from "@/utils/practice-grade";
import { toReview } from "@/utils/practice-check";
import { providerMessages } from "@/utils/provider-messages";
import { toChatTitle } from "@/utils/chat-title";
import { toStudyNote } from "@/utils/study-note";
import { toThreadReply } from "@/utils/thread-reply";
import { toTutorReply } from "@/utils/tutor-reply";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2026-10-21";
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_TOKENS = 1024;
// INFO: a reply with a table or a study note needs room for it; the thread keeps MAX_TOKENS.
const NOTE_MAX_TOKENS = 2048;
// INFO: a grading answer, a solver answer and a review need less room than a chat turn.
const GRADE_MAX_TOKENS = 512;

// INFO: one flat object: anyOf and type arrays count toward the union limit, and every field
// is required (the docs limit optional parameters). Arrays that do not apply are empty, and
// exactly three columns and the row limits are applied by toStudyNote.
export const STUDY_NOTE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "title", "topic", "columns", "rows", "points", "remember"],
  properties: {
    kind: { type: "string", enum: [...NOTE_KINDS] },
    title: { type: "string" },
    topic: { type: "string" },
    columns: { type: "array", items: { type: "string" } },
    rows: { type: "array", items: { type: "array", items: { type: "string" } } },
    points: { type: "array", items: { type: "string" } },
    remember: { type: "string" },
  },
} as const;

// INFO: no maxLength: the provider does not support it in structured outputs.
// SUMMARY_MAX is asked in the prompt and applied by toContextSummary.
export const CONTEXT_SUMMARY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary"],
  properties: { summary: { type: "string" } },
} as const;

// INFO: no minLength, maxLength, minimum, maximum or minItems: the provider does not
// support them in structured outputs. Limits (the 80 characters of rule included) are applied by toTutorReply.
// note and title are the only optional properties: note is filled only on request, title only
// while the chat has its default title. The 6 words and 60 characters of title are asked in the
// prompt and applied by toChatTitle.
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
        required: ["original", "corrected", "rule"],
        properties: {
          original: { type: "string" },
          corrected: { type: "string" },
          rule: { type: "string" },
        },
      },
    },
    explanation: { type: "string" },
    newWords: { type: "array", items: { type: "string" } },
    note: STUDY_NOTE_JSON_SCHEMA,
    title: { type: "string" },
  },
} as const;

// INFO: the same limits as above. withdrawn holds integers: whole numbers are applied by toThreadReply.
export const THREAD_REPLY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "newWords", "withdrawn"],
  properties: {
    reply: { type: "string" },
    newWords: { type: "array", items: { type: "string" } },
    withdrawn: { type: "array", items: { type: "integer" } },
  },
} as const;

// INFO: the same limits as above, and enum is supported on string properties. One exercise, one
// object: it carries options and source, an empty array and an empty string when they do not
// apply. The app checks the limits and the rules of each kind (toExercise).
export const PRACTICE_EXERCISE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "rule", "prompt", "options", "accepted", "explanation", "source"],
  properties: {
    kind: { type: "string", enum: [...PRACTICE_KINDS] },
    rule: { type: "string" },
    prompt: { type: "string" },
    options: { type: "array", items: { type: "string" } },
    accepted: { type: "array", items: { type: "string" } },
    explanation: { type: "string" },
    source: { type: "string" },
  },
} as const;

// INFO: the blind solver's answer; alreadyCorrect is for fix only. An empty answer is allowed.
export const PRACTICE_SOLUTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "alreadyCorrect"],
  properties: {
    answer: { type: "string" },
    alreadyCorrect: { type: "boolean" },
  },
} as const;

// INFO: every property is required so the output keeps this order: the checks before
// passed and reason. passed is recomputed by the app (toReview).
export const PRACTICE_REVIEW_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "singleAnswer",
    "meaningKept",
    "answerNotInPrompt",
    "oneRealMistake",
    "naturalEnglish",
    "solverAnswerAccepted",
    "passed",
    "reason",
  ],
  properties: {
    singleAnswer: { type: "boolean" },
    meaningKept: { type: "boolean" },
    answerNotInPrompt: { type: "boolean" },
    oneRealMistake: { type: "boolean" },
    naturalEnglish: { type: "boolean" },
    solverAnswerAccepted: { type: "boolean" },
    passed: { type: "boolean" },
    reason: { type: "string" },
  },
} as const;

// INFO: every property is required so the output keeps this order: the tutor decides
// whether the exercise is flawed before it gives the verdict.
export const ANSWER_GRADE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["flawed", "correct", "explanation"],
  properties: {
    flawed: { type: "boolean" },
    correct: { type: "boolean" },
    explanation: { type: "string" },
  },
} as const;

export type ClaudeAiConfig = {
  fetchFn: typeof fetch;
  readKey: () => Promise<KeyReadOutcome>;
  timeoutMs?: number;
};

// INFO: what ask returns: the parsed payload with the model and the billed usage, or a failure.
type Failed = { ok: false; failure: AiFailure; cause?: FailureCause; usage?: TokenUsage };
type Asked<P> = { ok: true; value: P & { model: ModelId; usage: TokenUsage } } | Failed;

type Fetched = { status: number; text: string | null };

const plainIdentifier = /^[A-Za-z_$][\w$]{0,63}$/;
const plainErrorType = /^[a-z_]{1,64}$/;

function fail(failure: AiFailure, cause: FailureCause, usage?: TokenUsage): Failed {
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

const badResponse = (usage?: TokenUsage): Failed =>
  fail("bad_response", { name: "BadResponse", detail: null }, usage);

function readSuccess<P extends object>(
  text: string | null,
  parse: (value: unknown) => P | null,
  model: ModelId,
): Asked<P> {
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
  const normalized = parse(reply.value);
  if (normalized === null || usage === undefined) return badResponse(usage);
  return { ok: true, value: { ...normalized, model, usage } };
}

export function createClaudeAi(config: ClaudeAiConfig): AiPort {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // INFO: one request and one reading for every call; only the model, the schema sent and the parsing differ.
  async function ask<P extends object>(
    model: ModelId,
    request: TutorRequest,
    schema: object,
    maxTokens: number,
    parse: (value: unknown) => P | null,
  ): Promise<Asked<P>> {
    const key = await config.readKey();
    if (!key.ok) return fail("key_unreadable", { name: "KeyRead", detail: null });
    const apiKey = key.value;
    if (apiKey === null) return { ok: false, failure: "missing_key" };
    const messages = providerMessages(request.turns);
    if (messages.length === 0) return badResponse();
    const body = JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: request.system,
      messages,
      thinking: { type: "disabled" },
      output_config: { format: { type: "json_schema", schema } },
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
    return readSuccess(fetched.text, parse, model);
  }

  return {
    reply: (request) =>
      ask(TUTOR_MODEL, request, TUTOR_REPLY_JSON_SCHEMA, NOTE_MAX_TOKENS, (value) => {
        const payload = tutorReplySchema.safeParse(value);
        if (!payload.success) return null;
        const reply = toTutorReply(payload.data);
        if (reply === null) return null;
        // INFO: a malformed note is dropped and the paid reply is kept.
        const note = payload.data.note === undefined ? null : toStudyNote(payload.data.note);
        // INFO: a malformed title is dropped and the paid reply is kept.
        const title = payload.data.title === undefined ? null : toChatTitle(payload.data.title);
        return { ...reply, note, title };
      }),
    replyInThread: (request) =>
      ask(TUTOR_MODEL, request, THREAD_REPLY_JSON_SCHEMA, MAX_TOKENS, (value) => {
        const payload = threadReplySchema.safeParse(value);
        return payload.success ? toThreadReply(payload.data) : null;
      }),
    practiceExercise: (request) =>
      ask(PRACTICE_WRITER_MODEL, request, PRACTICE_EXERCISE_JSON_SCHEMA, MAX_TOKENS, (value) => {
        const payload = practiceExercisePayloadSchema.safeParse(value);
        return payload.success ? { exercise: payload.data } : null;
      }),
    solveExercise: (request) =>
      ask(
        PRACTICE_SOLVER_MODEL,
        request,
        PRACTICE_SOLUTION_JSON_SCHEMA,
        GRADE_MAX_TOKENS,
        (value) => {
          const payload = practiceSolutionSchema.safeParse(value);
          return payload.success
            ? { answer: payload.data.answer.trim(), alreadyCorrect: payload.data.alreadyCorrect }
            : null;
        },
      ),
    reviewExercise: (request) =>
      ask(
        PRACTICE_REVIEW_MODEL,
        request,
        PRACTICE_REVIEW_JSON_SCHEMA,
        GRADE_MAX_TOKENS,
        (value) => {
          const payload = practiceReviewSchema.safeParse(value);
          return payload.success ? toReview(payload.data) : null;
        },
      ),
    studyNote: (request) =>
      ask(TUTOR_MODEL, request, STUDY_NOTE_JSON_SCHEMA, NOTE_MAX_TOKENS, (value) => {
        const payload = studyNotePayloadSchema.safeParse(value);
        const note = payload.success ? toStudyNote(payload.data) : null;
        return note === null ? null : { note };
      }),
    summarize: (request) =>
      ask(TUTOR_MODEL, request, CONTEXT_SUMMARY_JSON_SCHEMA, MAX_TOKENS, (value) => {
        const payload = contextSummarySchema.safeParse(value);
        const summary = payload.success ? toContextSummary(payload.data.summary) : null;
        return summary === null ? null : { summary };
      }),
    gradeAnswer: (request) =>
      ask(TUTOR_MODEL, request, ANSWER_GRADE_JSON_SCHEMA, GRADE_MAX_TOKENS, (value) => {
        const payload = answerGradeSchema.safeParse(value);
        return payload.success ? toAnswerGrade(payload.data) : null;
      }),
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
