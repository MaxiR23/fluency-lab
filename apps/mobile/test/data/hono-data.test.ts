// apps/mobile/test/data/hono-data.test.ts
//
// Tests for the Hono data adapter.
//
// Tested:
// - Every call sends the token as a Bearer header to the API url
// - A failed token read is returned without calling the API
// - The token read counts inside the deadline
// - Each call: success, expected empty, 400/401/404, network failure, bad body
// - The chat calls: createSession with a starter, openSession, addMessage, addUsage,
//   setSessionContext, endSession and getMonthSpend
// - listOpenSessions and deleteSession
// - getSessionSummary
// - getProfileStats and deleteAccount
// - getMonthProgress, listHistory, listMistakes and listWords
// - The practice calls: getTodayPractice, listRecentPrompts, createPracticeRun, openPracticeRun, addPracticeItems,
//   answerPracticeItem, addPracticeUsage, setPracticeTarget and finishPracticeRun
// - The note calls: createNote, getNote, deleteNote and listNotes (createNote, getNote and deleteNote have no expected empty: a note exists or is not_found)
// - openThread, addThreadMessage and withdrawCorrections; openSession carries the thread reply counts
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/data/hono-data.test.ts
//
// SEE: apps/mobile/src/data/hono-data.ts

import { describe, expect, it, jest } from "@jest/globals";

import type { MessageCreate, ThreadMessageCreate } from "@fluency-lab/shared";

import type { DataPort } from "@/data/data-port";
import { createHonoData } from "@/data/hono-data";
import type { TokenRead } from "@/utils/data-token";

const id = "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e6f";
const stamp = "2026-01-01 10:00:00+00";

const profile = {
  id,
  displayName: "Ada",
  level: "beginner",
  goals: ["work"],
  topics: ["food"],
  provider: null,
  monthlyLimitUsd: null,
  onboardingCompletedAt: null,
  createdAt: stamp,
  updatedAt: stamp,
};
const session = {
  id,
  topicId: null,
  title: "Free chat",
  status: "active",
  summary: null,
  contextSummary: null,
  contextThroughId: null,
  costUsd: 0,
  createdAt: stamp,
  updatedAt: stamp,
};
const message = {
  id,
  sessionId: id,
  role: "user",
  text: "Hello",
  corrections: null,
  newWords: null,
  replyToId: null,
  noteId: null,
  createdAt: stamp,
};

const noteContent = {
  columns: ["Form", "When", "Example"],
  rows: [["going to", "plans", "I'm going to study."]],
  remember: "Plans use going to.",
};
const storedNote = {
  id,
  kind: "table",
  title: "Future forms",
  topic: "Going to, will",
  sessionId: id,
  sessionTitle: "Free chat",
  content: noteContent,
  createdAt: stamp,
};

type Seen = { url: string; method: string; headers: Headers; body: string | null };

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function readBody(request: Request): Promise<string | null> {
  const text = await request.text();
  return text === "" ? null : text;
}

function setup(answer: Response | Error, options: { token?: TokenRead; timeoutMs?: number } = {}) {
  const seen: Seen[] = [];
  const fetchFn = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    seen.push({
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: await readBody(request),
    });
    if (answer instanceof Error) throw answer;
    return answer;
  });
  const data = createHonoData({
    baseUrl: "http://api.test",
    fetchFn: fetchFn as unknown as typeof fetch,
    readToken: async () => options.token ?? { ok: true, token: "token-1" },
    timeoutMs: options.timeoutMs,
  });
  return { data, seen, fetchFn };
}

describe("the request", () => {
  it("sends the token as a Bearer header to the API url", async () => {
    const { data, seen } = setup(reply(profile));

    await data.getProfile();

    expect(seen[0].url).toBe("http://api.test/profile");
    expect(seen[0].headers.get("Authorization")).toBe("Bearer token-1");
  });

  it("returns the token failure without calling the API when there is no session", async () => {
    const { data, fetchFn } = setup(reply(profile), {
      token: { ok: false, failure: "unauthorized" },
    });

    expect(await data.getProfile()).toEqual({ ok: false, failure: "unauthorized" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns network when the token read failed on the network", async () => {
    const { data, fetchFn } = setup(reply(profile), {
      token: { ok: false, failure: "network" },
    });

    expect(await data.getActiveSession()).toEqual({ ok: false, failure: "network" });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("getProfile", () => {
  it("returns the parsed profile", async () => {
    const { data } = setup(reply(profile));
    expect(await data.getProfile()).toEqual({ ok: true, value: profile });
  });

  it("returns not_found on 404", async () => {
    const { data } = setup(reply({ error: "not_found" }, 404));
    expect(await data.getProfile()).toEqual({ ok: false, failure: "not_found" });
  });

  it("returns unauthorized on 401", async () => {
    const { data } = setup(reply({ error: "unauthorized" }, 401));
    expect(await data.getProfile()).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns unavailable on 503", async () => {
    const { data } = setup(reply({ error: "unavailable" }, 503));
    expect(await data.getProfile()).toEqual({ ok: false, failure: "unavailable" });
  });

  it("returns network when fetch rejects", async () => {
    const { data } = setup(new TypeError("Network request failed"));
    expect(await data.getProfile()).toEqual({ ok: false, failure: "network" });
  });

  it("returns network when the API does not answer before the deadline", async () => {
    const hang = jest.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const data = createHonoData({
      baseUrl: "http://api.test",
      fetchFn: hang as unknown as typeof fetch,
      readToken: async () => ({ ok: true, token: "token-1" }),
      timeoutMs: 20,
    });

    expect(await data.getProfile()).toEqual({ ok: false, failure: "network" });
  });

  it("returns network when the token read does not settle before the deadline", async () => {
    const fetchFn = jest.fn();
    const data = createHonoData({
      baseUrl: "http://api.test",
      fetchFn: fetchFn as unknown as typeof fetch,
      readToken: () => new Promise(() => {}),
      timeoutMs: 20,
    });

    expect(await data.getProfile()).toEqual({ ok: false, failure: "network" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns network when the body stalls after the headers", async () => {
    const stalled = {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => new Promise<unknown>(() => {}),
    };
    const data = createHonoData({
      baseUrl: "http://api.test",
      fetchFn: (async () => stalled) as unknown as typeof fetch,
      readToken: async () => ({ ok: true, token: "token-1" }),
      timeoutMs: 20,
    });

    expect(await data.getProfile()).toEqual({ ok: false, failure: "network" });
  });

  it("returns bad_response for a body that is not JSON", async () => {
    const { data } = setup(new Response("<html>", { status: 200 }));
    expect(await data.getProfile()).toEqual({ ok: false, failure: "bad_response" });
  });

  it("returns bad_response for a body with the wrong shape", async () => {
    const { data } = setup(reply({ id }));
    expect(await data.getProfile()).toEqual({ ok: false, failure: "bad_response" });
  });
});

describe("updateProfile", () => {
  it("sends the update as JSON and returns the parsed profile", async () => {
    const { data, seen } = setup(reply(profile));

    const outcome = await data.updateProfile({ level: "beginner" });

    expect(outcome).toEqual({ ok: true, value: profile });
    expect(seen[0].method).toBe("PUT");
    expect(seen[0].url).toBe("http://api.test/profile");
    expect(JSON.parse(seen[0].body ?? "null")).toEqual({ level: "beginner" });
  });

  it("returns invalid_input on 400", async () => {
    const { data } = setup(reply({ error: "invalid_input" }, 400));
    expect(await data.updateProfile({ level: "beginner" })).toEqual({
      ok: false,
      failure: "invalid_input",
    });
  });

  it("returns unauthorized on 401", async () => {
    const { data } = setup(reply({ error: "unauthorized" }, 401));
    expect(await data.updateProfile({ level: "beginner" })).toEqual({
      ok: false,
      failure: "unauthorized",
    });
  });

  it("returns network when fetch rejects", async () => {
    const { data } = setup(new TypeError("Network request failed"));
    expect(await data.updateProfile({ level: "beginner" })).toEqual({
      ok: false,
      failure: "network",
    });
  });

  it("returns bad_response for the wrong shape", async () => {
    const { data } = setup(reply({ nope: true }));
    expect(await data.updateProfile({ level: "beginner" })).toEqual({
      ok: false,
      failure: "bad_response",
    });
  });
});

describe("getActiveSession", () => {
  it("returns the active session with its last message", async () => {
    const body = { activeSession: { session, lastMessage: message } };
    const { data, seen } = setup(reply(body));

    expect(await data.getActiveSession()).toEqual({ ok: true, value: body.activeSession });
    expect(seen[0].url).toBe("http://api.test/sessions/active");
  });

  it("returns null when the API answers { activeSession: null }", async () => {
    const { data } = setup(reply({ activeSession: null }));
    expect(await data.getActiveSession()).toEqual({ ok: true, value: null });
  });

  it("returns unauthorized on 401", async () => {
    const { data } = setup(reply({ error: "unauthorized" }, 401));
    expect(await data.getActiveSession()).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns network when fetch rejects", async () => {
    const { data } = setup(new TypeError("Network request failed"));
    expect(await data.getActiveSession()).toEqual({ ok: false, failure: "network" });
  });

  it("returns bad_response for the wrong shape", async () => {
    const { data } = setup(reply({ activeSession: { session: {} } }));
    expect(await data.getActiveSession()).toEqual({ ok: false, failure: "bad_response" });
  });
});

describe("listOpenSessions", () => {
  it("gets /sessions/open and returns the open sessions", async () => {
    const body = { sessions: [{ session, lastMessage: message }] };
    const { data, seen } = setup(reply(body));

    expect(await data.listOpenSessions()).toEqual({ ok: true, value: body.sessions });
    expect(seen[0].method).toBe("GET");
    expect(seen[0].url).toBe("http://api.test/sessions/open");
  });

  it("returns an empty list as a success", async () => {
    const { data } = setup(reply({ sessions: [] }));
    expect(await data.listOpenSessions()).toEqual({ ok: true, value: [] });
  });

  it("returns unauthorized on 401", async () => {
    const { data } = setup(reply({ error: "unauthorized" }, 401));
    expect(await data.listOpenSessions()).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns network when fetch rejects", async () => {
    const { data } = setup(new TypeError("Network request failed"));
    expect(await data.listOpenSessions()).toEqual({ ok: false, failure: "network" });
  });

  it("returns bad_response for the wrong shape", async () => {
    const { data } = setup(reply({ sessions: [{ session: {} }] }));
    expect(await data.listOpenSessions()).toEqual({ ok: false, failure: "bad_response" });
  });
});

describe("deleteSession", () => {
  it("sends DELETE to /sessions/:id and returns the deleted session", async () => {
    const { data, seen } = setup(reply(session));

    expect(await data.deleteSession(id)).toEqual({ ok: true, value: session });
    expect(seen[0].method).toBe("DELETE");
    expect(seen[0].url).toBe(`http://api.test/sessions/${id}`);
  });

  it("returns not_found on 404 and unauthorized on 401", async () => {
    expect(await setup(reply({ error: "not_found" }, 404)).data.deleteSession(id)).toEqual({
      ok: false,
      failure: "not_found",
    });
    expect(await setup(reply({ error: "unauthorized" }, 401)).data.deleteSession(id)).toEqual({
      ok: false,
      failure: "unauthorized",
    });
  });

  it("returns invalid_input on 400", async () => {
    const { data } = setup(reply({ error: "invalid_input" }, 400));
    expect(await data.deleteSession("abc")).toEqual({ ok: false, failure: "invalid_input" });
  });

  it("returns network when fetch rejects", async () => {
    const { data } = setup(new TypeError("Network request failed"));
    expect(await data.deleteSession(id)).toEqual({ ok: false, failure: "network" });
  });

  it("returns bad_response for the wrong shape", async () => {
    const { data } = setup(reply({ id }));
    expect(await data.deleteSession(id)).toEqual({ ok: false, failure: "bad_response" });
  });
});

describe("createSession", () => {
  it("posts the topic and returns the created session", async () => {
    const { data, seen } = setup(reply(session, 201));

    const outcome = await data.createSession({ topicId: null });

    expect(outcome).toEqual({ ok: true, value: session });
    expect(seen[0].method).toBe("POST");
    expect(seen[0].url).toBe("http://api.test/sessions");
    expect(JSON.parse(seen[0].body ?? "null")).toEqual({ topicId: null });
  });

  it("returns invalid_input on 400", async () => {
    const { data } = setup(reply({ error: "invalid_input" }, 400));
    expect(await data.createSession({ topicId: null })).toEqual({
      ok: false,
      failure: "invalid_input",
    });
  });

  it("returns unauthorized on 401", async () => {
    const { data } = setup(reply({ error: "unauthorized" }, 401));
    expect(await data.createSession({ topicId: null })).toEqual({
      ok: false,
      failure: "unauthorized",
    });
  });

  it("returns network when fetch rejects", async () => {
    const { data } = setup(new TypeError("Network request failed"));
    expect(await data.createSession({ topicId: null })).toEqual({ ok: false, failure: "network" });
  });

  it("returns bad_response for the wrong shape", async () => {
    const { data } = setup(reply({ id }, 201));
    expect(await data.createSession({ topicId: null })).toEqual({
      ok: false,
      failure: "bad_response",
    });
  });
});

describe("createSession with a starter", () => {
  it("posts the starter id", async () => {
    const { data, seen } = setup(reply(session, 201));

    const outcome = await data.createSession({ starterId: "tech-app" });

    expect(outcome).toEqual({ ok: true, value: session });
    expect(JSON.parse(seen[0].body ?? "null")).toEqual({ starterId: "tech-app" });
  });
});

describe("openSession", () => {
  it("returns the session and its messages", async () => {
    const { data, seen } = setup(
      reply({ session, messages: [message], threadReplies: [], notes: [] }),
    );

    expect(await data.openSession(id)).toEqual({
      ok: true,
      value: { session, messages: [message], threadReplies: [], notes: [] },
    });
    expect(seen[0].method).toBe("GET");
    expect(seen[0].url).toBe(`http://api.test/sessions/${id}/messages`);
  });

  it("returns a session with no messages as a success", async () => {
    const { data } = setup(reply({ session, messages: [], threadReplies: [], notes: [] }));
    expect(await data.openSession(id)).toEqual({
      ok: true,
      value: { session, messages: [], threadReplies: [], notes: [] },
    });
  });

  it("returns saved corrections and new words", async () => {
    const saved = {
      ...message,
      corrections: { items: [{ original: "a", corrected: "b" }], explanation: "Because." },
      newWords: ["word"],
    };
    const { data } = setup(reply({ session, messages: [saved], threadReplies: [], notes: [] }));
    expect(await data.openSession(id)).toEqual({
      ok: true,
      value: { session, messages: [saved], threadReplies: [], notes: [] },
    });
  });

  it("returns the thread reply counts and no counts as a success", async () => {
    const counts = [{ messageId: id, count: 2 }];
    const { data } = setup(
      reply({ session, messages: [message], threadReplies: counts, notes: [] }),
    );
    expect(await data.openSession(id)).toMatchObject({
      ok: true,
      value: { threadReplies: counts, notes: [] },
    });
  });

  it("returns the notes saved in the session", async () => {
    const { data } = setup(
      reply({ session, messages: [message], threadReplies: [], notes: [storedNote] }),
    );
    expect(await data.openSession(id)).toMatchObject({ ok: true, value: { notes: [storedNote] } });
  });

  it("returns bad_response when the notes are missing", async () => {
    const { data } = setup(reply({ session, messages: [], threadReplies: [] }));
    expect(await data.openSession(id)).toEqual({ ok: false, failure: "bad_response" });
  });

  it("returns bad_response when the thread reply counts are missing", async () => {
    const { data } = setup(reply({ session, messages: [] }));
    expect(await data.openSession(id)).toEqual({ ok: false, failure: "bad_response" });
  });

  it("returns not_found on 404", async () => {
    const { data } = setup(reply({ error: "not_found" }, 404));
    expect(await data.openSession(id)).toEqual({ ok: false, failure: "not_found" });
  });

  it("returns unauthorized on 401", async () => {
    const { data } = setup(reply({ error: "unauthorized" }, 401));
    expect(await data.openSession(id)).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns network when fetch rejects", async () => {
    const { data } = setup(new TypeError("Network request failed"));
    expect(await data.openSession(id)).toEqual({ ok: false, failure: "network" });
  });

  it("returns bad_response for the wrong shape", async () => {
    const { data } = setup(reply({ messages: [] }));
    expect(await data.openSession(id)).toEqual({ ok: false, failure: "bad_response" });
  });
});

describe("getSessionSummary", () => {
  const summary = {
    session,
    messageCount: 4,
    corrections: [{ original: "a", corrected: "b", rule: "Articles" }],
    newWords: ["word"],
  };

  it("gets /sessions/:id/summary with the token and returns the parsed summary", async () => {
    const { data, seen } = setup(reply(summary));

    expect(await data.getSessionSummary(id)).toEqual({ ok: true, value: summary });
    expect(seen[0].method).toBe("GET");
    expect(seen[0].url).toBe(`http://api.test/sessions/${id}/summary`);
    expect(seen[0].headers.get("Authorization")).toBe("Bearer token-1");
  });

  it("returns a summary with no corrections and no words as a success", async () => {
    const empty = { session, messageCount: 0, corrections: [], newWords: [] };
    const { data } = setup(reply(empty));
    expect(await data.getSessionSummary(id)).toEqual({ ok: true, value: empty });
  });

  it("returns not_found on 404 and unauthorized on 401", async () => {
    const notFound = setup(reply({ error: "not_found" }, 404));
    expect(await notFound.data.getSessionSummary(id)).toEqual({ ok: false, failure: "not_found" });
    const unauthorized = setup(reply({ error: "unauthorized" }, 401));
    expect(await unauthorized.data.getSessionSummary(id)).toEqual({
      ok: false,
      failure: "unauthorized",
    });
  });

  it("returns network on a rejected fetch and on the deadline, and bad_response on a wrong shape", async () => {
    const rejected = setup(new TypeError("Network request failed"));
    expect(await rejected.data.getSessionSummary(id)).toEqual({ ok: false, failure: "network" });

    const hang = jest.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const slow = createHonoData({
      baseUrl: "http://api.test",
      fetchFn: hang as unknown as typeof fetch,
      readToken: async () => ({ ok: true, token: "token-1" }),
      timeoutMs: 20,
    });
    expect(await slow.getSessionSummary(id)).toEqual({ ok: false, failure: "network" });

    const wrong = setup(reply({ session, corrections: [], newWords: [] }));
    expect(await wrong.data.getSessionSummary(id)).toEqual({ ok: false, failure: "bad_response" });
  });
});

describe("addMessage", () => {
  const input = { role: "tutor", text: "Hello" } as const;

  it("posts the message and returns the saved one", async () => {
    const { data, seen } = setup(reply(message, 201));

    expect(await data.addMessage(id, input)).toEqual({ ok: true, value: message });
    expect(seen[0].method).toBe("POST");
    expect(seen[0].url).toBe(`http://api.test/sessions/${id}/messages`);
    expect(JSON.parse(seen[0].body ?? "null")).toEqual(input);
  });

  it("posts corrections and new words", async () => {
    const { data, seen } = setup(reply(message, 201));
    const full: MessageCreate = {
      role: "user",
      text: "I never been",
      corrections: { items: [{ original: "a", corrected: "b" }], explanation: null },
      newWords: ["word"],
    };

    await data.addMessage(id, full);

    expect(JSON.parse(seen[0].body ?? "null")).toEqual(full);
  });

  it("returns invalid_input on 400", async () => {
    const { data } = setup(reply({ error: "invalid_input" }, 400));
    expect(await data.addMessage(id, input)).toEqual({ ok: false, failure: "invalid_input" });
  });

  it("returns unauthorized on 401 and not_found on 404", async () => {
    expect(await setup(reply({ error: "unauthorized" }, 401)).data.addMessage(id, input)).toEqual({
      ok: false,
      failure: "unauthorized",
    });
    expect(await setup(reply({ error: "not_found" }, 404)).data.addMessage(id, input)).toEqual({
      ok: false,
      failure: "not_found",
    });
  });

  it("returns network when fetch rejects", async () => {
    const { data } = setup(new TypeError("Network request failed"));
    expect(await data.addMessage(id, input)).toEqual({ ok: false, failure: "network" });
  });

  it("returns bad_response for the wrong shape", async () => {
    const { data } = setup(reply({ id }, 201));
    expect(await data.addMessage(id, input)).toEqual({ ok: false, failure: "bad_response" });
  });
});

describe("addUsage", () => {
  const usage = {
    model: "claude-haiku-5-5",
    inputTokens: 700,
    outputTokens: 150,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
  } as const;

  it("posts the usage and returns the session", async () => {
    const { data, seen } = setup(reply({ ...session, costUsd: 0.000145 }));

    expect(await data.addUsage(id, usage)).toEqual({
      ok: true,
      value: { ...session, costUsd: 0.000145 },
    });
    expect(seen[0].method).toBe("POST");
    expect(seen[0].url).toBe(`http://api.test/sessions/${id}/usage`);
    expect(JSON.parse(seen[0].body ?? "null")).toEqual(usage);
  });

  it("posts a zero usage", async () => {
    const { data, seen } = setup(reply(session));
    const zero = { ...usage, inputTokens: 0, outputTokens: 0 };

    expect(await data.addUsage(id, zero)).toEqual({ ok: true, value: session });
    expect(JSON.parse(seen[0].body ?? "null")).toEqual(zero);
  });

  it("returns invalid_input on 400, unauthorized on 401 and not_found on 404", async () => {
    expect(await setup(reply({ error: "invalid_input" }, 400)).data.addUsage(id, usage)).toEqual({
      ok: false,
      failure: "invalid_input",
    });
    expect(await setup(reply({ error: "unauthorized" }, 401)).data.addUsage(id, usage)).toEqual({
      ok: false,
      failure: "unauthorized",
    });
    expect(await setup(reply({ error: "not_found" }, 404)).data.addUsage(id, usage)).toEqual({
      ok: false,
      failure: "not_found",
    });
  });

  it("returns network when fetch rejects", async () => {
    const { data } = setup(new TypeError("Network request failed"));
    expect(await data.addUsage(id, usage)).toEqual({ ok: false, failure: "network" });
  });

  it("returns bad_response for the wrong shape", async () => {
    const { data } = setup(reply({ id }));
    expect(await data.addUsage(id, usage)).toEqual({ ok: false, failure: "bad_response" });
  });
});

describe("setSessionContext", () => {
  const input = { summary: "Lives in Lisbon.", throughId: id };

  it("patches the context and returns the session", async () => {
    const saved = { ...session, contextSummary: input.summary, contextThroughId: id };
    const { data, seen } = setup(reply(saved));

    expect(await data.setSessionContext(id, input)).toEqual({ ok: true, value: saved });
    expect(seen[0].method).toBe("PATCH");
    expect(seen[0].url).toBe(`http://api.test/sessions/${id}/context`);
    expect(JSON.parse(seen[0].body ?? "null")).toEqual(input);
  });

  it("returns unauthorized on 401 and not_found on 404", async () => {
    expect(
      await setup(reply({ error: "unauthorized" }, 401)).data.setSessionContext(id, input),
    ).toEqual({ ok: false, failure: "unauthorized" });
    expect(
      await setup(reply({ error: "not_found" }, 404)).data.setSessionContext(id, input),
    ).toEqual({ ok: false, failure: "not_found" });
  });

  it("returns invalid_input on 400", async () => {
    const { data } = setup(reply({ error: "invalid_input" }, 400));
    expect(await data.setSessionContext("abc", input)).toEqual({
      ok: false,
      failure: "invalid_input",
    });
  });

  it("returns unavailable on 503", async () => {
    const { data } = setup(reply({ error: "unavailable" }, 503));
    expect(await data.setSessionContext(id, input)).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });

  it("returns network when fetch rejects", async () => {
    const { data } = setup(new TypeError("Network request failed"));
    expect(await data.setSessionContext(id, input)).toEqual({ ok: false, failure: "network" });
  });

  it("returns bad_response for the wrong shape", async () => {
    const { data } = setup(reply({ id }));
    expect(await data.setSessionContext(id, input)).toEqual({
      ok: false,
      failure: "bad_response",
    });
  });
});

describe("endSession", () => {
  it("posts to end and returns the ended session", async () => {
    const { data, seen } = setup(reply({ ...session, status: "ended" }));

    expect(await data.endSession(id)).toEqual({ ok: true, value: { ...session, status: "ended" } });
    expect(seen[0].method).toBe("POST");
    expect(seen[0].url).toBe(`http://api.test/sessions/${id}/end`);
  });

  it("answers an already ended session as a success", async () => {
    const { data } = setup(reply({ ...session, status: "ended" }));
    expect(await data.endSession(id)).toMatchObject({ ok: true, value: { status: "ended" } });
  });

  it("returns unauthorized on 401 and not_found on 404", async () => {
    expect(await setup(reply({ error: "unauthorized" }, 401)).data.endSession(id)).toEqual({
      ok: false,
      failure: "unauthorized",
    });
    expect(await setup(reply({ error: "not_found" }, 404)).data.endSession(id)).toEqual({
      ok: false,
      failure: "not_found",
    });
  });

  it("returns invalid_input on 400", async () => {
    const { data } = setup(reply({ error: "invalid_input" }, 400));
    expect(await data.endSession("abc")).toEqual({ ok: false, failure: "invalid_input" });
  });

  it("returns network when fetch rejects", async () => {
    const { data } = setup(new TypeError("Network request failed"));
    expect(await data.endSession(id)).toEqual({ ok: false, failure: "network" });
  });

  it("returns bad_response for the wrong shape", async () => {
    const { data } = setup(reply({ id }));
    expect(await data.endSession(id)).toEqual({ ok: false, failure: "bad_response" });
  });
});

describe("getMonthSpend", () => {
  it("sends the time zone and returns the month spend", async () => {
    const { data, seen } = setup(reply({ monthStart: "2026-11-01", spentUsd: 1.5 }));

    expect(await data.getMonthSpend("UTC")).toEqual({
      ok: true,
      value: { monthStart: "2026-11-01", spentUsd: 1.5 },
    });
    expect(seen[0].url).toBe("http://api.test/sessions/spend?tz=UTC");
  });

  it("returns 0 when nothing was spent", async () => {
    const { data } = setup(reply({ monthStart: "2026-11-01", spentUsd: 0 }));
    expect(await data.getMonthSpend("UTC")).toEqual({
      ok: true,
      value: { monthStart: "2026-11-01", spentUsd: 0 },
    });
  });

  it("returns invalid_input on 400 and unauthorized on 401", async () => {
    expect(await setup(reply({ error: "invalid_input" }, 400)).data.getMonthSpend("x")).toEqual({
      ok: false,
      failure: "invalid_input",
    });
    expect(await setup(reply({ error: "unauthorized" }, 401)).data.getMonthSpend("UTC")).toEqual({
      ok: false,
      failure: "unauthorized",
    });
  });

  it("returns network when fetch rejects", async () => {
    const { data } = setup(new TypeError("Network request failed"));
    expect(await data.getMonthSpend("UTC")).toEqual({ ok: false, failure: "network" });
  });

  it("returns bad_response for the wrong shape", async () => {
    const { data } = setup(reply({ spentUsd: "none" }));
    expect(await data.getMonthSpend("UTC")).toEqual({ ok: false, failure: "bad_response" });
  });
});

describe("getSessionWeek", () => {
  const week = {
    weekStart: "2026-11-02",
    today: "2026-11-05",
    days: ["2026-11-02"],
    perfectDays: [],
  };

  it("sends the time zone and returns the parsed week", async () => {
    const { data, seen } = setup(reply(week));

    expect(await data.getSessionWeek("America/Argentina/Buenos_Aires")).toEqual({
      ok: true,
      value: week,
    });
    expect(seen[0].url).toBe("http://api.test/sessions/week?tz=America%2FArgentina%2FBuenos_Aires");
    expect(seen[0].method).toBe("GET");
  });

  it("returns the perfect days of the week", async () => {
    const perfect = { ...week, perfectDays: ["2026-11-02"] };
    const { data } = setup(reply(perfect));
    expect(await data.getSessionWeek("UTC")).toEqual({ ok: true, value: perfect });
  });

  it("returns a week with no days as a success", async () => {
    const empty = { ...week, days: [] };
    const { data } = setup(reply(empty));
    expect(await data.getSessionWeek("UTC")).toEqual({ ok: true, value: empty });
  });

  it("returns invalid_input on 400", async () => {
    const { data } = setup(reply({ error: "invalid_input" }, 400));
    expect(await data.getSessionWeek("Mars/Olympus")).toEqual({
      ok: false,
      failure: "invalid_input",
    });
  });

  it("returns unauthorized on 401", async () => {
    const { data } = setup(reply({ error: "unauthorized" }, 401));
    expect(await data.getSessionWeek("UTC")).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns network when fetch rejects", async () => {
    const { data } = setup(new TypeError("network down"));
    expect(await data.getSessionWeek("UTC")).toEqual({ ok: false, failure: "network" });
  });

  it("returns bad_response for the wrong shape", async () => {
    const { data } = setup(reply({ weekStart: "2026-11-02" }));
    expect(await data.getSessionWeek("UTC")).toEqual({ ok: false, failure: "bad_response" });
  });
});

describe("getProfileStats", () => {
  const stats = { sessions: 12, dayStreak: 3, newWords: 48 };

  it("sends the time zone and returns the parsed stats", async () => {
    const { data, seen } = setup(reply(stats));

    expect(await data.getProfileStats("America/Argentina/Buenos_Aires")).toEqual({
      ok: true,
      value: stats,
    });
    expect(seen[0].url).toBe("http://api.test/profile/stats?tz=America%2FArgentina%2FBuenos_Aires");
    expect(seen[0].method).toBe("GET");
  });

  it("returns zeros as a success", async () => {
    const zeros = { sessions: 0, dayStreak: 0, newWords: 0 };
    const { data } = setup(reply(zeros));
    expect(await data.getProfileStats("UTC")).toEqual({ ok: true, value: zeros });
  });

  it("returns unauthorized on a 401", async () => {
    const { data } = setup(reply({ error: "unauthorized" }, 401));
    expect(await data.getProfileStats("UTC")).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns network when fetch rejects", async () => {
    const { data } = setup(new TypeError("network down"));
    expect(await data.getProfileStats("UTC")).toEqual({ ok: false, failure: "network" });
  });

  it("returns network when the API does not answer before the deadline", async () => {
    const hang = jest.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const data = createHonoData({
      baseUrl: "http://api.test",
      fetchFn: hang as unknown as typeof fetch,
      readToken: async () => ({ ok: true, token: "token-1" }),
      timeoutMs: 20,
    });
    expect(await data.getProfileStats("UTC")).toEqual({ ok: false, failure: "network" });
  });

  it("returns bad_response for the wrong shape", async () => {
    const { data } = setup(reply({ sessions: -1, dayStreak: 0, newWords: 0 }));
    expect(await data.getProfileStats("UTC")).toEqual({ ok: false, failure: "bad_response" });
  });
});

// INFO: deleteAccount has no expected empty case: the call returns no data.
describe("deleteAccount", () => {
  it("sends DELETE /account with the token and returns null", async () => {
    const { data, seen } = setup(reply({ deleted: true }));

    expect(await data.deleteAccount()).toEqual({ ok: true, value: null });
    expect(seen[0].url).toBe("http://api.test/account");
    expect(seen[0].method).toBe("DELETE");
    expect(seen[0].headers.get("Authorization")).toBe("Bearer token-1");
  });

  it("returns unauthorized on a 401", async () => {
    const { data } = setup(reply({ error: "unauthorized" }, 401));
    expect(await data.deleteAccount()).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns unavailable on a 503", async () => {
    const { data } = setup(reply({ error: "unavailable" }, 503));
    expect(await data.deleteAccount()).toEqual({ ok: false, failure: "unavailable" });
  });

  it("returns network when fetch rejects", async () => {
    const { data } = setup(new TypeError("network down"));
    expect(await data.deleteAccount()).toEqual({ ok: false, failure: "network" });
  });

  it("returns bad_response for a body other than { deleted: true }", async () => {
    const { data } = setup(reply({ deleted: false }));
    expect(await data.deleteAccount()).toEqual({ ok: false, failure: "bad_response" });
  });
});

describe("getMonthProgress", () => {
  const month = { monthStart: "2026-11-01", sessions: 12, corrections: 31, newWords: 48 };

  it("sends the time zone and returns the parsed month", async () => {
    const { data, seen } = setup(reply(month));

    expect(await data.getMonthProgress("America/Argentina/Buenos_Aires")).toEqual({
      ok: true,
      value: month,
    });
    expect(seen[0].url).toBe(
      "http://api.test/progress/month?tz=America%2FArgentina%2FBuenos_Aires",
    );
    expect(seen[0].method).toBe("GET");
  });

  it("returns zeros as a success", async () => {
    const zeros = { monthStart: "2026-11-01", sessions: 0, corrections: 0, newWords: 0 };
    const { data } = setup(reply(zeros));
    expect(await data.getMonthProgress("UTC")).toEqual({ ok: true, value: zeros });
  });

  it("returns unauthorized on 401", async () => {
    const { data } = setup(reply({ error: "unauthorized" }, 401));
    expect(await data.getMonthProgress("UTC")).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns network when the fetch rejects", async () => {
    const { data } = setup(new TypeError("network down"));
    expect(await data.getMonthProgress("UTC")).toEqual({ ok: false, failure: "network" });
  });

  it("returns bad_response for a body of the wrong shape", async () => {
    const { data } = setup(reply({ ...month, sessions: -1 }));
    expect(await data.getMonthProgress("UTC")).toEqual({ ok: false, failure: "bad_response" });
  });
});

describe("listHistory", () => {
  const page = {
    items: [
      {
        session: { ...session, status: "ended" },
        day: "2026-11-05",
        messageCount: 14,
        correctionCount: 3,
      },
    ],
    nextOffset: 20,
  };
  const empty = { items: [], nextOffset: null };

  it("sends the zone and the offset and returns the page", async () => {
    const { data, seen } = setup(reply(page));

    expect(await data.listHistory("UTC", 20)).toEqual({ ok: true, value: page });
    expect(seen[0].url).toBe("http://api.test/progress/history?tz=UTC&offset=20");
    expect(seen[0].method).toBe("GET");
  });

  it("returns an empty page as a success", async () => {
    const { data } = setup(reply(empty));
    expect(await data.listHistory("UTC", 0)).toEqual({ ok: true, value: empty });
  });

  it("returns unauthorized on 401", async () => {
    const { data } = setup(reply({ error: "unauthorized" }, 401));
    expect(await data.listHistory("UTC", 0)).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns network when the fetch rejects", async () => {
    const { data } = setup(new TypeError("network down"));
    expect(await data.listHistory("UTC", 0)).toEqual({ ok: false, failure: "network" });
  });

  it("returns bad_response for a body of the wrong shape", async () => {
    const { data } = setup(reply({ items: [{ day: "x" }], nextOffset: null }));
    expect(await data.listHistory("UTC", 0)).toEqual({ ok: false, failure: "bad_response" });
  });
});

describe("listMistakes", () => {
  const page = {
    items: [{ rule: null, times: 2, latest: { original: "a", corrected: "b" } }],
    nextOffset: null,
  };
  const empty = { items: [], nextOffset: null };

  it("sends the offset and returns the page", async () => {
    const { data, seen } = setup(reply(page));

    expect(await data.listMistakes(0)).toEqual({ ok: true, value: page });
    expect(seen[0].url).toBe("http://api.test/progress/mistakes?offset=0");
    expect(seen[0].method).toBe("GET");
  });

  it("returns an empty page as a success", async () => {
    const { data } = setup(reply(empty));
    expect(await data.listMistakes(0)).toEqual({ ok: true, value: empty });
  });

  it("returns unauthorized on 401", async () => {
    const { data } = setup(reply({ error: "unauthorized" }, 401));
    expect(await data.listMistakes(0)).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns network when the fetch rejects", async () => {
    const { data } = setup(new TypeError("network down"));
    expect(await data.listMistakes(0)).toEqual({ ok: false, failure: "network" });
  });

  it("returns bad_response for a body of the wrong shape", async () => {
    const { data } = setup(reply({ items: [{ rule: "x", times: 0 }], nextOffset: null }));
    expect(await data.listMistakes(0)).toEqual({ ok: false, failure: "bad_response" });
  });
});

describe("listWords", () => {
  const page = {
    items: [{ word: "catchy", sentence: "That song.", day: "2026-11-05" }],
    nextOffset: 20,
  };
  const empty = { items: [], nextOffset: null };

  it("sends the zone and the offset and returns the page", async () => {
    const { data, seen } = setup(reply(page));

    expect(await data.listWords("UTC", 20)).toEqual({ ok: true, value: page });
    expect(seen[0].url).toBe("http://api.test/progress/words?tz=UTC&offset=20");
    expect(seen[0].method).toBe("GET");
  });

  it("returns an empty page as a success", async () => {
    const { data } = setup(reply(empty));
    expect(await data.listWords("UTC", 0)).toEqual({ ok: true, value: empty });
  });

  it("returns unauthorized on 401", async () => {
    const { data } = setup(reply({ error: "unauthorized" }, 401));
    expect(await data.listWords("UTC", 0)).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns network when the fetch rejects", async () => {
    const { data } = setup(new TypeError("network down"));
    expect(await data.listWords("UTC", 0)).toEqual({ ok: false, failure: "network" });
  });

  it("returns bad_response for a body of the wrong shape", async () => {
    const { data } = setup(reply({ items: [{ word: 1 }], nextOffset: null }));
    expect(await data.listWords("UTC", 0)).toEqual({ ok: false, failure: "bad_response" });
  });
});

const threadRow = {
  id,
  messageId: id,
  role: "user",
  text: "Why?",
  newWords: null,
  createdAt: stamp,
};

describe("openThread", () => {
  const corrected = {
    ...message,
    corrections: {
      items: [{ original: "a", corrected: "b", withdrawn: true }],
      explanation: null,
    },
  };

  it("returns the message, its session and the thread in order", async () => {
    const { data, seen } = setup(reply({ session, message: corrected, messages: [threadRow] }));

    expect(await data.openThread(id)).toEqual({
      ok: true,
      value: { session, message: corrected, messages: [threadRow] },
    });
    expect(seen[0].method).toBe("GET");
    expect(seen[0].url).toBe(`http://api.test/messages/${id}/thread`);
  });

  it("returns a thread with no messages as a success", async () => {
    const { data } = setup(reply({ session, message: corrected, messages: [] }));
    expect(await data.openThread(id)).toMatchObject({ ok: true, value: { messages: [] } });
  });

  it("returns not_found on 404 and unauthorized on 401", async () => {
    expect(await setup(reply({ error: "not_found" }, 404)).data.openThread(id)).toEqual({
      ok: false,
      failure: "not_found",
    });
    expect(await setup(reply({ error: "unauthorized" }, 401)).data.openThread(id)).toEqual({
      ok: false,
      failure: "unauthorized",
    });
  });

  it("returns network when fetch rejects", async () => {
    const { data } = setup(new TypeError("Network request failed"));
    expect(await data.openThread(id)).toEqual({ ok: false, failure: "network" });
  });

  it("returns bad_response for the wrong shape", async () => {
    const { data } = setup(reply({ session }));
    expect(await data.openThread(id)).toEqual({ ok: false, failure: "bad_response" });
  });
});

describe("addThreadMessage", () => {
  const input: ThreadMessageCreate = { role: "user", text: "Why?", newWords: ["word"] };

  it("posts the row and returns the saved one", async () => {
    const { data, seen } = setup(reply({ ...threadRow, newWords: ["word"] }, 201));

    expect(await data.addThreadMessage(id, input)).toEqual({
      ok: true,
      value: { ...threadRow, newWords: ["word"] },
    });
    expect(seen[0].method).toBe("POST");
    expect(seen[0].url).toBe(`http://api.test/messages/${id}/thread`);
    expect(JSON.parse(seen[0].body ?? "null")).toEqual(input);
  });

  it("posts a row with no new words", async () => {
    const { data, seen } = setup(reply(threadRow, 201));
    await data.addThreadMessage(id, { role: "user", text: "Why?" });
    expect(JSON.parse(seen[0].body ?? "null")).toEqual({ role: "user", text: "Why?" });
  });

  it("returns invalid_input on 400 and not_found on 404", async () => {
    expect(
      await setup(reply({ error: "invalid_input" }, 400)).data.addThreadMessage(id, input),
    ).toEqual({ ok: false, failure: "invalid_input" });
    expect(
      await setup(reply({ error: "not_found" }, 404)).data.addThreadMessage(id, input),
    ).toEqual({ ok: false, failure: "not_found" });
  });

  it("returns network when fetch rejects", async () => {
    const { data } = setup(new TypeError("Network request failed"));
    expect(await data.addThreadMessage(id, input)).toEqual({ ok: false, failure: "network" });
  });

  it("returns bad_response for the wrong shape", async () => {
    const { data } = setup(reply({ id }, 201));
    expect(await data.addThreadMessage(id, input)).toEqual({ ok: false, failure: "bad_response" });
  });
});

describe("withdrawCorrections", () => {
  const withdrawn = {
    ...message,
    corrections: {
      items: [{ original: "a", corrected: "b", withdrawn: true }],
      explanation: null,
    },
  };

  it("posts the indexes and returns the message with the correction withdrawn", async () => {
    const { data, seen } = setup(reply(withdrawn));

    expect(await data.withdrawCorrections(id, [0])).toEqual({ ok: true, value: withdrawn });
    expect(seen[0].method).toBe("POST");
    expect(seen[0].url).toBe(`http://api.test/messages/${id}/withdraw`);
    expect(JSON.parse(seen[0].body ?? "null")).toEqual({ items: [0] });
  });

  it("returns invalid_input on 400 for no indexes", async () => {
    const { data } = setup(reply({ error: "invalid_input" }, 400));
    expect(await data.withdrawCorrections(id, [])).toEqual({
      ok: false,
      failure: "invalid_input",
    });
  });

  it("returns not_found on 404", async () => {
    const { data } = setup(reply({ error: "not_found" }, 404));
    expect(await data.withdrawCorrections(id, [0])).toEqual({ ok: false, failure: "not_found" });
  });

  it("returns network when fetch rejects", async () => {
    const { data } = setup(new TypeError("Network request failed"));
    expect(await data.withdrawCorrections(id, [0])).toEqual({ ok: false, failure: "network" });
  });

  it("returns bad_response for the wrong shape", async () => {
    const { data } = setup(reply({ id }));
    expect(await data.withdrawCorrections(id, [0])).toEqual({
      ok: false,
      failure: "bad_response",
    });
  });
});

describe("the practice calls", () => {
  const runId = "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5eb1";
  const itemId = "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ee1";
  const run = {
    id: runId,
    focus: "mistakes",
    topicId: null,
    noteId: null,
    target: 5,
    costUsd: 0,
    createdAt: stamp,
    finishedAt: null,
  };
  const item = {
    id: itemId,
    runId,
    position: 0,
    kind: "choose",
    rule: "Present perfect",
    prompt: "I ___ there.",
    options: ["have been", "was", "am"],
    accepted: ["have been"],
    explanation: "Experience.",
    source: null,
    userAnswer: null,
    correct: null,
    answeredAt: null,
  };
  const created = {
    position: 0,
    kind: "choose" as const,
    rule: "Present perfect",
    prompt: "I ___ there.",
    options: ["have been", "was", "am"],
    accepted: ["have been"],
    explanation: "Experience.",
    source: null,
  };
  const usage = {
    model: "claude-haiku-5-5",
    inputTokens: 1,
    outputTokens: 1,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
  } as const;

  type Call = {
    name: string;
    method: string;
    url: string;
    body: unknown;
    answer: unknown;
    value: unknown;
    run: (data: DataPort) => Promise<unknown>;
  };

  const calls: Call[] = [
    {
      name: "getTodayPractice",
      method: "GET",
      url: "http://api.test/practice/today?tz=UTC",
      body: null,
      answer: { run: { run, items: [item] } },
      value: { run, items: [item] },
      run: (data) => data.getTodayPractice("UTC"),
    },
    {
      name: "listRecentPrompts",
      method: "GET",
      url: "http://api.test/practice/recent-prompts?days=7&limit=40",
      body: null,
      answer: { items: [{ runId: "run-1", prompt: "I ___ (be) there.", rule: "Present perfect" }] },
      value: [{ runId: "run-1", prompt: "I ___ (be) there.", rule: "Present perfect" }],
      run: (data) => data.listRecentPrompts(7, 40),
    },
    {
      name: "createPracticeRun",
      method: "POST",
      url: "http://api.test/practice/runs",
      body: { focus: "mistakes", target: 5 },
      answer: run,
      value: run,
      run: (data) => data.createPracticeRun({ focus: "mistakes", target: 5 }),
    },
    {
      name: "openPracticeRun",
      method: "GET",
      url: `http://api.test/practice/runs/${runId}`,
      body: null,
      answer: { run, items: [item] },
      value: { run, items: [item] },
      run: (data) => data.openPracticeRun(runId),
    },
    {
      name: "addPracticeItems",
      method: "POST",
      url: `http://api.test/practice/runs/${runId}/items`,
      body: { items: [created] },
      answer: { items: [item] },
      value: [item],
      run: (data) => data.addPracticeItems(runId, [created]),
    },
    {
      name: "answerPracticeItem",
      method: "POST",
      url: `http://api.test/practice/items/${itemId}/answer`,
      body: { userAnswer: "was", correct: false },
      answer: { ...item, userAnswer: "was", correct: false },
      value: { ...item, userAnswer: "was", correct: false },
      run: (data) => data.answerPracticeItem(itemId, { userAnswer: "was", correct: false }),
    },
    {
      name: "addPracticeUsage",
      method: "POST",
      url: `http://api.test/practice/runs/${runId}/usage`,
      body: usage,
      answer: { ...run, costUsd: 0.1 },
      value: { ...run, costUsd: 0.1 },
      run: (data) => data.addPracticeUsage(runId, usage),
    },
    {
      name: "setPracticeTarget",
      method: "POST",
      url: `http://api.test/practice/runs/${runId}/target`,
      body: { target: 10 },
      answer: { ...run, target: 10 },
      value: { ...run, target: 10 },
      run: (data) => data.setPracticeTarget(runId, 10),
    },
    {
      name: "finishPracticeRun",
      method: "POST",
      url: `http://api.test/practice/runs/${runId}/finish`,
      body: null,
      answer: { ...run, finishedAt: stamp },
      value: { ...run, finishedAt: stamp },
      run: (data) => data.finishPracticeRun(runId),
    },
  ];

  for (const entry of calls) {
    describe(entry.name, () => {
      it("returns the parsed value", async () => {
        const { data, seen } = setup(reply(entry.answer));
        expect(await entry.run(data)).toEqual({ ok: true, value: entry.value });
        expect(seen[0].method).toBe(entry.method);
        expect(seen[0].url).toBe(entry.url);
        expect(JSON.parse(seen[0].body ?? "null")).toEqual(entry.body);
      });

      it("fails as not_found for another user's run", async () => {
        const { data } = setup(reply({ error: "not_found" }, 404));
        expect(await entry.run(data)).toEqual({ ok: false, failure: "not_found" });
      });

      it("fails as unauthorized on 401", async () => {
        const { data } = setup(reply({ error: "unauthorized" }, 401));
        expect(await entry.run(data)).toEqual({ ok: false, failure: "unauthorized" });
      });

      it("fails as network on a thrown fetch", async () => {
        const { data } = setup(new TypeError("Network request failed"));
        expect(await entry.run(data)).toEqual({ ok: false, failure: "network" });
      });

      it("fails as network on the deadline", async () => {
        const hang = jest.fn(
          (_input: RequestInfo | URL, init?: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
            }),
        );
        const data = createHonoData({
          baseUrl: "http://api.test",
          fetchFn: hang as unknown as typeof fetch,
          readToken: async () => ({ ok: true, token: "token-1" }),
          timeoutMs: 20,
        });
        expect(await entry.run(data)).toEqual({ ok: false, failure: "network" });
      });

      it("fails as bad_response on a wrong shape", async () => {
        const { data } = setup(reply({ id }));
        expect(await entry.run(data)).toEqual({ ok: false, failure: "bad_response" });
      });
    });
  }

  it("getTodayPractice returns null with no run today", async () => {
    const { data } = setup(reply({ run: null }));
    expect(await data.getTodayPractice("UTC")).toEqual({ ok: true, value: null });
  });

  it("listRecentPrompts returns [] when the API answers no items", async () => {
    const { data } = setup(reply({ items: [] }));
    expect(await data.listRecentPrompts(7, 40)).toEqual({ ok: true, value: [] });
  });

  it("openPracticeRun returns a run with no items", async () => {
    const { data } = setup(reply({ run, items: [] }));
    expect(await data.openPracticeRun(runId)).toEqual({ ok: true, value: { run, items: [] } });
  });

  it("addPracticeItems returns every item of the run when the save repeats", async () => {
    const second = { ...item, id: "second", position: 1 };
    const { data } = setup(reply({ items: [item, second] }));
    expect(await data.addPracticeItems(runId, [created])).toEqual({
      ok: true,
      value: [item, second],
    });
  });

  it("the writes answer the saved row; a write has no expected empty", async () => {
    const { data } = setup(reply({ ...run, finishedAt: stamp }));
    expect(await data.finishPracticeRun(runId)).toMatchObject({
      ok: true,
      value: { finishedAt: stamp },
    });
  });
});

describe("the note calls", () => {
  const draft = {
    kind: "table" as const,
    title: "Future forms",
    topic: "Going to, will",
    sessionId: id,
    content: {
      columns: ["Form", "When", "Example"] as [string, string, string],
      rows: [["going to", "plans", "I'm going to study."]] as [string, string, string][],
      remember: "Plans use going to.",
    },
  };
  const page = {
    items: [
      { id, kind: "table", title: "Future forms", topic: "Going to, will", day: "2026-11-05" },
    ],
    nextOffset: 20,
    today: "2026-11-07",
  };
  const empty = { items: [], nextOffset: null, today: "2026-11-07" };

  async function hang(call: (data: DataPort) => Promise<unknown>) {
    const never = jest.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const data = createHonoData({
      baseUrl: "http://api.test",
      fetchFn: never as unknown as typeof fetch,
      readToken: async () => ({ ok: true, token: "token-1" }),
      timeoutMs: 20,
    });
    return call(data);
  }

  const calls: { name: string; run: (data: DataPort) => Promise<unknown>; body: unknown }[] = [
    { name: "createNote", run: (data) => data.createNote(draft), body: storedNote },
    { name: "getNote", run: (data) => data.getNote(id), body: storedNote },
    { name: "deleteNote", run: (data) => data.deleteNote(id), body: { id } },
    { name: "listNotes", run: (data) => data.listNotes("UTC", 0), body: page },
  ];

  it("posts the note to /notes and returns the stored note", async () => {
    const { data, seen } = setup(reply(storedNote, 201));
    expect(await data.createNote(draft)).toEqual({ ok: true, value: storedNote });
    expect(seen[0].method).toBe("POST");
    expect(seen[0].url).toBe("http://api.test/notes");
    expect(JSON.parse(seen[0].body ?? "null")).toEqual(draft);
  });

  it("reads a note from /notes/:id", async () => {
    const { data, seen } = setup(reply(storedNote));
    expect(await data.getNote(id)).toEqual({ ok: true, value: storedNote });
    expect(seen[0].method).toBe("GET");
    expect(seen[0].url).toBe(`http://api.test/notes/${id}`);
  });

  it("deletes a note at /notes/:id and returns its id", async () => {
    const { data, seen } = setup(reply({ id }));
    expect(await data.deleteNote(id)).toEqual({ ok: true, value: { id } });
    expect(seen[0].method).toBe("DELETE");
    expect(seen[0].url).toBe(`http://api.test/notes/${id}`);
  });

  it("sends the zone and the offset and returns the page of notes", async () => {
    const { data, seen } = setup(reply(page));
    expect(await data.listNotes("UTC", 20)).toEqual({ ok: true, value: page });
    expect(seen[0].url).toBe("http://api.test/progress/notes?tz=UTC&offset=20");
    expect(seen[0].method).toBe("GET");
  });

  it("returns an empty page of notes as a success", async () => {
    const { data } = setup(reply(empty));
    expect(await data.listNotes("UTC", 0)).toEqual({ ok: true, value: empty });
  });

  for (const call of calls) {
    it(`${call.name} returns not_found on 404`, async () => {
      const { data } = setup(reply({ error: "not_found" }, 404));
      expect(await call.run(data)).toEqual({ ok: false, failure: "not_found" });
    });

    it(`${call.name} returns unauthorized on 401`, async () => {
      const { data } = setup(reply({ error: "unauthorized" }, 401));
      expect(await call.run(data)).toEqual({ ok: false, failure: "unauthorized" });
    });

    it(`${call.name} returns network when the fetch rejects`, async () => {
      const { data } = setup(new TypeError("network down"));
      expect(await call.run(data)).toEqual({ ok: false, failure: "network" });
    });

    it(`${call.name} returns network on a timeout`, async () => {
      expect(await hang(call.run)).toEqual({ ok: false, failure: "network" });
    });

    it(`${call.name} returns bad_response for a body of the wrong shape`, async () => {
      const { data } = setup(reply({ nope: true }));
      expect(await call.run(data)).toEqual({ ok: false, failure: "bad_response" });
    });
  }
});
