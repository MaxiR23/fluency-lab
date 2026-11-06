// apps/api/test/supabase-store.test.ts
//
// Tests for the Supabase store adapter and its config reader.
//
// Tested:
// - storeConfigFromEnv reads and validates the environment
// - Every request carries the caller's token and the publishable key
// - Each store call: success, expected empty, 401, transport failure, bad row
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec vitest run apps/api/test/supabase-store.test.ts
//
// SEE: apps/api/src/supabase-store.ts

import { describe, expect, it } from "vitest";
import { createSupabaseStore, storeConfigFromEnv } from "../src/supabase-store";
import { generatedSecret } from "./helpers/generated-secret";

const id = "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e6f";
const sessionId = "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ea1";
const stamp = "2026-01-01T10:00:00+00:00";
const publishableKey = generatedSecret("publishable");
const accessToken = generatedSecret("access");

const profileRow = {
  id,
  display_name: "Ada",
  level: "beginner",
  goals: [],
  topics: [],
  monthly_limit_usd: null,
  provider: null,
  onboarding_completed_at: null,
  created_at: stamp,
  updated_at: stamp,
};
const sessionRow = {
  id: sessionId,
  user_id: id,
  topic_id: null,
  title: "Free chat",
  status: "active",
  summary: null,
  cost_usd: 0,
  created_at: stamp,
  updated_at: stamp,
};
const messageRow = (n: number) => ({
  id: `6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ec${n}`,
  session_id: sessionId,
  role: "user",
  text: `m${n}`,
  corrections: null,
  new_words: null,
  created_at: stamp,
});

type Recorded = { url: URL; method: string; headers: Headers; body: string | null };
type Answer = Response | Error;

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function failure(status: number) {
  return new Response(JSON.stringify({ message: "nope", code: "X" }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Answers the requests in order and records each one.
function setup(answers: Answer[], timeoutMs?: number) {
  const requests: Recorded[] = [];
  const queue = [...answers];
  const fetchFn: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push({
      url: new URL(request.url),
      method: request.method,
      headers: request.headers,
      body: init?.body === undefined || init.body === null ? null : String(init.body),
    });
    const next = queue.shift();
    if (next === undefined) throw new Error("unexpected request");
    if (next instanceof Error) throw next;
    return next;
  };
  const config = {
    url: "http://db.test",
    publishableKey,
    fetchFn,
    now: () => new Date("2026-02-03T04:05:06.000Z"),
  };
  const user = createSupabaseStore(config, timeoutMs).forUser({ id, accessToken });
  return { user, requests };
}

describe("storeConfigFromEnv", () => {
  const fetchFn: typeof fetch = async () => new Response();

  it("reads the url and the publishable key", () => {
    const config = storeConfigFromEnv(
      { SUPABASE_URL: "http://db.test", SUPABASE_PUBLISHABLE_KEY: publishableKey },
      fetchFn,
    );
    expect(config.url).toBe("http://db.test");
    expect(config.publishableKey).toBe(publishableKey);
  });

  it("throws naming SUPABASE_URL when it is missing", () => {
    expect(() => storeConfigFromEnv({ SUPABASE_PUBLISHABLE_KEY: publishableKey }, fetchFn)).toThrow(
      "Missing SUPABASE_URL",
    );
  });

  it("throws naming SUPABASE_PUBLISHABLE_KEY when it is missing", () => {
    expect(() => storeConfigFromEnv({ SUPABASE_URL: "http://db.test" }, fetchFn)).toThrow(
      "Missing SUPABASE_PUBLISHABLE_KEY",
    );
  });

  it("treats a blank key as missing", () => {
    expect(() =>
      storeConfigFromEnv(
        { SUPABASE_URL: "http://db.test", SUPABASE_PUBLISHABLE_KEY: "  " },
        fetchFn,
      ),
    ).toThrow("Missing SUPABASE_PUBLISHABLE_KEY");
  });

  it("drops a trailing slash", () => {
    const config = storeConfigFromEnv(
      { SUPABASE_URL: "http://db.test/", SUPABASE_PUBLISHABLE_KEY: publishableKey },
      fetchFn,
    );
    expect(config.url).toBe("http://db.test");
  });

  it("does not put a value in the error message", () => {
    try {
      storeConfigFromEnv({ SUPABASE_URL: "http://secret-host.test" }, fetchFn);
    } catch (error) {
      expect(String(error)).not.toContain("secret-host");
    }
    expect.assertions(1);
  });
});

describe("the request", () => {
  it("sends the caller's token as Authorization and the publishable key as apikey", async () => {
    const { user, requests } = setup([ok([profileRow])]);

    await user.getProfile();

    expect(requests[0].headers.get("Authorization")).toBe(`Bearer ${accessToken}`);
    expect(requests[0].headers.get("apikey")).toBe(publishableKey);
  });
});

describe("getProfile", () => {
  it("returns the caller's profile", async () => {
    const { user, requests } = setup([ok([profileRow])]);

    const outcome = await user.getProfile();

    expect(outcome).toMatchObject({
      ok: true,
      value: { id, displayName: "Ada", level: "beginner" },
    });
    expect(requests[0].url.pathname).toBe("/rest/v1/profiles");
    expect(requests[0].url.searchParams.get("id")).toBe(`eq.${id}`);
  });

  it("does not call ensure_profile when the row exists", async () => {
    const { user, requests } = setup([ok([profileRow])]);

    await user.getProfile();

    expect(requests).toHaveLength(1);
  });

  it("creates the missing profile through ensure_profile and returns it", async () => {
    const { user, requests } = setup([ok([]), ok([profileRow])]);

    const outcome = await user.getProfile();

    expect(outcome).toMatchObject({ ok: true, value: { id, displayName: "Ada" } });
    expect(requests).toHaveLength(2);
    expect(requests[1].method).toBe("POST");
    expect(requests[1].url.pathname).toBe("/rest/v1/rpc/ensure_profile");
  });

  it("returns unavailable when ensure_profile returns no row", async () => {
    const { user } = setup([ok([]), ok([])]);
    expect(await user.getProfile()).toEqual({ ok: false, failure: "unavailable" });
  });

  it("returns unauthorized when ensure_profile answers 401", async () => {
    const { user } = setup([ok([]), failure(401)]);
    expect(await user.getProfile()).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns unavailable for a bad row from ensure_profile", async () => {
    const { user } = setup([ok([]), ok([{ ...profileRow, level: "expert" }])]);
    expect(await user.getProfile()).toEqual({ ok: false, failure: "unavailable" });
  });

  it("returns unauthorized on a 401 from PostgREST", async () => {
    const { user } = setup([failure(401)]);
    expect(await user.getProfile()).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns unavailable on a server error", async () => {
    const { user } = setup([failure(500)]);
    expect(await user.getProfile()).toEqual({ ok: false, failure: "unavailable" });
  });

  it("returns unavailable when fetch rejects", async () => {
    const { user } = setup([new TypeError("network down")]);
    expect(await user.getProfile()).toEqual({ ok: false, failure: "unavailable" });
  });

  it("returns unavailable when the database does not answer before the deadline", async () => {
    const requests: number[] = [];
    const fetchFn: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        requests.push(1);
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    const user = createSupabaseStore(
      { url: "http://db.test", publishableKey, fetchFn, now: () => new Date() },
      20,
    ).forUser({ id, accessToken });

    expect(await user.getProfile()).toEqual({ ok: false, failure: "unavailable" });
    expect(requests).toHaveLength(1);
  });

  it("returns unavailable when the row does not match the row schema", async () => {
    const { user } = setup([ok([{ ...profileRow, level: "expert" }])]);
    expect(await user.getProfile()).toEqual({ ok: false, failure: "unavailable" });
  });
});

describe("updateProfile", () => {
  it("returns the updated profile and sends only the given columns", async () => {
    const { user, requests } = setup([ok([{ ...profileRow, level: "advanced" }])]);

    const outcome = await user.updateProfile({ level: "advanced" });

    expect(outcome).toMatchObject({ ok: true, value: { level: "advanced" } });
    expect(requests[0].method).toBe("PATCH");
    expect(JSON.parse(requests[0].body ?? "null")).toEqual({ level: "advanced" });
  });

  it("returns null when no row was updated", async () => {
    const { user } = setup([ok([])]);
    expect(await user.updateProfile({ level: "advanced" })).toEqual({ ok: true, value: null });
  });

  it("returns unauthorized on a 401", async () => {
    const { user } = setup([failure(401)]);
    expect(await user.updateProfile({ level: "advanced" })).toEqual({
      ok: false,
      failure: "unauthorized",
    });
  });

  it("returns unavailable when fetch rejects", async () => {
    const { user } = setup([new TypeError("network down")]);
    expect(await user.updateProfile({ level: "advanced" })).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });

  it("returns unavailable for a bad row", async () => {
    const { user } = setup([ok([{ id }])]);
    expect(await user.updateProfile({ level: "advanced" })).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });
});

describe("getActiveSession", () => {
  it("returns the latest active session with its last message", async () => {
    const { user, requests } = setup([ok([sessionRow]), ok([messageRow(1)])]);

    const outcome = await user.getActiveSession();

    expect(outcome).toMatchObject({
      ok: true,
      value: { session: { id: sessionId }, lastMessage: { text: "m1" } },
    });
    expect(requests[0].url.searchParams.get("status")).toBe("eq.active");
    expect(requests[1].url.searchParams.get("session_id")).toBe(`eq.${sessionId}`);
  });

  it("returns null when there is no active session", async () => {
    const { user, requests } = setup([ok([])]);

    expect(await user.getActiveSession()).toEqual({ ok: true, value: null });
    expect(requests).toHaveLength(1);
  });

  it("returns a session with a null last message when it has no messages", async () => {
    const { user } = setup([ok([sessionRow]), ok([])]);

    expect(await user.getActiveSession()).toMatchObject({
      ok: true,
      value: { session: { id: sessionId }, lastMessage: null },
    });
  });

  it("returns unauthorized on a 401", async () => {
    const { user } = setup([failure(401)]);
    expect(await user.getActiveSession()).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns unavailable when fetch rejects", async () => {
    const { user } = setup([new TypeError("network down")]);
    expect(await user.getActiveSession()).toEqual({ ok: false, failure: "unavailable" });
  });

  it("returns unavailable when the message request fails", async () => {
    const { user } = setup([ok([sessionRow]), failure(500)]);
    expect(await user.getActiveSession()).toEqual({ ok: false, failure: "unavailable" });
  });

  it("returns unavailable for a bad session row", async () => {
    const { user } = setup([ok([{ id: sessionId }])]);
    expect(await user.getActiveSession()).toEqual({ ok: false, failure: "unavailable" });
  });

  it("returns unavailable for a bad message row", async () => {
    const { user } = setup([ok([sessionRow]), ok([{ id }])]);
    expect(await user.getActiveSession()).toEqual({ ok: false, failure: "unavailable" });
  });
});

describe("createSession", () => {
  it("returns the created session", async () => {
    const { user, requests } = setup([ok({ ...sessionRow, topic_id: "food", title: "Food" }, 201)]);

    const outcome = await user.createSession({ topicId: "food", title: "Food" });

    expect(outcome).toMatchObject({ ok: true, value: { topicId: "food", title: "Food" } });
    expect(requests[0].method).toBe("POST");
    expect(JSON.parse(requests[0].body ?? "null")).toEqual({
      user_id: id,
      topic_id: "food",
      title: "Food",
    });
  });

  it("returns unauthorized on a 401", async () => {
    const { user } = setup([failure(401)]);
    expect(await user.createSession({ topicId: null, title: "Free chat" })).toEqual({
      ok: false,
      failure: "unauthorized",
    });
  });

  it("returns unavailable on a check violation", async () => {
    const { user } = setup([failure(400)]);
    expect(await user.createSession({ topicId: null, title: "Free chat" })).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });

  it("returns unavailable when fetch rejects", async () => {
    const { user } = setup([new TypeError("network down")]);
    expect(await user.createSession({ topicId: null, title: "Free chat" })).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });

  it("returns unavailable for a bad row", async () => {
    const { user } = setup([ok({ id: sessionId }, 201)]);
    expect(await user.createSession({ topicId: null, title: "Free chat" })).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });
});

describe("listMessages", () => {
  it("returns the messages oldest first", async () => {
    const { user, requests } = setup([ok([{ id: sessionId }]), ok([messageRow(1), messageRow(2)])]);

    const outcome = await user.listMessages(sessionId);

    expect(outcome.ok && outcome.value?.map((m) => m.text)).toEqual(["m1", "m2"]);
    expect(requests[1].url.searchParams.get("order")).toBe("created_at.asc");
  });

  it("returns an empty list for a session with no messages", async () => {
    const { user } = setup([ok([{ id: sessionId }]), ok([])]);
    expect(await user.listMessages(sessionId)).toEqual({ ok: true, value: [] });
  });

  it("returns null when the session is not visible", async () => {
    const { user, requests } = setup([ok([])]);

    expect(await user.listMessages(sessionId)).toEqual({ ok: true, value: null });
    expect(requests).toHaveLength(1);
  });

  it("returns unauthorized on a 401", async () => {
    const { user } = setup([failure(401)]);
    expect(await user.listMessages(sessionId)).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns unavailable when fetch rejects", async () => {
    const { user } = setup([new TypeError("network down")]);
    expect(await user.listMessages(sessionId)).toEqual({ ok: false, failure: "unavailable" });
  });

  it("returns unavailable when the messages request fails", async () => {
    const { user } = setup([ok([{ id: sessionId }]), failure(500)]);
    expect(await user.listMessages(sessionId)).toEqual({ ok: false, failure: "unavailable" });
  });

  it("returns unavailable for a bad message row", async () => {
    const { user } = setup([ok([{ id: sessionId }]), ok([{ id }])]);
    expect(await user.listMessages(sessionId)).toEqual({ ok: false, failure: "unavailable" });
  });
});

describe("listSessionStarts", () => {
  const since = "2026-10-28T12:00:00.000Z";

  it("returns the start of each session since the given time, oldest first", async () => {
    const { user, requests } = setup([
      ok([
        { created_at: "2026-11-02T10:00:00+00:00" },
        { created_at: "2026-11-04T10:00:00+00:00" },
      ]),
    ]);

    const outcome = await user.listSessionStarts(since);

    expect(outcome).toEqual({
      ok: true,
      value: ["2026-11-02T10:00:00+00:00", "2026-11-04T10:00:00+00:00"],
    });
    expect(requests[0].url.pathname).toBe("/rest/v1/sessions");
    expect(requests[0].url.searchParams.get("select")).toBe("created_at");
    expect(requests[0].url.searchParams.get("created_at")).toBe(`gte.${since}`);
    expect(requests[0].url.searchParams.get("order")).toBe("created_at.asc");
  });

  it("returns an empty list when there are no sessions", async () => {
    const { user } = setup([ok([])]);
    expect(await user.listSessionStarts(since)).toEqual({ ok: true, value: [] });
  });

  it("returns unauthorized on a 401", async () => {
    const { user } = setup([failure(401)]);
    expect(await user.listSessionStarts(since)).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns unavailable when fetch rejects", async () => {
    const { user } = setup([new TypeError("network down")]);
    expect(await user.listSessionStarts(since)).toEqual({ ok: false, failure: "unavailable" });
  });

  it("returns unavailable for a bad row", async () => {
    const { user } = setup([ok([{ id }])]);
    expect(await user.listSessionStarts(since)).toEqual({ ok: false, failure: "unavailable" });
  });
});
