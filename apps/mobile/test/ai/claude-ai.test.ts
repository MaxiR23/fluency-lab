// apps/mobile/test/ai/claude-ai.test.ts
//
// Tests for the provider adapter of the AI port, over an injected fetch and key reader.
//
// Tested:
// - The request: endpoint, headers, body, the key only in x-api-key
// - The output schema constant
// - Success, the expected empty reply, and each failure the screen branches on
// - Transport failures: rejected fetch, deadline, bad bodies, bad usage
// - The key never reaches an outcome or a log
// - replyInThread: the same request with the thread schema, its payload, and the same failures
// - A reply may carry a study note; studyNote: its schema, payload and failures
// - practiceRound and gradeAnswer: their schemas, their token limits, their payloads and the same failures
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/ai/claude-ai.test.ts
//
// SEE: apps/mobile/src/ai/claude-ai.ts

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { TUTOR_MODEL } from "@fluency-lab/shared";

import {
  ANSWER_GRADE_JSON_SCHEMA,
  PRACTICE_ROUND_JSON_SCHEMA,
  STUDY_NOTE_JSON_SCHEMA,
  THREAD_REPLY_JSON_SCHEMA,
  TUTOR_REPLY_JSON_SCHEMA,
  createClaudeAi,
} from "@/ai/claude-ai";
import type { KeyReadOutcome } from "@/keys/key-port";
import { generatedSecret } from "../helpers/generated-secret";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const key = generatedSecret("api-key");

type Seen = { url: string; method: string; headers: Headers; body: string };

const payload = {
  reply: "Nice! Where did you go?",
  corrections: [
    { original: "I never been", corrected: "I've never been", rule: "Present perfect" },
  ],
  explanation: "Use the present perfect.",
  newWords: ["definitely"],
};

function success(body: unknown = payload, usage: unknown = {}) {
  return new Response(
    JSON.stringify({
      type: "message",
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify(body) }],
      usage: { input_tokens: 700, output_tokens: 150, ...(usage as object) },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function rawResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(status: number, type: string, message = "nope") {
  return rawResponse({ type: "error", error: { type, message }, request_id: "req_1" }, status);
}

function setup(
  answer: Response | Error = success(),
  options: { read?: KeyReadOutcome; timeoutMs?: number } = {},
) {
  const seen: Seen[] = [];
  const fetchFn = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    seen.push({
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: await request.text(),
    });
    if (answer instanceof Error) throw answer;
    return answer;
  });
  const readKey = jest.fn(async () => options.read ?? ({ ok: true, value: key } as KeyReadOutcome));
  const ai = createClaudeAi({
    fetchFn: fetchFn as unknown as typeof fetch,
    readKey,
    timeoutMs: options.timeoutMs,
  });
  return { ai, seen, fetchFn, readKey };
}

const request = {
  system: "You are a tutor.",
  turns: [
    { role: "tutor", text: "Hi! What would you like to talk about?" },
    { role: "user", text: "I never been to Japan" },
  ],
} as const;

const logs = ["log", "info", "warn", "error", "debug"] as const;
const spies = logs.map((name) => jest.spyOn(console, name).mockImplementation(() => {}));

beforeEach(() => {
  for (const spy of spies) spy.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("the request", () => {
  it("goes to the endpoint with POST and the 3 headers, the key in x-api-key", async () => {
    const { ai, seen } = setup();

    await ai.reply({ system: request.system, turns: [...request.turns] });

    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe(ENDPOINT);
    expect(seen[0].method).toBe("POST");
    expect(seen[0].headers.get("x-api-key")).toBe(key);
    expect(seen[0].headers.get("anthropic-version")).toBe("2026-10-21");
    expect(seen[0].headers.get("content-type")).toBe("application/json");
  });

  it("sends the model, thinking off, the json schema output and the mapped messages", async () => {
    const { ai, seen } = setup();

    await ai.reply({ system: request.system, turns: [...request.turns] });
    const body = JSON.parse(seen[0].body);

    expect(body.model).toBe("claude-haiku-5-5");
    expect(body.model).toBe(TUTOR_MODEL);
    expect(body.max_tokens).toBe(2048);
    expect(body.system).toBe("You are a tutor.");
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(body.output_config.format.type).toBe("json_schema");
    expect(body.output_config.format.schema).toEqual(TUTOR_REPLY_JSON_SCHEMA);
    expect(body.messages).toEqual([{ role: "user", content: "I never been to Japan" }]);
  });

  it("sends no sampling parameters", async () => {
    const { ai, seen } = setup();

    await ai.reply({ system: request.system, turns: [...request.turns] });
    const body = JSON.parse(seen[0].body);

    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("top_p");
    expect(body).not.toHaveProperty("top_k");
  });

  it("does not put the key in the body or the url", async () => {
    const { ai, seen } = setup();

    await ai.reply({ system: request.system, turns: [...request.turns] });

    expect(seen[0].body).not.toContain(key);
    expect(seen[0].url).not.toContain(key);
  });
});

describe("TUTOR_REPLY_JSON_SCHEMA", () => {
  const unsupported = ["minLength", "maxLength", "minimum", "maximum", "minItems", "$ref"];

  function walk(node: unknown, visit: (node: Record<string, unknown>) => void) {
    if (typeof node !== "object" || node === null) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, visit);
      return;
    }
    const record = node as Record<string, unknown>;
    visit(record);
    for (const value of Object.values(record)) walk(value, visit);
  }

  it("closes every object and requires all of its properties but the optional note", () => {
    let objects = 0;
    walk(TUTOR_REPLY_JSON_SCHEMA, (node) => {
      if (node.type !== "object") return;
      objects += 1;
      expect(node.additionalProperties).toBe(false);
      const keys = Object.keys(node.properties as object).filter(
        (key) => node !== TUTOR_REPLY_JSON_SCHEMA || key !== "note",
      );
      expect(node.required).toEqual(keys);
    });
    expect(objects).toBe(3);
  });

  it("sends the note as the only optional property of the reply schema", () => {
    expect(TUTOR_REPLY_JSON_SCHEMA.required).not.toContain("note");
    expect(TUTOR_REPLY_JSON_SCHEMA.properties.note).toBe(STUDY_NOTE_JSON_SCHEMA);
    expect(STUDY_NOTE_JSON_SCHEMA.additionalProperties).toBe(false);
    expect(STUDY_NOTE_JSON_SCHEMA.required).toEqual([
      "kind",
      "title",
      "topic",
      "columns",
      "rows",
      "points",
      "remember",
    ]);
    expect(STUDY_NOTE_JSON_SCHEMA.properties.kind).toEqual({
      type: "string",
      enum: ["table", "summary"],
    });
    const forbidden = ["minItems", "maxItems", "minLength", "maxLength", "anyOf", "oneOf"];
    walk(STUDY_NOTE_JSON_SCHEMA, (node) => {
      for (const keyword of forbidden) expect(node).not.toHaveProperty(keyword);
      expect(Array.isArray(node.type)).toBe(false);
    });
  });

  it("uses no unsupported keyword", () => {
    walk(TUTOR_REPLY_JSON_SCHEMA, (node) => {
      for (const keyword of unsupported) expect(node).not.toHaveProperty(keyword);
    });
  });

  it("asks for original, corrected and rule on each correction, all required", () => {
    const items = TUTOR_REPLY_JSON_SCHEMA.properties.corrections.items;
    expect(items.required).toEqual(["original", "corrected", "rule"]);
    expect(items.properties.rule).toEqual({ type: "string" });
  });

  it("describes the four fields of the reply and its note", () => {
    expect(Object.keys(TUTOR_REPLY_JSON_SCHEMA.properties)).toEqual([
      "reply",
      "corrections",
      "explanation",
      "newWords",
      "note",
    ]);
  });
});

describe("a reply with a study note", () => {
  const notePayload = {
    kind: "table",
    title: "Future forms",
    topic: "Going to, will",
    columns: ["Form", "When", "Example"],
    rows: [["going to", "plans", "I'm going to study."]],
    points: [],
    remember: "Plans use going to.",
  };
  const ask = (ai: ReturnType<typeof setup>["ai"]) =>
    ai.reply({ system: request.system, turns: [...request.turns] });

  it("returns the reply with its note when the tutor made one", async () => {
    const { ai } = setup(success({ ...payload, note: notePayload }));
    const outcome = await ask(ai);
    expect(outcome).toMatchObject({
      ok: true,
      value: {
        reply: "Nice! Where did you go?",
        note: {
          kind: "table",
          title: "Future forms",
          topic: "Going to, will",
          content: {
            columns: ["Form", "When", "Example"],
            rows: [["going to", "plans", "I'm going to study."]],
            remember: "Plans use going to.",
          },
        },
      },
    });
  });

  it("returns a reply with a null note when the tutor made none", async () => {
    const { ai } = setup(success(payload));
    const outcome = await ask(ai);
    expect(outcome).toMatchObject({ ok: true, value: { note: null } });
  });

  it("keeps the reply and drops a malformed note", async () => {
    const { ai } = setup(success({ ...payload, note: { ...notePayload, columns: ["a", "b"] } }));
    const outcome = await ask(ai);
    expect(outcome).toMatchObject({
      ok: true,
      value: { reply: "Nice! Where did you go?", note: null },
    });
  });
});

describe("a successful reply", () => {
  it("parses the reply, corrections, explanation, new words, model and usage", async () => {
    const { ai } = setup(
      success(payload, { cache_creation_input_tokens: 5, cache_read_input_tokens: 7 }),
    );

    const outcome = await ai.reply({ system: request.system, turns: [...request.turns] });

    expect(outcome).toEqual({
      ok: true,
      value: {
        reply: "Nice! Where did you go?",
        corrections: [
          { original: "I never been", corrected: "I've never been", rule: "Present perfect" },
        ],
        explanation: "Use the present perfect.",
        newWords: ["definitely"],
        note: null,
        model: TUTOR_MODEL,
        usage: {
          inputTokens: 700,
          outputTokens: 150,
          cacheCreationInputTokens: 5,
          cacheReadInputTokens: 7,
        },
      },
    });
  });

  it("defaults the cache fields to 0 when they are absent or null", async () => {
    const { ai } = setup(success(payload, { cache_creation_input_tokens: null }));

    const outcome = await ai.reply({ system: request.system, turns: [...request.turns] });

    expect(outcome.ok && outcome.value.usage).toEqual({
      inputTokens: 700,
      outputTokens: 150,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    });
  });

  it("is a success without the rule when the provider leaves it out", async () => {
    const { ai } = setup(
      success({
        ...payload,
        corrections: [{ original: "I never been", corrected: "I've never been" }],
      }),
    );

    const outcome = await ai.reply({ system: request.system, turns: [...request.turns] });

    expect(outcome).toMatchObject({
      ok: true,
      value: { corrections: [{ original: "I never been", corrected: "I've never been" }] },
    });
  });

  it("is a success with empty lists and a null explanation when there is nothing to correct", async () => {
    const { ai } = setup(
      success({ reply: "Great!", corrections: [], explanation: "", newWords: [] }),
    );

    const outcome = await ai.reply({ system: request.system, turns: [...request.turns] });

    expect(outcome).toMatchObject({
      ok: true,
      value: { reply: "Great!", corrections: [], explanation: null, newWords: [] },
    });
  });
});

const sample = {
  inputTokens: 700,
  outputTokens: 150,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
};

const billed = {
  inputTokens: 1,
  outputTokens: 1,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
};

describe("the failures the screen branches on", () => {
  async function failureFor(answer: Response) {
    const { ai } = setup(answer);
    return ai.reply({ system: request.system, turns: [...request.turns] });
  }

  it("401 is invalid_key with the error type as the cause code", async () => {
    expect(await failureFor(errorResponse(401, "authentication_error"))).toEqual({
      ok: false,
      failure: "invalid_key",
      cause: { name: "HttpError", code: "authentication_error", detail: null },
    });
  });

  it("429 is rate_limited", async () => {
    expect(await failureFor(errorResponse(429, "rate_limit_error"))).toMatchObject({
      ok: false,
      failure: "rate_limited",
    });
  });

  it("529 is overloaded", async () => {
    expect(await failureFor(errorResponse(529, "overloaded_error"))).toMatchObject({
      ok: false,
      failure: "overloaded",
    });
  });

  it("400, 402 and 403 are rejected", async () => {
    for (const status of [400, 402, 403]) {
      expect(await failureFor(errorResponse(status, "invalid_request_error"))).toMatchObject({
        ok: false,
        failure: "rejected",
      });
    }
  });

  it("500 and 504 are unavailable", async () => {
    expect(await failureFor(errorResponse(500, "api_error"))).toMatchObject({
      ok: false,
      failure: "unavailable",
    });
    expect(await failureFor(errorResponse(504, "timeout_error"))).toMatchObject({
      ok: false,
      failure: "unavailable",
    });
  });

  it("maps by status when the error body cannot be read", async () => {
    const outcome = await failureFor(new Response("<html>", { status: 429 }));
    expect(outcome).toEqual({
      ok: false,
      failure: "rate_limited",
      cause: { name: "HttpError", code: "http_429", detail: null },
    });
  });

  it("ignores an error type that is not a plain identifier", async () => {
    const outcome = await failureFor(errorResponse(500, `Bad Type ${key}`));
    expect(outcome).toEqual({
      ok: false,
      failure: "unavailable",
      cause: { name: "HttpError", code: "http_500", detail: null },
    });
  });

  it("a refusal is refused", async () => {
    const body = {
      stop_reason: "refusal",
      content: [],
      usage: { input_tokens: 1, output_tokens: 1 },
    };
    expect(await failureFor(rawResponse(body))).toMatchObject({
      ok: false,
      failure: "refused",
      usage: billed,
    });
  });

  it("max_tokens is bad_response", async () => {
    const body = {
      stop_reason: "max_tokens",
      content: [{ type: "text", text: "{" }],
      usage: { input_tokens: 1, output_tokens: 1 },
    };
    expect(await failureFor(rawResponse(body))).toMatchObject({
      ok: false,
      failure: "bad_response",
      usage: billed,
    });
  });

  it("a 401 and a 500 carry no usage", async () => {
    for (const status of [401, 500]) {
      const outcome = await failureFor(errorResponse(status, "api_error"));
      expect(outcome).not.toHaveProperty("usage");
    }
  });
});

describe("the key", () => {
  it("no saved key is missing_key without a request", async () => {
    const { ai, fetchFn } = setup(success(), { read: { ok: true, value: null } });

    expect(await ai.reply({ system: request.system, turns: [...request.turns] })).toMatchObject({
      ok: false,
      failure: "missing_key",
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("a failed key read is key_unreadable without a request", async () => {
    const { ai, fetchFn } = setup(success(), { read: { ok: false, failure: "not_read" } });

    expect(await ai.reply({ system: request.system, turns: [...request.turns] })).toEqual({
      ok: false,
      failure: "key_unreadable",
      cause: { name: "KeyRead", detail: null },
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("a 401 whose message echoes the key leaves no key in the outcome", async () => {
    const { ai } = setup(errorResponse(401, "authentication_error", `invalid x-api-key: ${key}`));

    const outcome = await ai.reply({ system: request.system, turns: [...request.turns] });

    expect(JSON.stringify(outcome)).not.toContain(key);
  });

  it("a rejected fetch whose message echoes the key leaves no key in the outcome", async () => {
    const { ai } = setup(new TypeError(`Network request failed ${key}`));

    const outcome = await ai.reply({ system: request.system, turns: [...request.turns] });

    expect(outcome).toEqual({
      ok: false,
      failure: "network",
      cause: { name: "TypeError", detail: null },
    });
    expect(JSON.stringify(outcome)).not.toContain(key);
  });

  it("an error name that could carry text becomes unknown", async () => {
    const thrown = new Error("x");
    thrown.name = `bad name ${key}`;
    const { ai } = setup(thrown);

    const outcome = await ai.reply({ system: request.system, turns: [...request.turns] });

    expect(outcome).toMatchObject({ failure: "network", cause: { name: "unknown" } });
    expect(JSON.stringify(outcome)).not.toContain(key);
  });

  it("logs nothing", async () => {
    await setup(errorResponse(401, "authentication_error", key)).ai.reply({
      system: request.system,
      turns: [...request.turns],
    });
    await setup(new TypeError(key)).ai.reply({
      system: request.system,
      turns: [...request.turns],
    });
    await setup().ai.reply({ system: request.system, turns: [...request.turns] });

    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});

describe("transport failures", () => {
  it("a rejected fetch is network", async () => {
    const { ai } = setup(new TypeError("Network request failed"));

    expect(await ai.reply({ system: request.system, turns: [...request.turns] })).toEqual({
      ok: false,
      failure: "network",
      cause: { name: "TypeError", detail: null },
    });
  });

  it("the deadline is network", async () => {
    jest.useFakeTimers();
    const hang = jest.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const ai = createClaudeAi({
      fetchFn: hang as unknown as typeof fetch,
      readKey: async () => ({ ok: true, value: key }),
      timeoutMs: 50,
    });

    const pending = ai.reply({ system: request.system, turns: [...request.turns] });
    await jest.advanceTimersByTimeAsync(60);

    expect(await pending).toEqual({
      ok: false,
      failure: "network",
      cause: { name: "Timeout", detail: null },
    });
  });

  it("a non-JSON body is bad_response", async () => {
    const { ai } = setup(new Response("<html>", { status: 200 }));
    expect(await ai.reply({ system: request.system, turns: [...request.turns] })).toMatchObject({
      ok: false,
      failure: "bad_response",
    });
  });

  it("a text that is not JSON is bad_response", async () => {
    const body = {
      stop_reason: "end_turn",
      content: [{ type: "text", text: "not json" }],
      usage: { input_tokens: 1, output_tokens: 1 },
    };
    const { ai } = setup(rawResponse(body));
    expect(await ai.reply({ system: request.system, turns: [...request.turns] })).toMatchObject({
      ok: false,
      failure: "bad_response",
      usage: billed,
    });
  });

  it("a wrong shape is bad_response", async () => {
    const { ai } = setup(success({ reply: "x" }));
    expect(await ai.reply({ system: request.system, turns: [...request.turns] })).toMatchObject({
      ok: false,
      failure: "bad_response",
      usage: sample,
    });
  });

  it("an empty reply is bad_response", async () => {
    const { ai } = setup(success({ ...payload, reply: "  " }));
    expect(await ai.reply({ system: request.system, turns: [...request.turns] })).toMatchObject({
      ok: false,
      failure: "bad_response",
      usage: sample,
    });
  });

  it("no text block is bad_response", async () => {
    const body = {
      stop_reason: "end_turn",
      content: [{ type: "thinking" }],
      usage: { input_tokens: 1, output_tokens: 1 },
    };
    const { ai } = setup(rawResponse(body));
    expect(await ai.reply({ system: request.system, turns: [...request.turns] })).toMatchObject({
      ok: false,
      failure: "bad_response",
      usage: billed,
    });
  });

  it("bad usage is bad_response", async () => {
    for (const usage of [{ input_tokens: -1 }, { output_tokens: 1.5 }, { input_tokens: "7" }]) {
      const { ai } = setup(success(payload, usage));
      const outcome = await ai.reply({ system: request.system, turns: [...request.turns] });
      expect(outcome).toMatchObject({ ok: false, failure: "bad_response" });
      expect(outcome).not.toHaveProperty("usage");
    }
  });

  it("missing usage is bad_response", async () => {
    const body = {
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify(payload) }],
    };
    const { ai } = setup(rawResponse(body));
    expect(await ai.reply({ system: request.system, turns: [...request.turns] })).toMatchObject({
      ok: false,
      failure: "bad_response",
    });
  });

  it("a request with no user turn is bad_response without a request", async () => {
    const { ai, fetchFn } = setup();

    const outcome = await ai.reply({
      system: request.system,
      turns: [{ role: "tutor", text: "Hi" }],
    });

    expect(outcome).toMatchObject({ ok: false, failure: "bad_response" });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("replyInThread", () => {
  const threadPayload = {
    reply: "Because of the article.",
    newWords: ["laid-back"],
    withdrawn: [2],
  };
  const threadRequest = {
    system: "You are a tutor.",
    turns: [{ role: "user" as const, text: "Why is it wrong?" }],
  };

  it("parses the reply, the new words, the withdrawn numbers, the model and the usage", async () => {
    const { ai } = setup(success(threadPayload));

    const outcome = await ai.replyInThread(threadRequest);

    expect(outcome).toEqual({
      ok: true,
      value: {
        reply: "Because of the article.",
        newWords: ["laid-back"],
        withdrawn: [2],
        model: TUTOR_MODEL,
        usage: {
          inputTokens: 700,
          outputTokens: 150,
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
        },
      },
    });
  });

  it("is a success with no new words and no withdrawals", async () => {
    const { ai } = setup(success({ reply: "Ok.", newWords: [], withdrawn: [] }));
    const outcome = await ai.replyInThread(threadRequest);
    expect(outcome).toMatchObject({ ok: true, value: { newWords: [], withdrawn: [] } });
  });

  it("sends the same endpoint and headers with the thread schema, the key only in x-api-key", async () => {
    const { ai, seen } = setup(success(threadPayload));

    await ai.replyInThread(threadRequest);

    expect(seen[0].url).toBe(ENDPOINT);
    expect(seen[0].headers.get("x-api-key")).toBe(key);
    expect(seen[0].headers.get("anthropic-version")).toBe("2026-10-21");
    const sent = JSON.parse(seen[0].body);
    expect(sent.output_config.format).toEqual({
      type: "json_schema",
      schema: THREAD_REPLY_JSON_SCHEMA,
    });
    expect(sent.system).toBe("You are a tutor.");
    expect(sent.thinking).toEqual({ type: "disabled" });
    expect(seen[0].body).not.toContain(key);
  });

  it("maps a 401 to invalid_key and a 429 to rate_limited", async () => {
    const invalid = setup(errorResponse(401, "authentication_error"));
    expect(await invalid.ai.replyInThread(threadRequest)).toMatchObject({
      ok: false,
      failure: "invalid_key",
    });
    const limited = setup(errorResponse(429, "rate_limit_error"));
    expect(await limited.ai.replyInThread(threadRequest)).toMatchObject({
      ok: false,
      failure: "rate_limited",
    });
  });

  it("is missing_key without a saved key and makes no request", async () => {
    const { ai, fetchFn } = setup(success(threadPayload), { read: { ok: true, value: null } });
    expect(await ai.replyInThread(threadRequest)).toEqual({ ok: false, failure: "missing_key" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("is key_unreadable when the key cannot be read", async () => {
    const { ai } = setup(success(threadPayload), {
      read: { ok: false, failure: "not_read", cause: { name: "Error", detail: null } },
    });
    expect(await ai.replyInThread(threadRequest)).toMatchObject({
      ok: false,
      failure: "key_unreadable",
    });
  });

  it("is network when fetch rejects", async () => {
    const { ai } = setup(new TypeError("network down"));
    expect(await ai.replyInThread(threadRequest)).toMatchObject({ ok: false, failure: "network" });
  });

  it("is network at the deadline", async () => {
    jest.useFakeTimers();
    const fetchFn = jest.fn(() => new Promise<Response>(() => {}));
    const ai = createClaudeAi({
      fetchFn: fetchFn as unknown as typeof fetch,
      readKey: async () => ({ ok: true, value: key }),
      timeoutMs: 1000,
    });
    const pending = ai.replyInThread(threadRequest);
    await jest.advanceTimersByTimeAsync(1001);
    expect(await pending).toMatchObject({
      ok: false,
      failure: "network",
      cause: { name: "Timeout" },
    });
  });

  it("is bad_response with the billed usage for a wrong shape", async () => {
    const { ai } = setup(success({ reply: "Ok.", newWords: [] }));
    expect(await ai.replyInThread(threadRequest)).toMatchObject({
      ok: false,
      failure: "bad_response",
      usage: { inputTokens: 700, outputTokens: 150 },
    });
  });

  it("is bad_response for an empty reply", async () => {
    const { ai } = setup(success({ reply: "  ", newWords: [], withdrawn: [] }));
    expect(await ai.replyInThread(threadRequest)).toMatchObject({
      ok: false,
      failure: "bad_response",
    });
  });
});

describe("THREAD_REPLY_JSON_SCHEMA", () => {
  const unsupported = ["minLength", "maxLength", "minimum", "maximum", "minItems", "$ref"];

  function walk(node: unknown, visit: (node: Record<string, unknown>) => void) {
    if (typeof node !== "object" || node === null) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, visit);
      return;
    }
    const record = node as Record<string, unknown>;
    visit(record);
    for (const value of Object.values(record)) walk(value, visit);
  }

  it("closes every object and requires all of its properties", () => {
    let objects = 0;
    walk(THREAD_REPLY_JSON_SCHEMA, (node) => {
      if (node.type !== "object") return;
      objects += 1;
      expect(node.additionalProperties).toBe(false);
      expect(node.required).toEqual(Object.keys(node.properties as object));
    });
    expect(objects).toBe(1);
  });

  it("uses no unsupported keyword", () => {
    walk(THREAD_REPLY_JSON_SCHEMA, (node) => {
      for (const keyword of unsupported) expect(node).not.toHaveProperty(keyword);
    });
  });

  it("lists the withdrawn numbers as integers", () => {
    expect(THREAD_REPLY_JSON_SCHEMA.properties.withdrawn).toEqual({
      type: "array",
      items: { type: "integer" },
    });
  });
});

describe("practiceRound", () => {
  const roundRequest = {
    system: "Write exercises.",
    turns: [{ role: "user", text: '{"focus":{"kind":"words","words":["definitely"]},"count":5}' }],
  } as const;
  const exercise = {
    kind: "gap",
    rule: "Present perfect",
    prompt: "She ___ here since May.",
    options: [],
    accepted: ["has lived"],
    explanation: "Since needs the present perfect.",
    source: "",
  };
  const round = {
    items: [exercise, { ...exercise, prompt: "He ___ twice.", accepted: ["has been"] }],
  };
  const ask = (ai: ReturnType<typeof setup>["ai"], count = 2) =>
    ai.practiceRound({ system: roundRequest.system, turns: [...roundRequest.turns] }, count);

  it("returns the parsed round with its usage", async () => {
    const { ai } = setup(success(round));
    const outcome = await ask(ai);
    expect(outcome.ok && outcome.value.items).toHaveLength(2);
    expect(outcome).toMatchObject({
      ok: true,
      value: {
        items: [{ kind: "gap", options: null, source: null, accepted: ["has lived"] }, {}],
        model: TUTOR_MODEL,
        usage: { inputTokens: 700, outputTokens: 150 },
      },
    });
  });

  it("sends the round schema and 2048 max tokens", async () => {
    const { ai, seen } = setup(success(round));
    await ask(ai);
    const body = JSON.parse(seen[0].body);
    expect(body.max_tokens).toBe(2048);
    expect(body.output_config.format.schema).toEqual(PRACTICE_ROUND_JSON_SCHEMA);
    expect(seen[0].headers.get("x-api-key")).toBe(key);
    expect(body.messages).toEqual([{ role: "user", content: roundRequest.turns[0].text }]);
  });

  it("asks for up to 2048 tokens for a reply and keeps 1024 for a thread", async () => {
    const { ai, seen } = setup();
    await ai.reply({ system: request.system, turns: [...request.turns] });
    expect(JSON.parse(seen[0].body).max_tokens).toBe(2048);
    const thread = setup(success({ reply: "x", newWords: [], withdrawn: [] }));
    await thread.ai.replyInThread({ system: request.system, turns: [...request.turns] });
    expect(JSON.parse(thread.seen[0].body).max_tokens).toBe(1024);
  });

  it("a round with no usable exercise is bad_response with its usage", async () => {
    const { ai } = setup(success({ items: [{ ...exercise, kind: "riddle" }] }));
    expect(await ask(ai)).toMatchObject({
      ok: false,
      failure: "bad_response",
      usage: { inputTokens: 700, outputTokens: 150 },
    });
  });

  it("a round with fewer valid exercises than the count is bad_response with its usage", async () => {
    const { ai } = setup(success(round));
    expect(await ask(ai, 3)).toMatchObject({
      ok: false,
      failure: "bad_response",
      usage: { inputTokens: 700, outputTokens: 150 },
    });
  });

  it("keeps only the count from a round with spares", async () => {
    const spare = { ...exercise, prompt: "They ___ there." };
    const { ai } = setup(success({ items: [...round.items, spare, spare] }));
    const outcome = await ask(ai, 2);
    expect(outcome.ok && outcome.value.items).toHaveLength(2);
  });

  it("drops a fix that is already correct before counting", async () => {
    const already = {
      ...exercise,
      kind: "fix",
      prompt: "I can't go.",
      accepted: ["I can't go."],
    };
    const { ai } = setup(success({ items: [exercise, already] }));
    expect(await ask(ai, 2)).toMatchObject({
      ok: false,
      failure: "bad_response",
      usage: { inputTokens: 700, outputTokens: 150 },
    });
  });

  it("fails as invalid_key on 401 and as rate_limited on 429", async () => {
    expect(await ask(setup(errorResponse(401, "authentication_error")).ai)).toMatchObject({
      ok: false,
      failure: "invalid_key",
    });
    expect(await ask(setup(errorResponse(429, "rate_limit_error")).ai)).toMatchObject({
      ok: false,
      failure: "rate_limited",
    });
  });

  it("fails as missing_key without a saved key and makes no request", async () => {
    const { ai, fetchFn } = setup(success(round), { read: { ok: true, value: null } });
    expect(await ask(ai)).toEqual({ ok: false, failure: "missing_key" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("fails as network on a thrown fetch", async () => {
    expect(await ask(setup(new TypeError("Network request failed")).ai)).toMatchObject({
      ok: false,
      failure: "network",
    });
  });

  it("fails as network on the timeout", async () => {
    jest.useFakeTimers();
    const hang = jest.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const ai = createClaudeAi({
      fetchFn: hang as unknown as typeof fetch,
      readKey: async () => ({ ok: true, value: key }),
      timeoutMs: 50,
    });
    const pending = ask(ai);
    await jest.advanceTimersByTimeAsync(60);
    expect(await pending).toMatchObject({ ok: false, failure: "network" });
  });

  it("fails as bad_response on a non-JSON body and on max_tokens", async () => {
    expect(await ask(setup(new Response("<html>", { status: 200 })).ai)).toMatchObject({
      ok: false,
      failure: "bad_response",
    });
    const cut = rawResponse({
      type: "message",
      stop_reason: "max_tokens",
      content: [{ type: "text", text: "{" }],
      usage: { input_tokens: 700, output_tokens: 2048 },
    });
    expect(await ask(setup(cut).ai)).toMatchObject({
      ok: false,
      failure: "bad_response",
      usage: { outputTokens: 2048 },
    });
  });
});

describe("gradeAnswer", () => {
  const gradeRequest = {
    system: "Grade.",
    turns: [{ role: "user", text: '{"answer":"I have never visited Japan."}' }],
  } as const;
  const ask = (ai: ReturnType<typeof setup>["ai"]) =>
    ai.gradeAnswer({ system: gradeRequest.system, turns: [...gradeRequest.turns] });

  it("returns the verdict and explanation", async () => {
    const { ai } = setup(success({ flawed: false, correct: true, explanation: " Fine. " }));
    expect(await ask(ai)).toMatchObject({
      ok: true,
      value: { flawed: false, correct: true, explanation: "Fine.", model: TUTOR_MODEL },
    });
  });

  it("returns a flawed verdict", async () => {
    const { ai } = setup(
      success({ flawed: true, correct: false, explanation: "Two answers fit." }),
    );
    expect(await ask(ai)).toMatchObject({
      ok: true,
      value: { flawed: true, correct: false, explanation: "Two answers fit." },
    });
  });

  it("returns a verdict with no explanation", async () => {
    const { ai } = setup(success({ flawed: false, correct: false, explanation: "" }));
    expect(await ask(ai)).toMatchObject({
      ok: true,
      value: { flawed: false, correct: false, explanation: null },
    });
  });

  it("sends the grade schema and 512 max tokens", async () => {
    const { ai, seen } = setup(success({ flawed: false, correct: true, explanation: "" }));
    await ask(ai);
    const body = JSON.parse(seen[0].body);
    expect(body.max_tokens).toBe(512);
    expect(body.output_config.format.schema).toEqual(ANSWER_GRADE_JSON_SCHEMA);
  });

  it("fails as invalid_key on 401", async () => {
    expect(await ask(setup(errorResponse(401, "authentication_error")).ai)).toMatchObject({
      ok: false,
      failure: "invalid_key",
    });
  });

  it("fails as network on a thrown fetch and as bad_response on a wrong shape with its usage", async () => {
    expect(await ask(setup(new TypeError("down")).ai)).toMatchObject({
      ok: false,
      failure: "network",
    });
    expect(await ask(setup(success({ correct: "yes" })).ai)).toMatchObject({
      ok: false,
      failure: "bad_response",
      usage: { inputTokens: 700 },
    });
  });

  it("a verdict without flawed is bad_response with its usage", async () => {
    expect(await ask(setup(success({ correct: true, explanation: "" })).ai)).toMatchObject({
      ok: false,
      failure: "bad_response",
      usage: { inputTokens: 700 },
    });
  });
});

describe("PRACTICE_ROUND_JSON_SCHEMA and ANSWER_GRADE_JSON_SCHEMA", () => {
  const unsupported = ["minLength", "maxLength", "minimum", "maximum", "minItems", "$ref"];

  function walk(node: unknown, visit: (node: Record<string, unknown>) => void) {
    if (typeof node !== "object" || node === null) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, visit);
      return;
    }
    const record = node as Record<string, unknown>;
    visit(record);
    for (const value of Object.values(record)) walk(value, visit);
  }

  it("closes every object and requires all of its properties", () => {
    for (const schema of [PRACTICE_ROUND_JSON_SCHEMA, ANSWER_GRADE_JSON_SCHEMA]) {
      walk(schema, (node) => {
        if (node.type !== "object") return;
        expect(node.additionalProperties).toBe(false);
        expect(node.required).toEqual(Object.keys(node.properties as object));
      });
    }
  });

  it("uses no unsupported keyword", () => {
    for (const schema of [PRACTICE_ROUND_JSON_SCHEMA, ANSWER_GRADE_JSON_SCHEMA]) {
      walk(schema, (node) => {
        for (const keyword of unsupported) expect(node).not.toHaveProperty(keyword);
      });
    }
  });

  it("has an object at the root and limits kind to the four kinds", () => {
    expect(PRACTICE_ROUND_JSON_SCHEMA.type).toBe("object");
    expect(PRACTICE_ROUND_JSON_SCHEMA.properties.items.items.properties.kind).toEqual({
      type: "string",
      enum: ["choose", "fix", "gap", "translate"],
    });
    expect(ANSWER_GRADE_JSON_SCHEMA.properties.correct).toEqual({ type: "boolean" });
    expect(ANSWER_GRADE_JSON_SCHEMA.properties.flawed).toEqual({ type: "boolean" });
    expect(ANSWER_GRADE_JSON_SCHEMA.required).toEqual(["flawed", "correct", "explanation"]);
  });
});

describe("studyNote", () => {
  const notePayload = {
    kind: "summary",
    title: "Present perfect",
    topic: "Have + past participle",
    columns: [],
    rows: [],
    points: ["Use it for experience."],
    remember: "Think of now.",
  };
  const noteRequest = {
    system: "Write a note.",
    turns: [{ role: "user" as const, text: '{"rule":"Present perfect"}' }],
  };

  it("returns the note and the usage of a study note", async () => {
    const { ai } = setup(success(notePayload));
    expect(await ai.studyNote(noteRequest)).toEqual({
      ok: true,
      value: {
        note: {
          kind: "summary",
          title: "Present perfect",
          topic: "Have + past participle",
          content: { points: ["Use it for experience."], remember: "Think of now." },
        },
        model: TUTOR_MODEL,
        usage: {
          inputTokens: 700,
          outputTokens: 150,
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
        },
      },
    });
  });

  it("sends the study note schema at the root, 2048 tokens and the key only in the header", async () => {
    const { ai, seen } = setup(success(notePayload));
    await ai.studyNote(noteRequest);
    const body = JSON.parse(seen[0].body);
    expect(body.output_config.format.schema).toEqual(STUDY_NOTE_JSON_SCHEMA);
    expect(body.max_tokens).toBe(2048);
    expect(seen[0].headers.get("x-api-key")).toBe(key);
    expect(seen[0].body).not.toContain(key);
  });

  it("returns bad_response with the usage for a note that cannot be used", async () => {
    const { ai } = setup(success({ ...notePayload, points: [] }));
    expect(await ai.studyNote(noteRequest)).toMatchObject({
      ok: false,
      failure: "bad_response",
      usage: { inputTokens: 700, outputTokens: 150 },
    });
  });

  it("returns invalid_key on a 401", async () => {
    const { ai } = setup(errorResponse(401, "authentication_error"));
    expect(await ai.studyNote(noteRequest)).toMatchObject({ ok: false, failure: "invalid_key" });
  });

  it("returns rate_limited on a 429", async () => {
    const { ai } = setup(errorResponse(429, "rate_limit_error"));
    expect(await ai.studyNote(noteRequest)).toMatchObject({ ok: false, failure: "rate_limited" });
  });

  it("returns network on a rejected fetch", async () => {
    const { ai } = setup(new TypeError("Network request failed"));
    expect(await ai.studyNote(noteRequest)).toMatchObject({ ok: false, failure: "network" });
  });

  it("returns network on a timeout", async () => {
    jest.useFakeTimers();
    const hang = jest.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const ai = createClaudeAi({
      fetchFn: hang as unknown as typeof fetch,
      readKey: async () => ({ ok: true, value: key }),
      timeoutMs: 50,
    });
    const pending = ai.studyNote(noteRequest);
    await jest.advanceTimersByTimeAsync(60);
    expect(await pending).toMatchObject({ ok: false, failure: "network" });
  });

  it("returns bad_response on a body of the wrong shape", async () => {
    expect(await setup(success({ nope: true })).ai.studyNote(noteRequest)).toMatchObject({
      ok: false,
      failure: "bad_response",
    });
    expect(
      await setup(new Response("<html>", { status: 200 })).ai.studyNote(noteRequest),
    ).toMatchObject({ ok: false, failure: "bad_response" });
  });
});
