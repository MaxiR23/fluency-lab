// apps/api/test/supabase-store.test.ts
//
// Tests for the Supabase store adapter and its config reader.
//
// Tested:
// - storeConfigFromEnv reads and validates the environment
// - Every request carries the caller's token and the publishable key
// - listOpenSessions reads active sessions newest first with their newest message in one request; deleteSession deletes by id
// - listSessionCostsSince reads the sessions, deleted_session_costs and practice_runs and returns all three
// - addPracticeChecks inserts the check rows of a visible run into practice_checks without user_id
// - The practice methods read and write practice_runs and practice_items (listFinishedRunsSince reads the finished runs with their item verdicts, listRecentPrompts reads the caller's items newest first through their runs) and call add_practice_cost with the caller's token
// - getStats calls profile_stats with the caller's token; deleteAccount deletes the caller through the admin API with the secret key and never the caller's token
// - getMonthProgress, listEndedSessions, listMistakeGroups and listNewWords call their progress_* function with the caller's token
// - getThread, addThreadMessage, withdrawCorrections, listThreadCounts and listThreadWords read and write the thread table and its functions with the caller's token, and getSessionWithMessages never reads thread rows
// - setSessionTitle calls set_session_title with the caller's token
// - createNote, getNote, deleteNote, listNotes and listSessionNotes read and write study_notes with the caller's token
// - Each store call: success, expected empty, 401, transport failure, bad row
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec vitest run apps/api/test/supabase-store.test.ts
//
// SEE: apps/api/src/supabase-store.ts

import type { MessageCreate, PracticeCheckCreate, ThreadMessageCreate } from "@fluency-lab/shared";
import { describe, expect, it } from "vitest";
import { createSupabaseStore, storeConfigFromEnv } from "../src/supabase-store";
import { generatedSecret } from "./helpers/generated-secret";

const id = "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e6f";
const sessionId = "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ea1";
const stamp = "2026-01-01T10:00:00+00:00";
const publishableKey = generatedSecret("publishable");
const accessToken = generatedSecret("access");
const secretKey = generatedSecret("secret");

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
  context_summary: null,
  context_through_id: null,
  title_source: "default",
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
  reply_to_id: null,
  note_id: null,
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
    secretKey,
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
      {
        SUPABASE_URL: "http://db.test",
        SUPABASE_PUBLISHABLE_KEY: publishableKey,
        SUPABASE_SECRET_KEY: secretKey,
      },
      fetchFn,
    );
    expect(config.url).toBe("http://db.test");
    expect(config.publishableKey).toBe(publishableKey);
  });

  it("reads the secret key", () => {
    const config = storeConfigFromEnv(
      {
        SUPABASE_URL: "http://db.test",
        SUPABASE_PUBLISHABLE_KEY: publishableKey,
        SUPABASE_SECRET_KEY: secretKey,
      },
      fetchFn,
    );
    expect(config.secretKey).toBe(secretKey);
  });

  it("throws naming SUPABASE_SECRET_KEY when it is missing", () => {
    expect(() =>
      storeConfigFromEnv(
        { SUPABASE_URL: "http://db.test", SUPABASE_PUBLISHABLE_KEY: publishableKey },
        fetchFn,
      ),
    ).toThrow("Missing SUPABASE_SECRET_KEY");
  });

  it("throws naming SUPABASE_URL when it is missing", () => {
    expect(() =>
      storeConfigFromEnv(
        { SUPABASE_PUBLISHABLE_KEY: publishableKey, SUPABASE_SECRET_KEY: secretKey },
        fetchFn,
      ),
    ).toThrow("Missing SUPABASE_URL");
  });

  it("throws naming SUPABASE_PUBLISHABLE_KEY when it is missing", () => {
    expect(() =>
      storeConfigFromEnv(
        { SUPABASE_URL: "http://db.test", SUPABASE_SECRET_KEY: secretKey },
        fetchFn,
      ),
    ).toThrow("Missing SUPABASE_PUBLISHABLE_KEY");
  });

  it("treats a blank key as missing", () => {
    expect(() =>
      storeConfigFromEnv(
        {
          SUPABASE_URL: "http://db.test",
          SUPABASE_PUBLISHABLE_KEY: "  ",
          SUPABASE_SECRET_KEY: secretKey,
        },
        fetchFn,
      ),
    ).toThrow("Missing SUPABASE_PUBLISHABLE_KEY");
  });

  it("drops a trailing slash", () => {
    const config = storeConfigFromEnv(
      {
        SUPABASE_URL: "http://db.test/",
        SUPABASE_PUBLISHABLE_KEY: publishableKey,
        SUPABASE_SECRET_KEY: secretKey,
      },
      fetchFn,
    );
    expect(config.url).toBe("http://db.test");
  });

  it("does not put a value in the error message", () => {
    try {
      storeConfigFromEnv(
        { SUPABASE_URL: "http://secret-host.test", SUPABASE_SECRET_KEY: secretKey },
        fetchFn,
      );
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

  it("never sends the secret key on a user request", async () => {
    const { user, requests } = setup([ok([profileRow])]);

    await user.getProfile();

    for (const header of requests[0].headers.values()) expect(header).not.toContain(secretKey);
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
      { url: "http://db.test", publishableKey, secretKey, fetchFn, now: () => new Date() },
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

describe("getSessionWithMessages", () => {
  it("returns the session and its messages oldest first", async () => {
    const { user, requests } = setup([ok([sessionRow]), ok([messageRow(1), messageRow(2)])]);

    const outcome = await user.getSessionWithMessages(sessionId);

    expect(outcome.ok && outcome.value?.session.id).toBe(sessionId);
    expect(outcome.ok && outcome.value?.messages.map((m) => m.text)).toEqual(["m1", "m2"]);
    expect(requests[1].url.searchParams.get("order")).toBe("created_at.asc");
  });

  it("returns the saved corrections and new words", async () => {
    const saved = {
      ...messageRow(1),
      corrections: { items: [{ original: "a", corrected: "b" }], explanation: null },
      new_words: ["word"],
    };
    const { user } = setup([ok([sessionRow]), ok([saved])]);

    const outcome = await user.getSessionWithMessages(sessionId);

    expect(outcome.ok && outcome.value?.messages[0]).toMatchObject({
      corrections: { items: [{ original: "a", corrected: "b" }], explanation: null },
      newWords: ["word"],
    });
  });

  it("returns no messages for a session with none", async () => {
    const { user } = setup([ok([sessionRow]), ok([])]);
    const outcome = await user.getSessionWithMessages(sessionId);
    expect(outcome.ok && outcome.value?.messages).toEqual([]);
  });

  it("returns null when the session is not visible", async () => {
    const { user, requests } = setup([ok([])]);

    expect(await user.getSessionWithMessages(sessionId)).toEqual({ ok: true, value: null });
    expect(requests).toHaveLength(1);
  });

  it("returns unauthorized on a 401", async () => {
    const { user } = setup([failure(401)]);
    expect(await user.getSessionWithMessages(sessionId)).toEqual({
      ok: false,
      failure: "unauthorized",
    });
  });

  it("returns unavailable when fetch rejects", async () => {
    const { user } = setup([new TypeError("network down")]);
    expect(await user.getSessionWithMessages(sessionId)).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });

  it("returns unavailable when the messages request fails", async () => {
    const { user } = setup([ok([sessionRow]), failure(500)]);
    expect(await user.getSessionWithMessages(sessionId)).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });

  it("returns unavailable for a bad session row or a bad message row", async () => {
    const badSession = setup([ok([{ id: sessionId }])]);
    expect(await badSession.user.getSessionWithMessages(sessionId)).toEqual({
      ok: false,
      failure: "unavailable",
    });
    const badMessage = setup([ok([sessionRow]), ok([{ id }])]);
    expect(await badMessage.user.getSessionWithMessages(sessionId)).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });
});

describe("addMessage", () => {
  const input: MessageCreate = {
    role: "user",
    text: "I never been",
    corrections: {
      items: [{ original: "I never been", corrected: "I've never been" }],
      explanation: "Use the present perfect.",
    },
    newWords: ["definitely"],
  };

  it("inserts the message with its corrections and new words", async () => {
    const saved = {
      ...messageRow(1),
      text: input.text,
      corrections: input.corrections,
      new_words: input.newWords,
    };
    const { user, requests } = setup([ok([sessionRow]), ok(saved, 201)]);

    const outcome = await user.addMessage(sessionId, input);

    expect(outcome).toMatchObject({
      ok: true,
      value: { text: "I never been", newWords: ["definitely"] },
    });
    expect(requests[1].method).toBe("POST");
    expect(requests[1].url.pathname).toBe("/rest/v1/messages");
    expect(JSON.parse(requests[1].body ?? "null")).toEqual({
      session_id: sessionId,
      role: "user",
      text: "I never been",
      corrections: input.corrections,
      new_words: ["definitely"],
      reply_to_id: null,
      note_id: null,
    });
  });

  it("inserts the message with the id of the message it replies to", async () => {
    const replyToId = "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ec9";
    const { user, requests } = setup([
      ok([sessionRow]),
      ok({ ...messageRow(1), reply_to_id: replyToId }, 201),
    ]);

    const outcome = await user.addMessage(sessionId, { role: "user", text: "Hi", replyToId });

    expect(outcome).toMatchObject({ ok: true, value: { replyToId } });
    expect(JSON.parse(requests[1].body ?? "null")).toEqual({
      session_id: sessionId,
      role: "user",
      text: "Hi",
      corrections: null,
      new_words: null,
      reply_to_id: replyToId,
      note_id: null,
    });
  });

  it("returns unavailable when the reply points to a message outside the session", async () => {
    const rejected = new Response(
      JSON.stringify({
        code: "23503",
        message:
          'insert or update on table "messages" violates foreign key constraint "messages_reply_to_fkey"',
      }),
      { status: 409, headers: { "Content-Type": "application/json" } },
    );
    const { user } = setup([ok([sessionRow]), rejected]);

    const outcome = await user.addMessage(sessionId, {
      role: "user",
      text: "Hi",
      replyToId: "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ec9",
    });

    expect(outcome).toEqual({ ok: false, failure: "unavailable" });
  });

  it("inserts nulls for a message without corrections or new words", async () => {
    const { user, requests } = setup([ok([sessionRow]), ok(messageRow(1), 201)]);

    await user.addMessage(sessionId, { role: "tutor", text: "Hi" });

    expect(JSON.parse(requests[1].body ?? "null")).toEqual({
      session_id: sessionId,
      role: "tutor",
      text: "Hi",
      corrections: null,
      new_words: null,
      reply_to_id: null,
      note_id: null,
    });
  });

  it("inserts the id of the note the message came with", async () => {
    const noteId = "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ef1";
    const { user, requests } = setup([
      ok([sessionRow]),
      ok({ ...messageRow(1), note_id: noteId }, 201),
    ]);
    const outcome = await user.addMessage(sessionId, { role: "tutor", text: "Hi", noteId });
    expect(outcome).toMatchObject({ ok: true, value: { noteId } });
    expect(JSON.parse(requests[1].body ?? "null")).toMatchObject({ note_id: noteId });
  });

  it("returns null when the session is not visible", async () => {
    const { user, requests } = setup([ok([])]);
    expect(await user.addMessage(sessionId, input)).toEqual({ ok: true, value: null });
    expect(requests).toHaveLength(1);
  });

  it("returns unauthorized on a 401", async () => {
    const { user } = setup([ok([sessionRow]), failure(401)]);
    expect(await user.addMessage(sessionId, input)).toEqual({
      ok: false,
      failure: "unauthorized",
    });
  });

  it("returns unavailable when fetch rejects", async () => {
    const { user } = setup([new TypeError("network down")]);
    expect(await user.addMessage(sessionId, input)).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });

  it("returns unavailable for a bad row", async () => {
    const { user } = setup([ok([sessionRow]), ok({ id }, 201)]);
    expect(await user.addMessage(sessionId, input)).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });
});

describe("addSessionCost", () => {
  it("adds the amount through add_session_cost and returns the session", async () => {
    const { user, requests } = setup([ok([{ ...sessionRow, cost_usd: 0.000145 }])]);

    const outcome = await user.addSessionCost(sessionId, 0.000145);

    expect(outcome).toMatchObject({ ok: true, value: { id: sessionId, costUsd: 0.000145 } });
    expect(requests[0].method).toBe("POST");
    expect(requests[0].url.pathname).toBe("/rest/v1/rpc/add_session_cost");
    expect(JSON.parse(requests[0].body ?? "null")).toEqual({
      session_id: sessionId,
      amount_usd: 0.000145,
    });
  });

  it("adds a zero amount", async () => {
    const { user, requests } = setup([ok([sessionRow])]);
    const outcome = await user.addSessionCost(sessionId, 0);
    expect(outcome).toMatchObject({ ok: true, value: { costUsd: 0 } });
    expect(JSON.parse(requests[0].body ?? "null")).toEqual({
      session_id: sessionId,
      amount_usd: 0,
    });
  });

  it("returns null when the session is not visible", async () => {
    const { user } = setup([ok([])]);
    expect(await user.addSessionCost(sessionId, 1)).toEqual({ ok: true, value: null });
  });

  it("returns unauthorized on a 401", async () => {
    const { user } = setup([failure(401)]);
    expect(await user.addSessionCost(sessionId, 1)).toEqual({
      ok: false,
      failure: "unauthorized",
    });
  });

  it("returns unavailable when fetch rejects", async () => {
    const { user } = setup([new TypeError("network down")]);
    expect(await user.addSessionCost(sessionId, 1)).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });

  it("returns unavailable for a bad row", async () => {
    const { user } = setup([ok([{ id }])]);
    expect(await user.addSessionCost(sessionId, 1)).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });
});

describe("setSessionTitle", () => {
  it("sets the title through set_session_title and returns the session", async () => {
    const { user, requests } = setup([
      ok([{ ...sessionRow, title: "Ramen spots in Tokyo", title_source: "auto" }]),
    ]);

    const outcome = await user.setSessionTitle(sessionId, {
      title: "Ramen spots in Tokyo",
      source: "auto",
    });

    expect(outcome).toMatchObject({
      ok: true,
      value: { id: sessionId, title: "Ramen spots in Tokyo", titleSource: "auto" },
    });
    expect(requests[0].method).toBe("POST");
    expect(requests[0].url.pathname).toBe("/rest/v1/rpc/set_session_title");
    expect(JSON.parse(requests[0].body ?? "null")).toEqual({
      session_id: sessionId,
      new_title: "Ramen spots in Tokyo",
      source: "auto",
    });
  });

  it("returns null when the session is not visible", async () => {
    const { user } = setup([ok([])]);
    expect(await user.setSessionTitle(sessionId, { title: "Ramen", source: "user" })).toEqual({
      ok: true,
      value: null,
    });
  });

  it("returns unauthorized on a 401", async () => {
    const { user } = setup([failure(401)]);
    expect(await user.setSessionTitle(sessionId, { title: "Ramen", source: "user" })).toEqual({
      ok: false,
      failure: "unauthorized",
    });
  });

  it("returns unavailable when fetch rejects", async () => {
    const { user } = setup([new TypeError("network down")]);
    expect(await user.setSessionTitle(sessionId, { title: "Ramen", source: "user" })).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });

  it("returns unavailable for a row of the wrong shape", async () => {
    const { user } = setup([ok([{ id }])]);
    expect(await user.setSessionTitle(sessionId, { title: "Ramen", source: "user" })).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });
});

describe("endSession", () => {
  it("sets the status to ended and returns the session", async () => {
    const { user, requests } = setup([ok([{ ...sessionRow, status: "ended" }])]);

    const outcome = await user.endSession(sessionId);

    expect(outcome).toMatchObject({ ok: true, value: { status: "ended" } });
    expect(requests[0].method).toBe("PATCH");
    expect(requests[0].url.searchParams.get("id")).toBe(`eq.${sessionId}`);
    expect(JSON.parse(requests[0].body ?? "null")).toEqual({ status: "ended" });
  });

  it("returns null when the session is not visible", async () => {
    const { user } = setup([ok([])]);
    expect(await user.endSession(sessionId)).toEqual({ ok: true, value: null });
  });

  it("returns unauthorized on a 401", async () => {
    const { user } = setup([failure(401)]);
    expect(await user.endSession(sessionId)).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns unavailable when fetch rejects", async () => {
    const { user } = setup([new TypeError("network down")]);
    expect(await user.endSession(sessionId)).toEqual({ ok: false, failure: "unavailable" });
  });

  it("returns unavailable for a bad row", async () => {
    const { user } = setup([ok([{ id }])]);
    expect(await user.endSession(sessionId)).toEqual({ ok: false, failure: "unavailable" });
  });
});

describe("setSessionContext", () => {
  const context = { summary: "Lives in Lisbon.", throughId: id };

  it("patches the summary and the through id and returns the session", async () => {
    const { user, requests } = setup([
      ok([{ ...sessionRow, context_summary: context.summary, context_through_id: id }]),
    ]);

    const outcome = await user.setSessionContext(sessionId, context);

    expect(outcome).toMatchObject({
      ok: true,
      value: { contextSummary: "Lives in Lisbon.", contextThroughId: id },
    });
    expect(requests[0].method).toBe("PATCH");
    expect(requests[0].url.searchParams.get("id")).toBe(`eq.${sessionId}`);
    expect(JSON.parse(requests[0].body ?? "null")).toEqual({
      context_summary: "Lives in Lisbon.",
      context_through_id: id,
    });
  });

  it("returns null when the session is not visible", async () => {
    const { user } = setup([ok([])]);
    expect(await user.setSessionContext(sessionId, context)).toEqual({ ok: true, value: null });
  });

  it("returns unauthorized on a 401", async () => {
    const { user } = setup([failure(401)]);
    expect(await user.setSessionContext(sessionId, context)).toEqual({
      ok: false,
      failure: "unauthorized",
    });
  });

  it("returns unavailable when fetch rejects", async () => {
    const { user } = setup([new TypeError("network down")]);
    expect(await user.setSessionContext(sessionId, context)).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });

  it("returns unavailable for a bad row", async () => {
    const { user } = setup([ok([{ id }])]);
    expect(await user.setSessionContext(sessionId, context)).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });

  it("returns unavailable when the message is of another session", async () => {
    const { user } = setup([
      new Response(JSON.stringify({ message: "violates foreign key", code: "23503" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
    ]);
    expect(await user.setSessionContext(sessionId, context)).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });
});

describe("listOpenSessions", () => {
  it("returns the active sessions newest first, each with its newest message, in one request", async () => {
    const { user, requests } = setup([
      ok([
        { ...sessionRow, messages: [messageRow(1)] },
        { ...sessionRow, id: id, messages: [] },
      ]),
    ]);

    const outcome = await user.listOpenSessions();

    expect(outcome).toMatchObject({
      ok: true,
      value: [
        { session: { id: sessionId }, lastMessage: { text: "m1" } },
        { session: { id }, lastMessage: null },
      ],
    });
    expect(requests).toHaveLength(1);
    const params = requests[0].url.searchParams;
    expect(params.get("status")).toBe("eq.active");
    expect(params.get("order")).toBe("updated_at.desc");
    expect(params.get("messages.order")).toBe("created_at.desc");
    expect(params.get("messages.limit")).toBe("1");
    expect(params.get("select")).toBe("*,messages!messages_session_id_fkey(*)");
  });

  it("returns an empty list when there is no open session", async () => {
    const { user } = setup([ok([])]);
    expect(await user.listOpenSessions()).toEqual({ ok: true, value: [] });
  });

  it("returns unauthorized on a 401", async () => {
    const { user } = setup([failure(401)]);
    expect(await user.listOpenSessions()).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns unavailable when fetch rejects", async () => {
    const { user } = setup([new TypeError("network down")]);
    expect(await user.listOpenSessions()).toEqual({ ok: false, failure: "unavailable" });
  });

  it("returns unavailable for a bad session row or a bad embedded message", async () => {
    const bad = setup([ok([{ id: sessionId, messages: [] }])]);
    expect(await bad.user.listOpenSessions()).toEqual({ ok: false, failure: "unavailable" });
    const badMessage = setup([ok([{ ...sessionRow, messages: [{ id }] }])]);
    expect(await badMessage.user.listOpenSessions()).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });
});

describe("deleteSession", () => {
  it("deletes the session by id and returns it", async () => {
    const { user, requests } = setup([ok([sessionRow])]);

    const outcome = await user.deleteSession(sessionId);

    expect(outcome).toMatchObject({ ok: true, value: { id: sessionId } });
    expect(requests[0].method).toBe("DELETE");
    expect(requests[0].url.searchParams.get("id")).toBe(`eq.${sessionId}`);
  });

  it("returns null when the session is not visible", async () => {
    const { user } = setup([ok([])]);
    expect(await user.deleteSession(sessionId)).toEqual({ ok: true, value: null });
  });

  it("returns unauthorized on a 401", async () => {
    const { user } = setup([failure(401)]);
    expect(await user.deleteSession(sessionId)).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns unavailable when fetch rejects", async () => {
    const { user } = setup([new TypeError("network down")]);
    expect(await user.deleteSession(sessionId)).toEqual({ ok: false, failure: "unavailable" });
  });

  it("returns unavailable for a bad row", async () => {
    const { user } = setup([ok([{ id }])]);
    expect(await user.deleteSession(sessionId)).toEqual({ ok: false, failure: "unavailable" });
  });
});

describe("listSessionCostsSince", () => {
  const since = "2026-10-05T12:00:00.000Z";

  it("reads sessions, deleted session costs and practice runs and returns all three", async () => {
    const { user, requests } = setup([
      ok([
        { created_at: "2026-11-02T10:00:00+00:00", cost_usd: 0.25 },
        { created_at: "2026-11-04T10:00:00+00:00", cost_usd: 0 },
      ]),
      ok([{ created_at: "2026-11-03T10:00:00+00:00", cost_usd: 0.5 }]),
      ok([{ created_at: "2026-11-05T10:00:00+00:00", cost_usd: 0.125 }]),
    ]);

    const outcome = await user.listSessionCostsSince(since);

    expect(outcome).toEqual({
      ok: true,
      value: [
        { createdAt: "2026-11-02T10:00:00+00:00", costUsd: 0.25 },
        { createdAt: "2026-11-04T10:00:00+00:00", costUsd: 0 },
        { createdAt: "2026-11-03T10:00:00+00:00", costUsd: 0.5 },
        { createdAt: "2026-11-05T10:00:00+00:00", costUsd: 0.125 },
      ],
    });
    expect(requests[0].url.pathname).toBe("/rest/v1/sessions");
    expect(requests[0].url.searchParams.get("select")).toBe("created_at,cost_usd");
    expect(requests[0].url.searchParams.get("created_at")).toBe(`gte.${since}`);
    expect(requests[1].url.pathname).toBe("/rest/v1/deleted_session_costs");
    expect(requests[1].url.searchParams.get("select")).toBe("created_at,cost_usd");
    expect(requests[1].url.searchParams.get("created_at")).toBe(`gte.${since}`);
    expect(requests[2].url.pathname).toBe("/rest/v1/practice_runs");
    expect(requests[2].url.searchParams.get("select")).toBe("created_at,cost_usd");
    expect(requests[2].url.searchParams.get("created_at")).toBe(`gte.${since}`);
  });

  it("keeps the cost of a deleted session when no session is left", async () => {
    const { user } = setup([
      ok([]),
      ok([{ created_at: "2026-11-03T10:00:00+00:00", cost_usd: 0.5 }]),
      ok([]),
    ]);
    expect(await user.listSessionCostsSince(since)).toEqual({
      ok: true,
      value: [{ createdAt: "2026-11-03T10:00:00+00:00", costUsd: 0.5 }],
    });
  });

  it("returns an empty list when there are no sessions, deleted costs or runs", async () => {
    const { user } = setup([ok([]), ok([]), ok([])]);
    expect(await user.listSessionCostsSince(since)).toEqual({ ok: true, value: [] });
  });

  it("returns unauthorized on a 401 from any read", async () => {
    expect(await setup([failure(401)]).user.listSessionCostsSince(since)).toEqual({
      ok: false,
      failure: "unauthorized",
    });
    expect(await setup([ok([]), failure(401)]).user.listSessionCostsSince(since)).toEqual({
      ok: false,
      failure: "unauthorized",
    });
    expect(await setup([ok([]), ok([]), failure(401)]).user.listSessionCostsSince(since)).toEqual({
      ok: false,
      failure: "unauthorized",
    });
  });

  it("fails when the practice read fails", async () => {
    expect(await setup([ok([]), ok([]), failure(500)]).user.listSessionCostsSince(since)).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });

  it("returns unavailable when fetch rejects on any read", async () => {
    const down = new TypeError("network down");
    expect(await setup([down]).user.listSessionCostsSince(since)).toEqual({
      ok: false,
      failure: "unavailable",
    });
    expect(await setup([ok([]), down]).user.listSessionCostsSince(since)).toEqual({
      ok: false,
      failure: "unavailable",
    });
    expect(await setup([ok([]), ok([]), down]).user.listSessionCostsSince(since)).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });

  it("returns unavailable for a bad row in any read", async () => {
    const bad = ok([{ created_at: "2026-11-02T10:00:00+00:00" }]);
    expect(await setup([bad]).user.listSessionCostsSince(since)).toEqual({
      ok: false,
      failure: "unavailable",
    });
    expect(await setup([ok([]), bad]).user.listSessionCostsSince(since)).toEqual({
      ok: false,
      failure: "unavailable",
    });
    expect(await setup([ok([]), ok([]), bad]).user.listSessionCostsSince(since)).toEqual({
      ok: false,
      failure: "unavailable",
    });
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

describe("listFinishedRunsSince", () => {
  const since = "2026-10-28T12:00:00.000Z";

  it("reads the finished runs with their item verdicts since the given time", async () => {
    const { user, requests } = setup([
      ok([
        {
          finished_at: "2026-11-02T10:00:00+00:00",
          practice_items: [{ correct: true }, { correct: null }],
        },
        {
          finished_at: "2026-11-04T10:00:00+00:00",
          practice_items: [{ correct: true }, { correct: false }],
        },
      ]),
    ]);

    const outcome = await user.listFinishedRunsSince(since);

    expect(outcome).toEqual({
      ok: true,
      value: [
        { finishedAt: "2026-11-02T10:00:00+00:00", missed: false },
        { finishedAt: "2026-11-04T10:00:00+00:00", missed: true },
      ],
    });
    expect(requests[0].url.pathname).toBe("/rest/v1/practice_runs");
    expect(requests[0].url.searchParams.get("select")).toBe("finished_at,practice_items(correct)");
    expect(requests[0].url.searchParams.get("finished_at")).toBe(`gte.${since}`);
    expect(requests[0].url.searchParams.get("order")).toBe("finished_at.asc");
  });

  it("returns an empty list when no run finished", async () => {
    const { user } = setup([ok([])]);
    expect(await user.listFinishedRunsSince(since)).toEqual({ ok: true, value: [] });
  });

  it("returns unauthorized on a 401", async () => {
    const { user } = setup([failure(401)]);
    expect(await user.listFinishedRunsSince(since)).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns unavailable when fetch rejects", async () => {
    const { user } = setup([new TypeError("network down")]);
    expect(await user.listFinishedRunsSince(since)).toEqual({ ok: false, failure: "unavailable" });
  });

  it("returns unavailable for a bad row", async () => {
    const { user } = setup([ok([{ id }])]);
    expect(await user.listFinishedRunsSince(since)).toEqual({ ok: false, failure: "unavailable" });
  });
});

describe("getStats", () => {
  const statsRow = { session_count: 12, session_days: ["2026-11-06", "2026-11-05"], new_words: 48 };

  it("calls profile_stats with the zone and the caller's token and returns the stats", async () => {
    const { user, requests } = setup([ok([statsRow])]);

    const outcome = await user.getStats("America/Argentina/Buenos_Aires");

    expect(outcome).toEqual({
      ok: true,
      value: { sessionCount: 12, sessionDays: ["2026-11-06", "2026-11-05"], newWords: 48 },
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe("POST");
    expect(requests[0].url.pathname).toBe("/rest/v1/rpc/profile_stats");
    expect(JSON.parse(requests[0].body ?? "null")).toEqual({
      time_zone: "America/Argentina/Buenos_Aires",
    });
    expect(requests[0].headers.get("Authorization")).toBe(`Bearer ${accessToken}`);
  });

  it("returns zeros and no days for a user with no sessions", async () => {
    const { user } = setup([ok([{ session_count: 0, session_days: [], new_words: 0 }])]);
    expect(await user.getStats("UTC")).toEqual({
      ok: true,
      value: { sessionCount: 0, sessionDays: [], newWords: 0 },
    });
  });

  it("returns unauthorized on a 401", async () => {
    const { user } = setup([failure(401)]);
    expect(await user.getStats("UTC")).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns unavailable when fetch rejects", async () => {
    const { user } = setup([new TypeError("network down")]);
    expect(await user.getStats("UTC")).toEqual({ ok: false, failure: "unavailable" });
  });

  it("returns unavailable for a bad row and for no row", async () => {
    expect(await setup([ok([{ session_count: "x" }])]).user.getStats("UTC")).toEqual({
      ok: false,
      failure: "unavailable",
    });
    expect(await setup([ok([])]).user.getStats("UTC")).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });
});

describe("deleteAccount", () => {
  const deleted = () => ok({ id });

  it("deletes the caller by id through the admin API with the secret key, never the caller's token", async () => {
    const { user, requests } = setup([deleted()]);

    const outcome = await user.deleteAccount();

    expect(outcome).toEqual({ ok: true, value: null });
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe("DELETE");
    expect(requests[0].url.pathname).toBe(`/auth/v1/admin/users/${id}`);
    expect(requests[0].headers.get("apikey")).toBe(secretKey);
    expect(requests[0].headers.get("Authorization")).toBe(`Bearer ${secretKey}`);
    for (const header of requests[0].headers.values()) expect(header).not.toContain(accessToken);
    expect(JSON.parse(requests[0].body ?? "null")).toEqual({ should_soft_delete: false });
  });

  it("treats a 404 as already deleted", async () => {
    const { user } = setup([failure(404)]);
    expect(await user.deleteAccount()).toEqual({ ok: true, value: null });
  });

  it("returns unavailable on a 401, a 403 and a 500", async () => {
    for (const status of [401, 403, 500]) {
      const { user } = setup([failure(status)]);
      expect(await user.deleteAccount()).toEqual({ ok: false, failure: "unavailable" });
    }
  });

  it("returns unavailable when fetch rejects", async () => {
    const { user } = setup([new TypeError("network down")]);
    expect(await user.deleteAccount()).toEqual({ ok: false, failure: "unavailable" });
  });

  it("returns unavailable when the auth server does not answer before the deadline", async () => {
    const slow = createSupabaseStore(
      {
        url: "http://db.test",
        publishableKey,
        secretKey,
        now: () => new Date(),
        fetchFn: (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new TypeError("aborted")));
          }),
      },
      20,
    ).forUser({ id, accessToken });
    expect(await slow.deleteAccount()).toEqual({ ok: false, failure: "unavailable" });
  });
});

describe("getMonthProgress", () => {
  const monthRow = { session_count: 12, correction_count: 31, new_word_count: 48 };

  it("calls progress_month with the zone, the month start and the caller's token", async () => {
    const { user, requests } = setup([ok([monthRow])]);

    const outcome = await user.getMonthProgress("America/Argentina/Buenos_Aires", "2026-11-01");

    expect(outcome).toEqual({
      ok: true,
      value: { sessionCount: 12, correctionCount: 31, newWordCount: 48 },
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe("POST");
    expect(requests[0].url.pathname).toBe("/rest/v1/rpc/progress_month");
    expect(JSON.parse(requests[0].body ?? "null")).toEqual({
      time_zone: "America/Argentina/Buenos_Aires",
      month_start: "2026-11-01",
    });
    expect(requests[0].headers.get("Authorization")).toBe(`Bearer ${accessToken}`);
  });

  it("returns zeros for a month with nothing", async () => {
    const zeros = { session_count: 0, correction_count: 0, new_word_count: 0 };
    const { user } = setup([ok([zeros])]);
    expect(await user.getMonthProgress("UTC", "2026-11-01")).toEqual({
      ok: true,
      value: { sessionCount: 0, correctionCount: 0, newWordCount: 0 },
    });
  });

  it("returns unauthorized on a 401", async () => {
    const { user } = setup([failure(401)]);
    expect(await user.getMonthProgress("UTC", "2026-11-01")).toEqual({
      ok: false,
      failure: "unauthorized",
    });
  });

  it("returns unavailable when fetch rejects", async () => {
    const { user } = setup([new TypeError("network down")]);
    expect(await user.getMonthProgress("UTC", "2026-11-01")).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });

  it("returns unavailable for a bad row and for no row", async () => {
    const bad = await setup([ok([{ session_count: "x" }])]).user.getMonthProgress(
      "UTC",
      "2026-11-01",
    );
    expect(bad).toEqual({ ok: false, failure: "unavailable" });
    const none = await setup([ok([])]).user.getMonthProgress("UTC", "2026-11-01");
    expect(none).toEqual({ ok: false, failure: "unavailable" });
  });
});

describe("listEndedSessions", () => {
  const historyRow = { ...sessionRow, status: "ended", message_count: 14, correction_count: 3 };

  it("calls progress_history with the offset, the limit and the caller's token", async () => {
    const { user, requests } = setup([ok([historyRow])]);

    const outcome = await user.listEndedSessions(20, 21);

    expect(outcome).toEqual({
      ok: true,
      value: [
        {
          session: {
            id: sessionId,
            topicId: null,
            title: "Free chat",
            status: "ended",
            summary: null,
            contextSummary: null,
            contextThroughId: null,
            titleSource: "default",
            costUsd: 0,
            createdAt: stamp,
            updatedAt: stamp,
          },
          messageCount: 14,
          correctionCount: 3,
        },
      ],
    });
    expect(requests[0].method).toBe("POST");
    expect(requests[0].url.pathname).toBe("/rest/v1/rpc/progress_history");
    expect(JSON.parse(requests[0].body ?? "null")).toEqual({ page_offset: 20, page_size: 21 });
    expect(requests[0].headers.get("Authorization")).toBe(`Bearer ${accessToken}`);
  });

  it("returns an empty list as a success", async () => {
    const { user } = setup([ok([])]);
    expect(await user.listEndedSessions(0, 21)).toEqual({ ok: true, value: [] });
  });

  it("returns unauthorized on a 401", async () => {
    const { user } = setup([failure(401)]);
    expect(await user.listEndedSessions(0, 21)).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns unavailable when fetch rejects and for a bad row", async () => {
    const offline = setup([new TypeError("network down")]).user;
    expect(await offline.listEndedSessions(0, 21)).toEqual({ ok: false, failure: "unavailable" });
    const bad = setup([ok([sessionRow])]).user;
    expect(await bad.listEndedSessions(0, 21)).toEqual({ ok: false, failure: "unavailable" });
  });
});

describe("listMistakeGroups", () => {
  const mistakeRow = { rule: null, times: 2, original: "a", corrected: "b" };

  it("calls progress_mistakes with the offset, the limit and the caller's token", async () => {
    const { user, requests } = setup([ok([mistakeRow])]);

    const outcome = await user.listMistakeGroups(0, 21);

    expect(outcome).toEqual({ ok: true, value: [mistakeRow] });
    expect(requests[0].method).toBe("POST");
    expect(requests[0].url.pathname).toBe("/rest/v1/rpc/progress_mistakes");
    expect(JSON.parse(requests[0].body ?? "null")).toEqual({ page_offset: 0, page_size: 21 });
    expect(requests[0].headers.get("Authorization")).toBe(`Bearer ${accessToken}`);
  });

  it("returns an empty list as a success", async () => {
    const { user } = setup([ok([])]);
    expect(await user.listMistakeGroups(0, 21)).toEqual({ ok: true, value: [] });
  });

  it("returns unauthorized on a 401", async () => {
    const { user } = setup([failure(401)]);
    expect(await user.listMistakeGroups(0, 21)).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns unavailable when fetch rejects and for a bad row", async () => {
    const offline = setup([new TypeError("network down")]).user;
    expect(await offline.listMistakeGroups(0, 21)).toEqual({ ok: false, failure: "unavailable" });
    const bad = setup([ok([{ rule: "x", times: 1 }])]).user;
    expect(await bad.listMistakeGroups(0, 21)).toEqual({ ok: false, failure: "unavailable" });
  });
});

describe("listNewWords", () => {
  const wordRow = { word: "catchy", sentence: "That song.", created_at: stamp };

  it("calls progress_words with the offset, the limit and the caller's token", async () => {
    const { user, requests } = setup([ok([wordRow])]);

    const outcome = await user.listNewWords(40, 21);

    expect(outcome).toEqual({
      ok: true,
      value: [{ word: "catchy", sentence: "That song.", createdAt: stamp }],
    });
    expect(requests[0].method).toBe("POST");
    expect(requests[0].url.pathname).toBe("/rest/v1/rpc/progress_words");
    expect(JSON.parse(requests[0].body ?? "null")).toEqual({ page_offset: 40, page_size: 21 });
    expect(requests[0].headers.get("Authorization")).toBe(`Bearer ${accessToken}`);
  });

  it("returns an empty list as a success", async () => {
    const { user } = setup([ok([])]);
    expect(await user.listNewWords(0, 21)).toEqual({ ok: true, value: [] });
  });

  it("returns unauthorized on a 401", async () => {
    const { user } = setup([failure(401)]);
    expect(await user.listNewWords(0, 21)).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns unavailable when fetch rejects and for a bad row", async () => {
    const offline = setup([new TypeError("network down")]).user;
    expect(await offline.listNewWords(0, 21)).toEqual({ ok: false, failure: "unavailable" });
    const bad = setup([ok([{ word: "x", sentence: "y", created_at: "yesterday" }])]).user;
    expect(await bad.listNewWords(0, 21)).toEqual({ ok: false, failure: "unavailable" });
  });
});

const threadRow = (text: string) => ({
  id: "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ee1",
  message_id: messageRow(1).id,
  role: "user",
  text,
  new_words: null,
  created_at: stamp,
});

describe("getThread", () => {
  it("reads the message, its session and the thread rows oldest first", async () => {
    const { user, requests } = setup([
      ok([messageRow(1)]),
      ok([sessionRow]),
      ok([threadRow("one"), threadRow("two")]),
    ]);

    const outcome = await user.getThread(messageRow(1).id);

    expect(outcome.ok && outcome.value?.message.id).toBe(messageRow(1).id);
    expect(outcome.ok && outcome.value?.session.id).toBe(sessionId);
    expect(outcome.ok && outcome.value?.messages.map((m) => m.text)).toEqual(["one", "two"]);
    expect(requests[2].url.pathname).toBe("/rest/v1/thread_messages");
    expect(requests[2].url.searchParams.get("order")).toBe("created_at.asc");
    expect(requests[2].url.searchParams.get("message_id")).toBe(`eq.${messageRow(1).id}`);
    expect(requests[2].headers.get("Authorization")).toBe(`Bearer ${accessToken}`);
  });

  it("returns a message with no thread as no messages", async () => {
    const { user } = setup([ok([messageRow(1)]), ok([sessionRow]), ok([])]);
    const outcome = await user.getThread(messageRow(1).id);
    expect(outcome.ok && outcome.value?.messages).toEqual([]);
  });

  it("returns null and reads nothing else when the message is not visible", async () => {
    const { user, requests } = setup([ok([])]);
    expect(await user.getThread(messageRow(1).id)).toEqual({ ok: true, value: null });
    expect(requests).toHaveLength(1);
  });

  it("returns unauthorized on a 401", async () => {
    const { user } = setup([failure(401)]);
    expect(await user.getThread(messageRow(1).id)).toEqual({
      ok: false,
      failure: "unauthorized",
    });
  });

  it("returns unavailable when fetch rejects", async () => {
    const { user } = setup([new TypeError("network down")]);
    expect(await user.getThread(messageRow(1).id)).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });

  it("returns unavailable when the session is missing or a thread row is bad", async () => {
    const noSession = setup([ok([messageRow(1)]), ok([])]);
    expect(await noSession.user.getThread(messageRow(1).id)).toEqual({
      ok: false,
      failure: "unavailable",
    });
    const badRow = setup([ok([messageRow(1)]), ok([sessionRow]), ok([{ id }])]);
    expect(await badRow.user.getThread(messageRow(1).id)).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });

  it("returns unavailable when the thread request fails", async () => {
    const { user } = setup([ok([messageRow(1)]), ok([sessionRow]), failure(500)]);
    expect(await user.getThread(messageRow(1).id)).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });
});

describe("addThreadMessage", () => {
  const input: ThreadMessageCreate = { role: "user", text: "Why?", newWords: ["word"] };

  it("checks the message is visible, then inserts the row", async () => {
    const { user, requests } = setup([
      ok([{ id: messageRow(1).id }]),
      ok({ ...threadRow("Why?"), new_words: ["word"] }, 201),
    ]);

    const outcome = await user.addThreadMessage(messageRow(1).id, input);

    expect(outcome).toMatchObject({ ok: true, value: { text: "Why?", newWords: ["word"] } });
    expect(requests[1].method).toBe("POST");
    expect(requests[1].url.pathname).toBe("/rest/v1/thread_messages");
    expect(JSON.parse(requests[1].body ?? "null")).toEqual({
      message_id: messageRow(1).id,
      role: "user",
      text: "Why?",
      new_words: ["word"],
    });
  });

  it("inserts null new words when there are none", async () => {
    const { user, requests } = setup([ok([{ id: messageRow(1).id }]), ok(threadRow("Why?"), 201)]);
    await user.addThreadMessage(messageRow(1).id, { role: "user", text: "Why?" });
    expect(JSON.parse(requests[1].body ?? "null")).toMatchObject({ new_words: null });
  });

  it("returns null without inserting when the message is not visible", async () => {
    const { user, requests } = setup([ok([])]);
    expect(await user.addThreadMessage(messageRow(1).id, input)).toEqual({
      ok: true,
      value: null,
    });
    expect(requests).toHaveLength(1);
  });

  it("returns unauthorized on a 401", async () => {
    const { user } = setup([failure(401)]);
    expect(await user.addThreadMessage(messageRow(1).id, input)).toEqual({
      ok: false,
      failure: "unauthorized",
    });
  });

  it("returns unavailable when fetch rejects and for a bad row", async () => {
    const offline = setup([new TypeError("network down")]).user;
    expect(await offline.addThreadMessage(messageRow(1).id, input)).toEqual({
      ok: false,
      failure: "unavailable",
    });
    const bad = setup([ok([{ id: messageRow(1).id }]), ok({ id }, 201)]).user;
    expect(await bad.addThreadMessage(messageRow(1).id, input)).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });
});

describe("withdrawCorrections", () => {
  const withdrawn = {
    ...messageRow(1),
    corrections: {
      items: [{ original: "a", corrected: "b", withdrawn: true }],
      explanation: null,
    },
  };

  it("calls withdraw_corrections and returns the message", async () => {
    const { user, requests } = setup([ok([withdrawn])]);

    const outcome = await user.withdrawCorrections(messageRow(1).id, [0]);

    expect(outcome.ok && outcome.value?.corrections?.items[0].withdrawn).toBe(true);
    expect(requests[0].method).toBe("POST");
    expect(requests[0].url.pathname).toBe("/rest/v1/rpc/withdraw_corrections");
    expect(JSON.parse(requests[0].body ?? "null")).toEqual({
      message_id: messageRow(1).id,
      item_indexes: [0],
    });
    expect(requests[0].headers.get("Authorization")).toBe(`Bearer ${accessToken}`);
  });

  it("returns null when the message is not the caller's", async () => {
    const { user } = setup([ok([])]);
    expect(await user.withdrawCorrections(messageRow(1).id, [0])).toEqual({
      ok: true,
      value: null,
    });
  });

  it("returns unauthorized on a 401", async () => {
    const { user } = setup([failure(401)]);
    expect(await user.withdrawCorrections(messageRow(1).id, [0])).toEqual({
      ok: false,
      failure: "unauthorized",
    });
  });

  it("returns unavailable when fetch rejects and for a bad row", async () => {
    const offline = setup([new TypeError("network down")]).user;
    expect(await offline.withdrawCorrections(messageRow(1).id, [0])).toEqual({
      ok: false,
      failure: "unavailable",
    });
    const bad = setup([ok([{ id }])]).user;
    expect(await bad.withdrawCorrections(messageRow(1).id, [0])).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });
});

describe("listThreadCounts", () => {
  it("calls thread_counts with the session and maps the counts", async () => {
    const { user, requests } = setup([ok([{ message_id: messageRow(1).id, reply_count: 2 }])]);

    const outcome = await user.listThreadCounts(sessionId);

    expect(outcome).toEqual({ ok: true, value: [{ messageId: messageRow(1).id, count: 2 }] });
    expect(requests[0].url.pathname).toBe("/rest/v1/rpc/thread_counts");
    expect(JSON.parse(requests[0].body ?? "null")).toEqual({ session_id: sessionId });
    expect(requests[0].headers.get("Authorization")).toBe(`Bearer ${accessToken}`);
  });

  it("returns an empty list as a success", async () => {
    const { user } = setup([ok([])]);
    expect(await user.listThreadCounts(sessionId)).toEqual({ ok: true, value: [] });
  });

  it("returns unauthorized on a 401", async () => {
    const { user } = setup([failure(401)]);
    expect(await user.listThreadCounts(sessionId)).toEqual({
      ok: false,
      failure: "unauthorized",
    });
  });

  it("returns unavailable when fetch rejects and for a bad row", async () => {
    const offline = setup([new TypeError("network down")]).user;
    expect(await offline.listThreadCounts(sessionId)).toEqual({
      ok: false,
      failure: "unavailable",
    });
    const bad = setup([ok([{ message_id: "x", reply_count: "2" }])]).user;
    expect(await bad.listThreadCounts(sessionId)).toEqual({ ok: false, failure: "unavailable" });
  });
});

describe("listThreadWords", () => {
  const embedded = { session_id: sessionId };

  it("reads the new words of the session's thread rows, oldest first, through their messages", async () => {
    const { user, requests } = setup([
      ok([
        { new_words: ["deadline"], messages: embedded },
        { new_words: ["Budget", "deadline"], messages: embedded },
      ]),
    ]);

    const outcome = await user.listThreadWords(sessionId);

    expect(outcome).toEqual({ ok: true, value: ["deadline", "Budget", "deadline"] });
    expect(requests.length).toBe(1);
    expect(requests[0].url.pathname).toBe("/rest/v1/thread_messages");
    expect(requests[0].url.searchParams.get("select")).toBe("new_words,messages!inner(session_id)");
    expect(requests[0].url.searchParams.get("messages.session_id")).toBe(`eq.${sessionId}`);
    expect(requests[0].url.searchParams.get("new_words")).toBe("not.is.null");
    expect(requests[0].url.searchParams.get("order")).toBe("created_at.asc");
    expect(requests[0].headers.get("Authorization")).toBe(`Bearer ${accessToken}`);
  });

  it("returns no words as a success for a session without threads", async () => {
    const { user } = setup([ok([])]);
    expect(await user.listThreadWords(sessionId)).toEqual({ ok: true, value: [] });
  });

  it("returns unauthorized on a 401", async () => {
    const { user } = setup([failure(401)]);
    expect(await user.listThreadWords(sessionId)).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns unavailable when fetch rejects", async () => {
    const { user } = setup([new TypeError("network down")]);
    expect(await user.listThreadWords(sessionId)).toEqual({ ok: false, failure: "unavailable" });
  });

  it("returns unavailable for a bad row", async () => {
    const { user } = setup([ok([{ new_words: "deadline", messages: embedded }])]);
    expect(await user.listThreadWords(sessionId)).toEqual({ ok: false, failure: "unavailable" });
  });
});

describe("getSessionWithMessages and threads", () => {
  it("reads only the session and its messages, never a thread table", async () => {
    const { user, requests } = setup([ok([sessionRow]), ok([messageRow(1)])]);
    await user.getSessionWithMessages(sessionId);
    expect(requests.map((r) => r.url.pathname)).toEqual(["/rest/v1/sessions", "/rest/v1/messages"]);
  });
});

describe("listRecentPrompts", () => {
  const since = "2026-10-29T12:00:00.000Z";

  it("reads the caller's items with their runs' dates, newest first, up to the limit", async () => {
    const { user, requests } = setup([
      ok([
        {
          run_id: "run-2",
          prompt: "I ___ (be) there.",
          rule: "Present perfect",
          practice_runs: { created_at: "2026-11-04T10:00:00+00:00" },
        },
        {
          run_id: "run-1",
          prompt: "She ___ (go) home.",
          rule: "Past simple",
          practice_runs: { created_at: "2026-11-02T10:00:00+00:00" },
        },
      ]),
    ]);

    const outcome = await user.listRecentPrompts(since, 40);

    expect(outcome).toEqual({
      ok: true,
      value: [
        { runId: "run-2", prompt: "I ___ (be) there.", rule: "Present perfect" },
        { runId: "run-1", prompt: "She ___ (go) home.", rule: "Past simple" },
      ],
    });
    const params = requests[0].url.searchParams;
    expect(requests[0].url.pathname).toBe("/rest/v1/practice_items");
    expect(params.get("select")).toBe("run_id,prompt,rule,practice_runs!inner(created_at)");
    expect(params.get("practice_runs.created_at")).toBe(`gte.${since}`);
    expect(params.get("order")).toBe("practice_runs(created_at).desc,position.desc");
    expect(params.get("limit")).toBe("40");
    expect(requests[0].headers.get("Authorization")).toBe(`Bearer ${accessToken}`);
  });

  it("returns an empty list when the caller practiced nothing recently", async () => {
    const { user } = setup([ok([])]);
    expect(await user.listRecentPrompts(since, 40)).toEqual({ ok: true, value: [] });
  });

  it("returns unauthorized on a 401", async () => {
    const { user } = setup([failure(401)]);
    expect(await user.listRecentPrompts(since, 40)).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns unavailable when fetch rejects", async () => {
    const { user } = setup([new TypeError("network down")]);
    expect(await user.listRecentPrompts(since, 40)).toEqual({ ok: false, failure: "unavailable" });
  });

  it("returns unavailable for a bad row", async () => {
    const { user } = setup([ok([{ run_id: "run-1" }])]);
    expect(await user.listRecentPrompts(since, 40)).toEqual({ ok: false, failure: "unavailable" });
  });
});

describe("practice methods", () => {
  const runId = "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5eb1";
  const noteId = "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ef1";
  const itemId = "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ee1";
  const runRow = {
    id: runId,
    user_id: id,
    focus: "topic",
    topic_id: "conditionals",
    note_id: null,
    target: 5,
    cost_usd: 0,
    created_at: stamp,
    finished_at: null,
  };
  const itemRow = (position: number) => ({
    id: `6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ee${position}`,
    run_id: runId,
    position,
    kind: "choose",
    rule: "Conditionals",
    prompt: "If I ___ rich.",
    options: ["were", "was", "am"],
    accepted: ["were"],
    explanation: "Second conditional.",
    source: null,
    user_answer: null,
    correct: null,
    answered_at: null,
  });
  const created = {
    items: [
      {
        position: 0,
        kind: "choose" as const,
        rule: "Conditionals",
        prompt: "If I ___ rich.",
        options: ["were", "was", "am"],
        accepted: ["were"],
        explanation: "Second conditional.",
        source: null,
      },
    ],
  };
  const down = new TypeError("network down");

  describe("listPracticeRunsSince", () => {
    const since = "2026-11-05T12:00:00.000Z";

    it("reads the runs with their items since the given time", async () => {
      const { user, requests } = setup([
        ok([{ ...runRow, practice_items: [itemRow(1), itemRow(0)] }]),
      ]);
      const outcome = await user.listPracticeRunsSince(since);
      expect(outcome.ok && outcome.value[0]?.items.map((item) => item.position)).toEqual([0, 1]);
      expect(requests[0].url.pathname).toBe("/rest/v1/practice_runs");
      expect(requests[0].url.searchParams.get("select")).toBe("*,practice_items(*)");
      expect(requests[0].url.searchParams.get("created_at")).toBe(`gte.${since}`);
    });

    it("returns an empty list with no runs", async () => {
      expect(await setup([ok([])]).user.listPracticeRunsSince(since)).toEqual({
        ok: true,
        value: [],
      });
    });

    it("fails on a 401, a down fetch and a bad row", async () => {
      expect(await setup([failure(401)]).user.listPracticeRunsSince(since)).toEqual({
        ok: false,
        failure: "unauthorized",
      });
      expect(await setup([down]).user.listPracticeRunsSince(since)).toEqual({
        ok: false,
        failure: "unavailable",
      });
      expect(await setup([ok([{ id }])]).user.listPracticeRunsSince(since)).toEqual({
        ok: false,
        failure: "unavailable",
      });
    });
  });

  describe("createPracticeRun", () => {
    it("inserts a run for the caller and returns it", async () => {
      const { user, requests } = setup([ok({ ...runRow }, 201)]);
      const outcome = await user.createPracticeRun({
        focus: "topic",
        topicId: "conditionals",
        target: 5,
      });
      expect(outcome).toMatchObject({ ok: true, value: { id: runId, topicId: "conditionals" } });
      expect(requests[0].method).toBe("POST");
      expect(requests[0].url.pathname).toBe("/rest/v1/practice_runs");
      expect(JSON.parse(requests[0].body ?? "null")).toEqual({
        user_id: id,
        focus: "topic",
        topic_id: "conditionals",
        note_id: null,
        target: 5,
      });
    });

    it("sends a null topic for a mistakes run", async () => {
      const { user, requests } = setup([ok({ ...runRow, focus: "mistakes", topic_id: null }, 201)]);
      await user.createPracticeRun({ focus: "mistakes", target: 5 });
      expect(requests).toHaveLength(1);
      expect(JSON.parse(requests[0].body ?? "null")).toMatchObject({
        topic_id: null,
        note_id: null,
      });
    });

    it("reads the note of a note run first and inserts its id", async () => {
      const { user, requests } = setup([
        ok([{ id: noteId }]),
        ok({ ...runRow, focus: "note", topic_id: null, note_id: noteId }, 201),
      ]);
      const outcome = await user.createPracticeRun({ focus: "note", noteId, target: 5 });
      expect(outcome).toMatchObject({ ok: true, value: { noteId } });
      expect(requests[0].url.pathname).toBe("/rest/v1/study_notes");
      expect(requests[0].url.searchParams.get("id")).toBe(`eq.${noteId}`);
      expect(requests[0].url.searchParams.get("select")).toBe("id");
      expect(JSON.parse(requests[1].body ?? "null")).toMatchObject({
        focus: "note",
        note_id: noteId,
        topic_id: null,
      });
    });

    it("returns null and inserts nothing when the note is not visible", async () => {
      const { user, requests } = setup([ok([])]);
      expect(await user.createPracticeRun({ focus: "note", noteId, target: 5 })).toEqual({
        ok: true,
        value: null,
      });
      expect(requests).toHaveLength(1);
    });

    it("fails on a 401, a down fetch and a bad row", async () => {
      const input = { focus: "mistakes", target: 5 } as const;
      expect(await setup([failure(401)]).user.createPracticeRun(input)).toEqual({
        ok: false,
        failure: "unauthorized",
      });
      expect(await setup([down]).user.createPracticeRun(input)).toEqual({
        ok: false,
        failure: "unavailable",
      });
      expect(await setup([ok({ id }, 201)]).user.createPracticeRun(input)).toEqual({
        ok: false,
        failure: "unavailable",
      });
    });
  });

  describe("getPracticeRun", () => {
    it("reads a run with its items", async () => {
      const { user, requests } = setup([ok({ ...runRow, practice_items: [itemRow(0)] })]);
      const outcome = await user.getPracticeRun(runId);
      expect(outcome.ok && outcome.value?.items).toHaveLength(1);
      expect(requests[0].url.pathname).toBe("/rest/v1/practice_runs");
      expect(requests[0].url.searchParams.get("id")).toBe(`eq.${runId}`);
      expect(requests[0].url.searchParams.get("select")).toBe("*,practice_items(*)");
    });

    it("returns a run with no items as the expected empty", async () => {
      const outcome = await setup([ok({ ...runRow, practice_items: [] })]).user.getPracticeRun(
        runId,
      );
      expect(outcome.ok && outcome.value?.items).toEqual([]);
    });

    it("returns null when the run is not visible", async () => {
      const { user } = setup([ok([])]);
      expect(await user.getPracticeRun(runId)).toEqual({ ok: true, value: null });
    });

    it("fails on a 401, a down fetch and a bad row", async () => {
      expect(await setup([failure(401)]).user.getPracticeRun(runId)).toEqual({
        ok: false,
        failure: "unauthorized",
      });
      expect(await setup([down]).user.getPracticeRun(runId)).toEqual({
        ok: false,
        failure: "unavailable",
      });
      expect(await setup([ok({ id })]).user.getPracticeRun(runId)).toEqual({
        ok: false,
        failure: "unavailable",
      });
    });
  });

  describe("addPracticeItems", () => {
    it("saves the items ignoring duplicates and returns every item of the run", async () => {
      const { user, requests } = setup([ok({ id: runId }), ok(null, 201), ok([itemRow(0)])]);
      const outcome = await user.addPracticeItems(runId, created.items);
      expect(outcome.ok && outcome.value?.map((item) => item.position)).toEqual([0]);
      expect(requests[1].method).toBe("POST");
      expect(requests[1].url.pathname).toBe("/rest/v1/practice_items");
      expect(requests[1].url.searchParams.get("on_conflict")).toBe("run_id,position");
      expect(requests[1].headers.get("Prefer")).toContain("resolution=ignore-duplicates");
      expect(JSON.parse(requests[1].body ?? "null")).toEqual([
        {
          run_id: runId,
          position: 0,
          kind: "choose",
          rule: "Conditionals",
          prompt: "If I ___ rich.",
          options: ["were", "was", "am"],
          accepted: ["were"],
          explanation: "Second conditional.",
          source: null,
        },
      ]);
      expect(requests[2].url.pathname).toBe("/rest/v1/practice_items");
      expect(requests[2].url.searchParams.get("run_id")).toBe(`eq.${runId}`);
      expect(requests[2].url.searchParams.get("order")).toBe("position.asc");
    });

    it("answers every item of the run when the save repeats", async () => {
      const { user } = setup([ok({ id: runId }), ok(null, 201), ok([itemRow(0), itemRow(1)])]);
      const outcome = await user.addPracticeItems(runId, created.items);
      expect(outcome.ok && outcome.value).toHaveLength(2);
    });

    it("returns null when the run is not visible", async () => {
      const { user, requests } = setup([ok([])]);
      expect(await user.addPracticeItems(runId, created.items)).toEqual({ ok: true, value: null });
      expect(requests).toHaveLength(1);
    });

    it("fails on a 401, a down fetch and a bad row", async () => {
      expect(await setup([failure(401)]).user.addPracticeItems(runId, created.items)).toEqual({
        ok: false,
        failure: "unauthorized",
      });
      expect(
        await setup([ok({ id: runId }), down]).user.addPracticeItems(runId, created.items),
      ).toEqual({ ok: false, failure: "unavailable" });
      expect(
        await setup([ok({ id: runId }), ok(null, 201), ok([{ id }])]).user.addPracticeItems(
          runId,
          created.items,
        ),
      ).toEqual({ ok: false, failure: "unavailable" });
    });
  });

  describe("addPracticeChecks", () => {
    const check: PracticeCheckCreate = {
      stage: "solver",
      generatorModel: "claude-haiku-5-5",
      checkerModel: "claude-haiku-5-5",
      passed: false,
      reason: "solver_mismatch",
      solverAnswer: "was",
      exercise: {
        kind: "gap",
        rule: "r",
        prompt: "p ___",
        options: [],
        accepted: ["a"],
        explanation: "e",
        source: "",
      },
    };

    it("inserts the rows of a visible run without user_id and returns how many", async () => {
      const { user, requests } = setup([ok({ id: runId }), ok(null, 201)]);
      const outcome = await user.addPracticeChecks(runId, [check, check]);
      expect(outcome).toEqual({ ok: true, value: 2 });
      expect(requests[1].method).toBe("POST");
      expect(requests[1].url.pathname).toBe("/rest/v1/practice_checks");
      const row = {
        run_id: runId,
        stage: "solver",
        generator_model: "claude-haiku-5-5",
        checker_model: "claude-haiku-5-5",
        passed: false,
        reason: "solver_mismatch",
        solver_answer: "was",
        exercise: check.exercise,
      };
      expect(JSON.parse(requests[1].body ?? "null")).toEqual([row, row]);
    });

    it("returns null when the run is not visible", async () => {
      const { user, requests } = setup([ok([])]);
      expect(await user.addPracticeChecks(runId, [check])).toEqual({ ok: true, value: null });
      expect(requests).toHaveLength(1);
    });

    it("fails on a 401, a down fetch and an insert error", async () => {
      expect(await setup([failure(401)]).user.addPracticeChecks(runId, [check])).toEqual({
        ok: false,
        failure: "unauthorized",
      });
      expect(await setup([ok({ id: runId }), down]).user.addPracticeChecks(runId, [check])).toEqual(
        { ok: false, failure: "unavailable" },
      );
      expect(
        await setup([ok({ id: runId }), failure(500)]).user.addPracticeChecks(runId, [check]),
      ).toEqual({ ok: false, failure: "unavailable" });
    });
  });

  describe("answerPracticeItem", () => {
    it("saves the answer and returns the item", async () => {
      const { user, requests } = setup([
        ok([{ ...itemRow(0), user_answer: "was", correct: false }]),
      ]);
      const outcome = await user.answerPracticeItem(
        itemId,
        { userAnswer: "was", correct: false },
        "2026-11-07T10:00:00.000Z",
      );
      expect(outcome).toMatchObject({ ok: true, value: { userAnswer: "was", correct: false } });
      expect(requests[0].method).toBe("PATCH");
      expect(requests[0].url.pathname).toBe("/rest/v1/practice_items");
      expect(requests[0].url.searchParams.get("id")).toBe(`eq.${itemId}`);
      expect(JSON.parse(requests[0].body ?? "null")).toEqual({
        user_answer: "was",
        correct: false,
        answered_at: "2026-11-07T10:00:00.000Z",
      });
    });

    it("returns null when the item is not visible", async () => {
      const answer = { userAnswer: "was", correct: false };
      expect(await setup([ok([])]).user.answerPracticeItem(itemId, answer, stamp)).toEqual({
        ok: true,
        value: null,
      });
    });

    it("fails on a 401, a down fetch and a bad row", async () => {
      const answer = { userAnswer: "was", correct: false };
      expect(await setup([failure(401)]).user.answerPracticeItem(itemId, answer, stamp)).toEqual({
        ok: false,
        failure: "unauthorized",
      });
      expect(await setup([down]).user.answerPracticeItem(itemId, answer, stamp)).toEqual({
        ok: false,
        failure: "unavailable",
      });
      expect(await setup([ok([{ id }])]).user.answerPracticeItem(itemId, answer, stamp)).toEqual({
        ok: false,
        failure: "unavailable",
      });
    });
  });

  describe("addPracticeCost", () => {
    it("adds the amount through add_practice_cost and returns the run", async () => {
      const { user, requests } = setup([ok([{ ...runRow, cost_usd: 0.000145 }])]);
      const outcome = await user.addPracticeCost(runId, 0.000145);
      expect(outcome).toMatchObject({ ok: true, value: { id: runId, costUsd: 0.000145 } });
      expect(requests[0].method).toBe("POST");
      expect(requests[0].url.pathname).toBe("/rest/v1/rpc/add_practice_cost");
      expect(JSON.parse(requests[0].body ?? "null")).toEqual({
        run_id: runId,
        amount_usd: 0.000145,
      });
    });

    it("returns null when the run is not visible", async () => {
      expect(await setup([ok([])]).user.addPracticeCost(runId, 1)).toEqual({
        ok: true,
        value: null,
      });
    });

    it("fails on a 401, a down fetch and a bad row", async () => {
      expect(await setup([failure(401)]).user.addPracticeCost(runId, 1)).toEqual({
        ok: false,
        failure: "unauthorized",
      });
      expect(await setup([down]).user.addPracticeCost(runId, 1)).toEqual({
        ok: false,
        failure: "unavailable",
      });
      expect(await setup([ok([{ id }])]).user.addPracticeCost(runId, 1)).toEqual({
        ok: false,
        failure: "unavailable",
      });
    });
  });

  describe("setPracticeTarget", () => {
    it("raises the target and returns the run", async () => {
      const { user, requests } = setup([ok([{ ...runRow, target: 10 }])]);
      const outcome = await user.setPracticeTarget(runId, 10);
      expect(outcome).toMatchObject({ ok: true, value: { target: 10 } });
      expect(requests[0].method).toBe("PATCH");
      expect(requests[0].url.searchParams.get("id")).toBe(`eq.${runId}`);
      expect(JSON.parse(requests[0].body ?? "null")).toEqual({ target: 10 });
    });

    it("returns null when the run is not visible", async () => {
      expect(await setup([ok([])]).user.setPracticeTarget(runId, 10)).toEqual({
        ok: true,
        value: null,
      });
    });

    it("fails on a 401, a down fetch and a bad row", async () => {
      expect(await setup([failure(401)]).user.setPracticeTarget(runId, 10)).toEqual({
        ok: false,
        failure: "unauthorized",
      });
      expect(await setup([down]).user.setPracticeTarget(runId, 10)).toEqual({
        ok: false,
        failure: "unavailable",
      });
      expect(await setup([ok([{ id }])]).user.setPracticeTarget(runId, 10)).toEqual({
        ok: false,
        failure: "unavailable",
      });
    });
  });

  describe("finishPracticeRun", () => {
    it("sets finished_at and returns the run", async () => {
      const finishedAt = "2026-11-07T11:00:00.000Z";
      const { user, requests } = setup([ok([{ ...runRow, finished_at: finishedAt }])]);
      const outcome = await user.finishPracticeRun(runId, finishedAt);
      expect(outcome).toMatchObject({ ok: true, value: { finishedAt } });
      expect(requests[0].method).toBe("PATCH");
      expect(JSON.parse(requests[0].body ?? "null")).toEqual({ finished_at: finishedAt });
    });

    it("returns null when the run is not visible", async () => {
      expect(await setup([ok([])]).user.finishPracticeRun(runId, stamp)).toEqual({
        ok: true,
        value: null,
      });
    });

    it("fails on a 401, a down fetch and a bad row", async () => {
      expect(await setup([failure(401)]).user.finishPracticeRun(runId, stamp)).toEqual({
        ok: false,
        failure: "unauthorized",
      });
      expect(await setup([down]).user.finishPracticeRun(runId, stamp)).toEqual({
        ok: false,
        failure: "unavailable",
      });
      expect(await setup([ok([{ id }])]).user.finishPracticeRun(runId, stamp)).toEqual({
        ok: false,
        failure: "unavailable",
      });
    });
  });
});

describe("study notes", () => {
  const noteId = "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ef1";
  const content: {
    columns: [string, string, string];
    rows: [string, string, string][];
    remember: string;
  } = {
    columns: ["Form", "When", "Example"],
    rows: [["going to", "plans", "I'm going to study."]],
    remember: "Plans use going to.",
  };
  const noteRow = {
    id: noteId,
    user_id: id,
    session_id: sessionId,
    kind: "table",
    title: "Future forms",
    topic: "Going to, will",
    content,
    created_at: stamp,
    sessions: { title: "Free chat" },
  };
  const create = {
    kind: "table",
    title: "Future forms",
    topic: "Going to, will",
    content,
    sessionId,
  } as const;
  const down = new TypeError("network down");

  describe("createNote", () => {
    it("reads the session, then inserts the note for the caller with the session embedded", async () => {
      const { user, requests } = setup([ok([sessionRow]), ok(noteRow, 201)]);
      const outcome = await user.createNote(create);
      expect(outcome).toMatchObject({
        ok: true,
        value: { id: noteId, sessionTitle: "Free chat", kind: "table" },
      });
      expect(requests[0].url.pathname).toBe("/rest/v1/sessions");
      expect(requests[0].url.searchParams.get("id")).toBe(`eq.${sessionId}`);
      expect(requests[1].method).toBe("POST");
      expect(requests[1].url.pathname).toBe("/rest/v1/study_notes");
      expect(requests[1].url.searchParams.get("select")).toBe("*,sessions(title)");
      expect(JSON.parse(requests[1].body ?? "null")).toEqual({
        user_id: id,
        session_id: sessionId,
        kind: "table",
        title: "Future forms",
        topic: "Going to, will",
        content,
      });
      expect(requests[1].headers.get("Authorization")).toBe(`Bearer ${accessToken}`);
    });

    it("skips the session read for a note with no session", async () => {
      const { user, requests } = setup([ok({ ...noteRow, session_id: null, sessions: null }, 201)]);
      const outcome = await user.createNote({ ...create, sessionId: null });
      expect(outcome).toMatchObject({ ok: true, value: { sessionId: null, sessionTitle: null } });
      expect(requests).toHaveLength(1);
      expect(JSON.parse(requests[0].body ?? "null")).toMatchObject({ session_id: null });
    });

    it("returns null and inserts nothing when the session is not visible", async () => {
      const { user, requests } = setup([ok([])]);
      expect(await user.createNote(create)).toEqual({ ok: true, value: null });
      expect(requests).toHaveLength(1);
    });

    it("fails on a 401, a down fetch and a bad row", async () => {
      expect(await setup([ok([sessionRow]), failure(401)]).user.createNote(create)).toEqual({
        ok: false,
        failure: "unauthorized",
      });
      expect(await setup([down]).user.createNote(create)).toEqual({
        ok: false,
        failure: "unavailable",
      });
      expect(await setup([ok([sessionRow]), ok({ id }, 201)]).user.createNote(create)).toEqual({
        ok: false,
        failure: "unavailable",
      });
    });
  });

  describe("getNote", () => {
    it("reads one note with its session title", async () => {
      const { user, requests } = setup([ok(noteRow)]);
      const outcome = await user.getNote(noteId);
      expect(outcome).toMatchObject({ ok: true, value: { id: noteId, content } });
      expect(requests[0].url.pathname).toBe("/rest/v1/study_notes");
      expect(requests[0].url.searchParams.get("id")).toBe(`eq.${noteId}`);
      expect(requests[0].url.searchParams.get("select")).toBe("*,sessions(title)");
    });

    it("returns null for a note that is not visible", async () => {
      expect(await setup([ok([])]).user.getNote(noteId)).toEqual({ ok: true, value: null });
    });

    it("fails on a 401, a down fetch and a bad row", async () => {
      expect(await setup([failure(401)]).user.getNote(noteId)).toEqual({
        ok: false,
        failure: "unauthorized",
      });
      expect(await setup([down]).user.getNote(noteId)).toEqual({
        ok: false,
        failure: "unavailable",
      });
      expect(await setup([ok({ id })]).user.getNote(noteId)).toEqual({
        ok: false,
        failure: "unavailable",
      });
    });
  });

  describe("deleteNote", () => {
    it("deletes by id and returns the id", async () => {
      const { user, requests } = setup([ok({ id: noteId })]);
      expect(await user.deleteNote(noteId)).toEqual({ ok: true, value: { id: noteId } });
      expect(requests[0].method).toBe("DELETE");
      expect(requests[0].url.pathname).toBe("/rest/v1/study_notes");
      expect(requests[0].url.searchParams.get("id")).toBe(`eq.${noteId}`);
      expect(requests[0].url.searchParams.get("select")).toBe("id");
    });

    it("returns null for a note that is not visible", async () => {
      expect(await setup([ok([])]).user.deleteNote(noteId)).toEqual({ ok: true, value: null });
    });

    it("fails on a 401, a down fetch and a bad row", async () => {
      expect(await setup([failure(401)]).user.deleteNote(noteId)).toEqual({
        ok: false,
        failure: "unauthorized",
      });
      expect(await setup([down]).user.deleteNote(noteId)).toEqual({
        ok: false,
        failure: "unavailable",
      });
      expect(await setup([ok({ nope: 1 })]).user.deleteNote(noteId)).toEqual({
        ok: false,
        failure: "unavailable",
      });
    });
  });

  describe("listNotes", () => {
    const listRow = { id: noteId, kind: "table", title: "T", topic: "P", created_at: stamp };

    it("reads a page newest first with the offset and limit", async () => {
      const { user, requests } = setup([ok([listRow])]);
      const outcome = await user.listNotes(20, 21);
      expect(outcome).toEqual({
        ok: true,
        value: [{ id: noteId, kind: "table", title: "T", topic: "P", createdAt: stamp }],
      });
      expect(requests[0].url.pathname).toBe("/rest/v1/study_notes");
      expect(requests[0].url.searchParams.get("select")).toBe("id,kind,title,topic,created_at");
      expect(requests[0].url.searchParams.get("order")).toBe("created_at.desc,id.desc");
      // INFO: postgrest-js sends range(20, 40) as offset=20 and limit=21 (0-based, inclusive).
      expect(requests[0].url.searchParams.get("offset")).toBe("20");
      expect(requests[0].url.searchParams.get("limit")).toBe("21");
    });

    it("returns an empty list as a success", async () => {
      expect(await setup([ok([])]).user.listNotes(0, 21)).toEqual({ ok: true, value: [] });
    });

    it("fails on a 401, a down fetch and a bad row", async () => {
      expect(await setup([failure(401)]).user.listNotes(0, 21)).toEqual({
        ok: false,
        failure: "unauthorized",
      });
      expect(await setup([down]).user.listNotes(0, 21)).toEqual({
        ok: false,
        failure: "unavailable",
      });
      expect(await setup([ok([{ id }])]).user.listNotes(0, 21)).toEqual({
        ok: false,
        failure: "unavailable",
      });
    });
  });

  describe("listSessionNotes", () => {
    it("reads the notes of a session oldest first", async () => {
      const { user, requests } = setup([ok([noteRow])]);
      const outcome = await user.listSessionNotes(sessionId);
      expect(outcome.ok && outcome.value).toHaveLength(1);
      expect(requests[0].url.searchParams.get("session_id")).toBe(`eq.${sessionId}`);
      expect(requests[0].url.searchParams.get("select")).toBe("*,sessions(title)");
      expect(requests[0].url.searchParams.get("order")).toBe("created_at.asc");
    });

    it("returns an empty list as a success", async () => {
      expect(await setup([ok([])]).user.listSessionNotes(sessionId)).toEqual({
        ok: true,
        value: [],
      });
    });

    it("fails on a 401, a down fetch and a bad row", async () => {
      expect(await setup([failure(401)]).user.listSessionNotes(sessionId)).toEqual({
        ok: false,
        failure: "unauthorized",
      });
      expect(await setup([down]).user.listSessionNotes(sessionId)).toEqual({
        ok: false,
        failure: "unavailable",
      });
      expect(await setup([ok([{ id }])]).user.listSessionNotes(sessionId)).toEqual({
        ok: false,
        failure: "unavailable",
      });
    });
  });
});
