// apps/mobile/test/data/hono-data.test.ts
//
// Tests for the Hono data adapter.
//
// Tested:
// - Every call sends the token as a Bearer header to the API url
// - A failed token read is returned without calling the API
// - Each call: success, expected empty, 400/401/404, network failure, bad body
// - The chat calls: createSession with a starter, openSession, addMessage, addUsage,
//   endSession and getMonthSpend
// - listOpenSessions and deleteSession
// - getSessionSummary
// - getProfileStats and deleteAccount
// - getMonthProgress, listHistory, listMistakes and listWords
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/data/hono-data.test.ts
//
// SEE: apps/mobile/src/data/hono-data.ts

import { describe, expect, it, jest } from "@jest/globals";

import type { MessageCreate } from "@fluency-lab/shared";

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
    const { data, seen } = setup(reply({ session, messages: [message] }));

    expect(await data.openSession(id)).toEqual({
      ok: true,
      value: { session, messages: [message] },
    });
    expect(seen[0].method).toBe("GET");
    expect(seen[0].url).toBe(`http://api.test/sessions/${id}/messages`);
  });

  it("returns a session with no messages as a success", async () => {
    const { data } = setup(reply({ session, messages: [] }));
    expect(await data.openSession(id)).toEqual({ ok: true, value: { session, messages: [] } });
  });

  it("returns saved corrections and new words", async () => {
    const saved = {
      ...message,
      corrections: { items: [{ original: "a", corrected: "b" }], explanation: "Because." },
      newWords: ["word"],
    };
    const { data } = setup(reply({ session, messages: [saved] }));
    expect(await data.openSession(id)).toEqual({
      ok: true,
      value: { session, messages: [saved] },
    });
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
  const week = { weekStart: "2026-11-02", today: "2026-11-05", days: ["2026-11-02"] };

  it("sends the time zone and returns the parsed week", async () => {
    const { data, seen } = setup(reply(week));

    expect(await data.getSessionWeek("America/Argentina/Buenos_Aires")).toEqual({
      ok: true,
      value: week,
    });
    expect(seen[0].url).toBe("http://api.test/sessions/week?tz=America%2FArgentina%2FBuenos_Aires");
    expect(seen[0].method).toBe("GET");
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
