// apps/mobile/test/data/hono-data.test.ts
//
// Tests for the Hono data adapter.
//
// Tested:
// - Every call sends the token as a Bearer header to the API url
// - A failed token read is returned without calling the API
// - Each call: success, expected empty, 400/401/404, network failure, bad body
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/data/hono-data.test.ts
//
// SEE: apps/mobile/src/data/hono-data.ts

import { describe, expect, it, jest } from "@jest/globals";

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

describe("listMessages", () => {
  it("returns the messages of the session", async () => {
    const { data, seen } = setup(reply({ messages: [message] }));

    expect(await data.listMessages(id)).toEqual({ ok: true, value: [message] });
    expect(seen[0].url).toBe(`http://api.test/sessions/${id}/messages`);
  });

  it("returns an empty list as a success", async () => {
    const { data } = setup(reply({ messages: [] }));
    expect(await data.listMessages(id)).toEqual({ ok: true, value: [] });
  });

  it("returns not_found on 404", async () => {
    const { data } = setup(reply({ error: "not_found" }, 404));
    expect(await data.listMessages(id)).toEqual({ ok: false, failure: "not_found" });
  });

  it("returns unauthorized on 401", async () => {
    const { data } = setup(reply({ error: "unauthorized" }, 401));
    expect(await data.listMessages(id)).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns network when fetch rejects", async () => {
    const { data } = setup(new TypeError("Network request failed"));
    expect(await data.listMessages(id)).toEqual({ ok: false, failure: "network" });
  });

  it("returns bad_response for the wrong shape", async () => {
    const { data } = setup(reply({ messages: "none" }));
    expect(await data.listMessages(id)).toEqual({ ok: false, failure: "bad_response" });
  });
});
