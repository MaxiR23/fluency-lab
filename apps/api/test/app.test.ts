// apps/api/test/app.test.ts
//
// Tests for the routes of the app.
//
// Tested:
// - GET /health responds 200 with { ok: true }
// - an unknown route responds 404
// - the typed client sees /health (typecheck fails if AppType loses it)
// - GET /me answers the user for a valid token, 401 for any bad one and 500
//   when the signing keys cannot be loaded
// - GET/PUT /profile, GET/POST /sessions, GET /sessions/open, DELETE /sessions/:id, GET /sessions/week, GET /sessions/spend,
//   GET /profile/stats, GET /progress/month, /progress/history, /progress/mistakes and /progress/words, DELETE /account,
//   GET/POST /sessions/:id/messages, GET/POST /messages/:id/thread, POST /messages/:id/withdraw, GET /sessions/:id/summary, POST /sessions/:id/usage, PATCH /sessions/:id/context, PATCH /sessions/:id/title and POST /sessions/:id/end:
//   401 without a valid token, 400 on invalid input, 404, 503, and the typed client
// - GET /sessions/:id/messages carries the thread reply counts
// - GET /sessions/:id/summary counts the messages and collects the corrections and new words, the session's thread words included
// - GET /sessions/spend still counts the cost of a deleted session
// - the notes routes: create, read, delete and the Progress page, and the notes and note ids of the chat and practice routes
// - PUT /profile, POST /sessions and POST /practice/runs accept a catalog topic and answer invalid_input for one outside it
// - the practice routes: today, recent prompts, create, read, items, checks, answer, usage, target and finish
// - the usage route prices the tokens, and the routes reject an apiKey field
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec vitest run apps/api/test/app.test.ts
//
// SEE: apps/api/src/app.ts

import { sign } from "hono/jwt";
import { testClient } from "hono/testing";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STARTERS,
  TUTOR_MODEL,
  accountDeletedSchema,
  historyPageSchema,
  mistakePageSchema,
  monthProgressSchema,
  notePageSchema,
  profileStatsSchema,
  usageCostUsd,
  wordPageSchema,
  type ActiveSession,
  type Message,
  type PracticeItem,
  type PracticeRun,
  type StudyNote,
  type Profile,
  type Session,
} from "@fluency-lab/shared";
import { createApp } from "../src/app";
import type { JwksOutcome } from "../src/auth";
import { createFakeStore } from "./helpers/fake-store";
import { generatedSecret } from "./helpers/generated-secret";

const issuer = "http://127.0.0.1:54321/auth/v1";
const kid = "test-key";

let privateKey: JsonWebKey & { alg: string; kid: string };
let otherKey: JsonWebKey & { alg: string; kid: string };
let keysOutcome: JwksOutcome = { ok: true, keys: [] };

async function generateKey() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const priv = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const pub = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return { priv: { ...priv, alg: "ES256", kid }, pub: { ...pub, alg: "ES256", kid } };
}

const fake = createFakeStore();
const app = createApp({
  auth: { issuer, loadKeys: async () => keysOutcome },
  store: fake.store,
  now: () => new Date("2026-11-05T12:00:00Z"),
});

const now = () => Math.floor(Date.now() / 1000);

function token(payload: Record<string, unknown>, key = privateKey) {
  return sign(
    {
      sub: "user-1",
      email: "a@example.com",
      aud: "authenticated",
      iss: issuer,
      exp: now() + 600,
      ...payload,
    },
    key,
    "ES256",
  );
}

async function me(headers: Record<string, string>) {
  return app.request("/me", { headers });
}

beforeAll(async () => {
  const main = await generateKey();
  const other = await generateKey();
  privateKey = main.priv;
  otherKey = other.priv;
  keysOutcome = { ok: true, keys: [main.pub] };
});

afterEach(() => {
  vi.restoreAllMocks();
  fake.callers.length = 0;
  for (const method of Object.values(fake.user)) method.mockReset();
});

describe("GET /health", () => {
  it("responds 200 with { ok: true }", async () => {
    const res = await app.request("/health");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("responds 404 on a route that does not exist", async () => {
    const res = await app.request("/nope");

    expect(res.status).toBe(404);
  });
});

describe("typed client", () => {
  it("exposes /health through AppType", async () => {
    // INFO: `client.health` only typechecks while the routes are chained.
    const client = testClient(app);
    const res = await client.health.$get();

    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("GET /me", () => {
  it("responds 401 without an Authorization header", async () => {
    expect((await me({})).status).toBe(401);
  });

  it("responds 401 with a token that is not a JWT", async () => {
    expect((await me({ Authorization: "Bearer nope" })).status).toBe(401);
  });

  it("responds 401 with a scheme other than Bearer", async () => {
    expect((await me({ Authorization: `Basic ${await token({})}` })).status).toBe(401);
  });

  it("responds 401 with a token signed by another key", async () => {
    const bad = await token({}, otherKey);
    expect((await me({ Authorization: `Bearer ${bad}` })).status).toBe(401);
  });

  it("responds 401 with an expired token", async () => {
    const bad = await token({ exp: now() - 60 });
    expect((await me({ Authorization: `Bearer ${bad}` })).status).toBe(401);
  });

  it("responds 401 with the wrong issuer", async () => {
    const bad = await token({ iss: "http://evil.example/auth/v1" });
    expect((await me({ Authorization: `Bearer ${bad}` })).status).toBe(401);
  });

  it("responds 401 with the wrong audience", async () => {
    const bad = await token({ aud: "anon" });
    expect((await me({ Authorization: `Bearer ${bad}` })).status).toBe(401);
  });

  it("responds 401 with an HS256 token", async () => {
    const bad = await sign(
      { sub: "user-1", aud: "authenticated", iss: issuer, exp: now() + 600 },
      generatedSecret("hs256-key"),
      "HS256",
    );
    expect((await me({ Authorization: `Bearer ${bad}` })).status).toBe(401);
  });

  it("responds 401 when the token has no sub", async () => {
    const bad = await token({ sub: undefined });
    expect((await me({ Authorization: `Bearer ${bad}` })).status).toBe(401);
  });

  it("responds 401 when the JWKS has no keys", async () => {
    const previous = keysOutcome;
    keysOutcome = { ok: true, keys: [] };
    const good = await token({});
    const res = await me({ Authorization: `Bearer ${good}` });
    keysOutcome = previous;

    expect(res.status).toBe(401);
  });

  it("responds 200 with the id and email for a valid token", async () => {
    const good = await token({});
    const res = await me({ Authorization: `Bearer ${good}` });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "user-1", email: "a@example.com" });
  });

  it("responds 200 with a null email for a valid token without one", async () => {
    const good = await token({ email: undefined });
    const res = await me({ Authorization: `Bearer ${good}` });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "user-1", email: null });
  });

  it("responds 500, not 401 and not the user, when the keys cannot be loaded", async () => {
    // INFO: Hono's default error handler logs through console.error.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const previous = keysOutcome;
    keysOutcome = { ok: false, reason: "unavailable" };
    const good = await token({});
    const res = await me({ Authorization: `Bearer ${good}` });
    keysOutcome = previous;

    expect(res.status).toBe(500);
  });

  it("exposes /me through AppType", async () => {
    const client = testClient(app, undefined, undefined, {
      headers: { Authorization: `Bearer ${await token({})}` },
    });
    const res = await client.me.$get();

    expect(await res.json()).toEqual({ id: "user-1", email: "a@example.com" });
  });
});

const stamp = "2026-01-01 10:00:00+00";
const sessionId = "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ea1";

const profile: Profile = {
  id: "user-1",
  displayName: "Ada",
  level: "beginner",
  goals: [],
  topics: [],
  provider: null,
  monthlyLimitUsd: null,
  onboardingCompletedAt: null,
  createdAt: stamp,
  updatedAt: stamp,
};

const session: Session = {
  id: sessionId,
  topicId: null,
  title: "Free chat",
  status: "active",
  summary: null,
  contextSummary: null,
  contextThroughId: null,
  titleSource: "default",
  costUsd: 0,
  createdAt: stamp,
  updatedAt: stamp,
};

const message: Message = {
  id: "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ec1",
  sessionId,
  role: "user",
  text: "Hello",
  corrections: null,
  newWords: null,
  replyToId: null,
  noteId: null,
  createdAt: stamp,
};

const runId = "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5eb1";
const itemId = "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ee1";
const practiceRun: PracticeRun = {
  id: runId,
  focus: "mistakes",
  topicId: null,
  noteId: null,
  target: 5,
  costUsd: 0,
  createdAt: "2026-11-05T09:00:00+00:00",
  finishedAt: null,
};
const practiceItem: PracticeItem = {
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
const practiceItemBody = {
  position: 0,
  kind: "choose",
  rule: "Present perfect",
  prompt: "I ___ there.",
  options: ["have been", "was", "am"],
  accepted: ["have been"],
  explanation: "Experience.",
  source: null,
};

const noteId = "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ef1";
const noteContent: {
  columns: [string, string, string];
  rows: [string, string, string][];
  remember: string;
} = {
  columns: ["Form", "When", "Example"],
  rows: [["going to", "plans", "I'm going to study."]],
  remember: "Plans use going to.",
};
const noteBody = {
  kind: "table",
  title: "Future forms",
  topic: "Going to, will",
  sessionId,
  content: noteContent,
};
const studyNote: StudyNote = {
  ...noteBody,
  kind: "table",
  id: noteId,
  sessionTitle: "Free chat",
  createdAt: stamp,
};

function json(body: unknown) {
  return JSON.stringify(body);
}

async function authed(extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${await token({})}`, ...extra };
}

const jsonType = { "Content-Type": "application/json" };

const routes: { name: string; path: string; method: string; body?: unknown }[] = [
  { name: "GET /profile", path: "/profile", method: "GET" },
  { name: "PUT /profile", path: "/profile", method: "PUT", body: { level: "beginner" } },
  { name: "GET /profile/stats", path: "/profile/stats?tz=UTC", method: "GET" },
  { name: "GET /progress/month", path: "/progress/month?tz=UTC", method: "GET" },
  { name: "GET /progress/history", path: "/progress/history?tz=UTC", method: "GET" },
  { name: "GET /progress/mistakes", path: "/progress/mistakes", method: "GET" },
  { name: "GET /progress/words", path: "/progress/words?tz=UTC", method: "GET" },
  { name: "GET /progress/notes", path: "/progress/notes?tz=UTC", method: "GET" },
  { name: "POST /notes", path: "/notes", method: "POST", body: noteBody },
  { name: "GET /notes/:id", path: `/notes/${noteId}`, method: "GET" },
  { name: "DELETE /notes/:id", path: `/notes/${noteId}`, method: "DELETE" },
  { name: "DELETE /account", path: "/account", method: "DELETE" },
  { name: "GET /sessions/active", path: "/sessions/active", method: "GET" },
  { name: "GET /sessions/open", path: "/sessions/open", method: "GET" },
  { name: "DELETE /sessions/:id", path: `/sessions/${sessionId}`, method: "DELETE" },
  { name: "GET /sessions/week", path: "/sessions/week?tz=UTC", method: "GET" },
  { name: "POST /sessions", path: "/sessions", method: "POST", body: { topicId: null } },
  { name: "GET /sessions/spend", path: "/sessions/spend?tz=UTC", method: "GET" },
  { name: "GET /sessions/:id/messages", path: `/sessions/${sessionId}/messages`, method: "GET" },
  { name: "GET /sessions/:id/summary", path: `/sessions/${sessionId}/summary`, method: "GET" },
  {
    name: "POST /sessions/:id/messages",
    path: `/sessions/${sessionId}/messages`,
    method: "POST",
    body: { role: "user", text: "Hi" },
  },
  {
    name: "POST /sessions/:id/usage",
    path: `/sessions/${sessionId}/usage`,
    method: "POST",
    body: {
      model: TUTOR_MODEL,
      inputTokens: 1,
      outputTokens: 1,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    },
  },
  {
    name: "PATCH /sessions/:id/context",
    path: `/sessions/${sessionId}/context`,
    method: "PATCH",
    body: { summary: "The learner lives in Lisbon.", throughId: sessionId },
  },
  {
    name: "PATCH /sessions/:id/title",
    path: `/sessions/${sessionId}/title`,
    method: "PATCH",
    body: { title: "Ramen spots in Tokyo", source: "auto" },
  },
  { name: "POST /sessions/:id/end", path: `/sessions/${sessionId}/end`, method: "POST" },
  { name: "GET /practice/today", path: "/practice/today?tz=UTC", method: "GET" },
  {
    name: "GET /practice/recent-prompts",
    path: "/practice/recent-prompts?days=7&limit=40",
    method: "GET",
  },
  {
    name: "POST /practice/runs",
    path: "/practice/runs",
    method: "POST",
    body: { focus: "mistakes", target: 5 },
  },
  { name: "GET /practice/runs/:id", path: `/practice/runs/${runId}`, method: "GET" },
  {
    name: "POST /practice/runs/:id/items",
    path: `/practice/runs/${runId}/items`,
    method: "POST",
    body: { items: [practiceItemBody] },
  },
  {
    name: "POST /practice/runs/:id/usage",
    path: `/practice/runs/${runId}/usage`,
    method: "POST",
    body: {
      model: TUTOR_MODEL,
      inputTokens: 1,
      outputTokens: 1,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    },
  },
  {
    name: "POST /practice/runs/:id/target",
    path: `/practice/runs/${runId}/target`,
    method: "POST",
    body: { target: 10 },
  },
  {
    name: "POST /practice/runs/:id/finish",
    path: `/practice/runs/${runId}/finish`,
    method: "POST",
  },
  {
    name: "POST /practice/items/:id/answer",
    path: `/practice/items/${itemId}/answer`,
    method: "POST",
    body: { userAnswer: "was", correct: false },
  },
  { name: "GET /messages/:id/thread", path: `/messages/${message.id}/thread`, method: "GET" },
  {
    name: "POST /messages/:id/thread",
    path: `/messages/${message.id}/thread`,
    method: "POST",
    body: { role: "user", text: "Why?" },
  },
  {
    name: "POST /messages/:id/withdraw",
    path: `/messages/${message.id}/withdraw`,
    method: "POST",
    body: { items: [0] },
  },
];

describe("authentication of the data routes", () => {
  for (const route of routes) {
    const init = (headers: Record<string, string>): RequestInit => ({
      method: route.method,
      headers: route.body === undefined ? headers : { ...jsonType, ...headers },
      body: route.body === undefined ? undefined : json(route.body),
    });

    it(`${route.name} responds 401 without an Authorization header`, async () => {
      const res = await app.request(route.path, init({}));

      expect(res.status).toBe(401);
      expect(fake.callers).toEqual([]);
    });

    it(`${route.name} responds 401 with a token signed by another key`, async () => {
      const bad = await token({}, otherKey);
      const res = await app.request(route.path, init({ Authorization: `Bearer ${bad}` }));

      expect(res.status).toBe(401);
      expect(fake.callers).toEqual([]);
    });
  }

  it("responds 401 when the store reports unauthorized", async () => {
    fake.user.getProfile.mockResolvedValue({ ok: false, failure: "unauthorized" });

    const res = await app.request("/profile", { headers: await authed() });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });
});

describe("GET /profile", () => {
  it("responds 200 with the profile", async () => {
    fake.user.getProfile.mockResolvedValue({ ok: true, value: profile });

    const res = await app.request("/profile", { headers: await authed() });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(profile);
  });

  it("builds the store for the token's user and the raw token", async () => {
    fake.user.getProfile.mockResolvedValue({ ok: true, value: profile });
    const headers = await authed();

    await app.request("/profile", { headers });

    expect(fake.callers).toEqual([
      { id: "user-1", accessToken: headers.Authorization.replace("Bearer ", "") },
    ]);
  });

  it("responds 503 when the store is unavailable", async () => {
    fake.user.getProfile.mockResolvedValue({ ok: false, failure: "unavailable" });

    const res = await app.request("/profile", { headers: await authed() });

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
  });
});

describe("PUT /profile", () => {
  async function put(body: string, headers: Record<string, string> = jsonType) {
    return app.request("/profile", {
      method: "PUT",
      headers: await authed(headers),
      body,
    });
  }

  it("responds 200 with the updated profile and hands the parsed update to the store", async () => {
    fake.user.updateProfile.mockResolvedValue({
      ok: true,
      value: { ...profile, level: "advanced" },
    });

    const res = await put(json({ level: "advanced", displayName: "  Ada " }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ level: "advanced" });
    expect(fake.user.updateProfile).toHaveBeenCalledWith({ level: "advanced", displayName: "Ada" });
  });

  it("responds 200 for catalog topics and hands them to the store", async () => {
    const topics = ["food", "music", "travel"];
    fake.user.updateProfile.mockResolvedValue({ ok: true, value: { ...profile, topics } });

    const res = await put(json({ topics }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ topics });
    expect(fake.user.updateProfile).toHaveBeenCalledWith({ topics });
  });

  it("responds 400 invalid_input for a topic outside the catalog", async () => {
    for (const topics of [["cooking"], ["food", "cooking"], ["articles"]]) {
      const res = await put(json({ topics }));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_input" });
    }
    expect(fake.user.updateProfile).not.toHaveBeenCalled();
  });

  it("responds 400 for an empty body object", async () => {
    const res = await put(json({}));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_input" });
    expect(fake.user.updateProfile).not.toHaveBeenCalled();
  });

  it("responds 400 for an unknown level", async () => {
    expect((await put(json({ level: "expert" }))).status).toBe(400);
  });

  it("responds 400 for a monthly limit under a cent", async () => {
    const res = await put(json({ monthlyLimitUsd: 0.004 }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_input" });
    expect(fake.user.updateProfile).not.toHaveBeenCalled();
  });

  it("responds 400 for an apiKey field", async () => {
    expect((await put(json({ level: "beginner", apiKey: "x" }))).status).toBe(400);
    expect(fake.user.updateProfile).not.toHaveBeenCalled();
  });

  it("responds 400 for a body that is not JSON", async () => {
    expect((await put("{nope")).status).toBe(400);
  });

  it("responds 400 for a request without Content-Type", async () => {
    expect((await put(json({ level: "beginner" }), {})).status).toBe(400);
  });

  it("responds 404 when the store returns null", async () => {
    fake.user.updateProfile.mockResolvedValue({ ok: true, value: null });

    expect((await put(json({ level: "beginner" }))).status).toBe(404);
  });

  it("responds 503 when the store is unavailable", async () => {
    fake.user.updateProfile.mockResolvedValue({ ok: false, failure: "unavailable" });

    expect((await put(json({ level: "beginner" }))).status).toBe(503);
  });
});

describe("GET /sessions/active", () => {
  it("responds 200 with { activeSession: null } when there is none", async () => {
    fake.user.getActiveSession.mockResolvedValue({ ok: true, value: null });

    const res = await app.request("/sessions/active", { headers: await authed() });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ activeSession: null });
  });

  it("responds 200 with the session and its last message", async () => {
    const active: ActiveSession = { session, lastMessage: message };
    fake.user.getActiveSession.mockResolvedValue({ ok: true, value: active });

    const res = await app.request("/sessions/active", { headers: await authed() });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ activeSession: active });
  });

  it("responds 503 when the store is unavailable", async () => {
    fake.user.getActiveSession.mockResolvedValue({ ok: false, failure: "unavailable" });

    expect((await app.request("/sessions/active", { headers: await authed() })).status).toBe(503);
  });
});

describe("GET /sessions/open", () => {
  it("responds 200 with the open sessions and their last messages", async () => {
    const open: ActiveSession[] = [
      { session, lastMessage: message },
      { session, lastMessage: null },
    ];
    fake.user.listOpenSessions.mockResolvedValue({ ok: true, value: open });

    const res = await app.request("/sessions/open", { headers: await authed() });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sessions: open });
  });

  it("responds 200 with { sessions: [] } when there is none", async () => {
    fake.user.listOpenSessions.mockResolvedValue({ ok: true, value: [] });

    const res = await app.request("/sessions/open", { headers: await authed() });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sessions: [] });
  });

  it("builds the store for the token's user", async () => {
    fake.user.listOpenSessions.mockResolvedValue({ ok: true, value: [] });
    const headers = await authed();

    await app.request("/sessions/open", { headers });

    expect(fake.callers).toEqual([
      { id: "user-1", accessToken: headers.Authorization.replace("Bearer ", "") },
    ]);
  });

  it("responds 503 when the store is unavailable", async () => {
    fake.user.listOpenSessions.mockResolvedValue({ ok: false, failure: "unavailable" });

    expect((await app.request("/sessions/open", { headers: await authed() })).status).toBe(503);
  });

  it("responds 401 when the store reports unauthorized", async () => {
    fake.user.listOpenSessions.mockResolvedValue({ ok: false, failure: "unauthorized" });

    expect((await app.request("/sessions/open", { headers: await authed() })).status).toBe(401);
  });
});

describe("DELETE /sessions/:id", () => {
  async function remove(id: string) {
    return app.request(`/sessions/${id}`, { method: "DELETE", headers: await authed() });
  }

  it("responds 200 with the deleted session", async () => {
    fake.user.deleteSession.mockResolvedValue({ ok: true, value: session });

    const res = await remove(sessionId);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(session);
    expect(fake.user.deleteSession).toHaveBeenCalledWith(sessionId);
  });

  it("responds 400 for an id that is not a uuid", async () => {
    expect((await remove("abc")).status).toBe(400);
    expect(fake.user.deleteSession).not.toHaveBeenCalled();
  });

  it("responds 404 when the session is not the caller's", async () => {
    fake.user.deleteSession.mockResolvedValue({ ok: true, value: null });
    expect((await remove(sessionId)).status).toBe(404);
  });

  it("responds 503 when the store is unavailable", async () => {
    fake.user.deleteSession.mockResolvedValue({ ok: false, failure: "unavailable" });
    expect((await remove(sessionId)).status).toBe(503);
  });
});

describe("GET /sessions/week", () => {
  async function week(query: string) {
    return app.request(`/sessions/week${query}`, { headers: await authed() });
  }

  beforeEach(() => {
    fake.user.listFinishedRunsSince.mockResolvedValue({ ok: true, value: [] });
  });

  it("responds 200 with the week and no days when there are no sessions", async () => {
    fake.user.listSessionStarts.mockResolvedValue({ ok: true, value: [] });

    const res = await week("?tz=UTC");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      weekStart: "2026-11-02",
      today: "2026-11-05",
      days: [],
      perfectDays: [],
    });
  });

  it("responds 200 with the days that have a session", async () => {
    fake.user.listSessionStarts.mockResolvedValue({
      ok: true,
      value: [
        "2026-11-02T09:00:00+00:00",
        "2026-11-04T09:00:00+00:00",
        "2026-11-04T19:00:00+00:00",
      ],
    });

    const res = await week("?tz=UTC");

    expect(await res.json()).toEqual({
      weekStart: "2026-11-02",
      today: "2026-11-05",
      days: ["2026-11-02", "2026-11-04"],
      perfectDays: [],
    });
  });

  it("reads the sessions since eight days before now", async () => {
    fake.user.listSessionStarts.mockResolvedValue({ ok: true, value: [] });

    await week("?tz=UTC");

    expect(fake.user.listSessionStarts).toHaveBeenCalledWith("2026-10-28T12:00:00.000Z");
  });

  it("uses the time zone of the query", async () => {
    fake.user.listSessionStarts.mockResolvedValue({
      ok: true,
      value: ["2026-11-05T02:00:00+00:00"],
    });

    const res = await week("?tz=America%2FArgentina%2FBuenos_Aires");

    expect(await res.json()).toEqual({
      weekStart: "2026-11-02",
      today: "2026-11-05",
      days: ["2026-11-04"],
      perfectDays: [],
    });
  });

  it("counts a day with a finished run and no session", async () => {
    fake.user.listSessionStarts.mockResolvedValue({ ok: true, value: [] });
    fake.user.listFinishedRunsSince.mockResolvedValue({
      ok: true,
      value: [{ finishedAt: "2026-11-03T10:00:00+00:00", missed: true }],
    });

    const res = await week("?tz=UTC");

    expect(await res.json()).toEqual({
      weekStart: "2026-11-02",
      today: "2026-11-05",
      days: ["2026-11-03"],
      perfectDays: [],
    });
  });

  it("answers the perfect days of runs with no miss", async () => {
    fake.user.listSessionStarts.mockResolvedValue({ ok: true, value: [] });
    fake.user.listFinishedRunsSince.mockResolvedValue({
      ok: true,
      value: [
        { finishedAt: "2026-11-03T10:00:00+00:00", missed: false },
        { finishedAt: "2026-11-04T10:00:00+00:00", missed: true },
      ],
    });

    const res = await week("?tz=UTC");

    expect(await res.json()).toEqual({
      weekStart: "2026-11-02",
      today: "2026-11-05",
      days: ["2026-11-03", "2026-11-04"],
      perfectDays: ["2026-11-03"],
    });
  });

  it("reads the finished runs since eight days before now", async () => {
    fake.user.listSessionStarts.mockResolvedValue({ ok: true, value: [] });

    await week("?tz=UTC");

    expect(fake.user.listFinishedRunsSince).toHaveBeenCalledWith("2026-10-28T12:00:00.000Z");
  });

  it("responds 401 when the runs read reports unauthorized", async () => {
    fake.user.listSessionStarts.mockResolvedValue({ ok: true, value: [] });
    fake.user.listFinishedRunsSince.mockResolvedValue({ ok: false, failure: "unauthorized" });

    expect((await week("?tz=UTC")).status).toBe(401);
  });

  it("responds 503 when the runs read is unavailable", async () => {
    fake.user.listSessionStarts.mockResolvedValue({ ok: true, value: [] });
    fake.user.listFinishedRunsSince.mockResolvedValue({ ok: false, failure: "unavailable" });

    expect((await week("?tz=UTC")).status).toBe(503);
  });

  it("responds 400 for an unknown time zone", async () => {
    const res = await week("?tz=Mars%2FOlympus");

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_input" });
  });

  it("responds 400 without tz", async () => {
    expect((await week("")).status).toBe(400);
  });

  it("responds 401 when the store reports unauthorized", async () => {
    fake.user.listSessionStarts.mockResolvedValue({ ok: false, failure: "unauthorized" });

    expect((await week("?tz=UTC")).status).toBe(401);
  });

  it("responds 503 when the store is unavailable", async () => {
    fake.user.listSessionStarts.mockResolvedValue({ ok: false, failure: "unavailable" });

    expect((await week("?tz=UTC")).status).toBe(503);
  });
});

describe("POST /sessions", () => {
  async function post(body: string) {
    return app.request("/sessions", { method: "POST", headers: await authed(jsonType), body });
  }

  it("responds 201 with the session", async () => {
    fake.user.createSession.mockResolvedValue({ ok: true, value: session });

    const res = await post(json({ topicId: null }));

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(session);
  });

  it("titles a topic session with its label and a free chat 'Free chat'", async () => {
    fake.user.createSession.mockResolvedValue({ ok: true, value: session });

    await post(json({ topicId: "job_interviews" }));
    await post(json({ topicId: null }));

    expect(fake.user.createSession).toHaveBeenNthCalledWith(1, {
      topicId: "job_interviews",
      title: "Job interviews",
    });
    expect(fake.user.createSession).toHaveBeenNthCalledWith(2, {
      topicId: null,
      title: "Free chat",
    });
  });

  it("responds 400 for an unknown topic", async () => {
    const res = await post(json({ topicId: "cooking" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_input" });
    expect(fake.user.createSession).not.toHaveBeenCalled();
  });

  it("responds 400 for a grammar topic, which is not a conversation topic", async () => {
    const res = await post(json({ topicId: "articles" }));
    expect(res.status).toBe(400);
    expect(fake.user.createSession).not.toHaveBeenCalled();
  });

  it("responds 400 for a missing topicId", async () => {
    expect((await post(json({}))).status).toBe(400);
    expect(fake.user.createSession).not.toHaveBeenCalled();
  });

  it("responds 503 when the store is unavailable", async () => {
    fake.user.createSession.mockResolvedValue({ ok: false, failure: "unavailable" });

    expect((await post(json({ topicId: null }))).status).toBe(503);
  });
});

describe("POST /sessions with a starter", () => {
  it("titles the session with the starter's title and topic", async () => {
    fake.user.createSession.mockResolvedValue({ ok: true, value: session });

    const res = await app.request("/sessions", {
      method: "POST",
      headers: await authed(jsonType),
      body: json({ starterId: "tech-app" }),
    });

    expect(res.status).toBe(201);
    expect(fake.user.createSession).toHaveBeenCalledWith({
      topicId: "technology",
      title: "The app you use most",
    });
  });

  it("uses a null topic for a goal starter", async () => {
    fake.user.createSession.mockResolvedValue({ ok: true, value: session });
    const goalStarter = STARTERS.find((entry) => entry.topicId === null);
    if (goalStarter === undefined) throw new Error("no goal starter in the catalog");

    await app.request("/sessions", {
      method: "POST",
      headers: await authed(jsonType),
      body: json({ starterId: goalStarter.id }),
    });

    expect(fake.user.createSession).toHaveBeenCalledWith({
      topicId: null,
      title: goalStarter.title,
    });
  });

  it("responds 400 for an unknown starter", async () => {
    const res = await app.request("/sessions", {
      method: "POST",
      headers: await authed(jsonType),
      body: json({ starterId: "nope" }),
    });
    expect(res.status).toBe(400);
    expect(fake.user.createSession).not.toHaveBeenCalled();
  });
});

describe("GET /sessions/spend", () => {
  async function spend(query: string) {
    return app.request(`/sessions/spend${query}`, { headers: await authed() });
  }

  it("responds 200 with 0 when nothing was spent", async () => {
    fake.user.listSessionCostsSince.mockResolvedValue({ ok: true, value: [] });

    const res = await spend("?tz=UTC");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ monthStart: "2026-11-01", spentUsd: 0 });
  });

  it("sums this month's sessions and reads since 32 days before now", async () => {
    fake.user.listSessionCostsSince.mockResolvedValue({
      ok: true,
      value: [
        { createdAt: "2026-11-02T09:00:00+00:00", costUsd: 0.25 },
        { createdAt: "2026-11-04T09:00:00+00:00", costUsd: 0.5 },
      ],
    });

    const res = await spend("?tz=UTC");

    expect(await res.json()).toEqual({ monthStart: "2026-11-01", spentUsd: 0.75 });
    expect(fake.user.listSessionCostsSince).toHaveBeenCalledWith("2026-10-04T12:00:00.000Z");
  });

  it("leaves out a session of the previous month in the zone", async () => {
    fake.user.listSessionCostsSince.mockResolvedValue({
      ok: true,
      value: [{ createdAt: "2026-11-01T02:30:00+00:00", costUsd: 1 }],
    });

    const res = await spend("?tz=America%2FArgentina%2FBuenos_Aires");

    expect(await res.json()).toEqual({ monthStart: "2026-11-01", spentUsd: 0 });
  });

  it("still includes the cost of a session after it is deleted", async () => {
    // INFO: models the store: a delete moves the session cost to the ledger,
    // and the cost read returns the sessions and the ledger together.
    const sessions = [{ createdAt: "2026-11-02T09:00:00+00:00", costUsd: 0.25 }];
    const ledger: { createdAt: string; costUsd: number }[] = [];
    fake.user.listSessionCostsSince.mockImplementation(async () => ({
      ok: true,
      value: [...sessions, ...ledger],
    }));
    fake.user.deleteSession.mockImplementation(async () => {
      ledger.push(...sessions.splice(0));
      return { ok: true, value: session };
    });

    const before = await (await spend("?tz=UTC")).json();
    const deleted = await app.request(`/sessions/${sessionId}`, {
      method: "DELETE",
      headers: await authed(),
    });
    const after = await (await spend("?tz=UTC")).json();

    expect(deleted.status).toBe(200);
    expect(before).toEqual({ monthStart: "2026-11-01", spentUsd: 0.25 });
    expect(after).toEqual({ monthStart: "2026-11-01", spentUsd: 0.25 });
  });

  it("responds 400 for an unknown time zone and without tz", async () => {
    expect((await spend("?tz=Mars%2FOlympus")).status).toBe(400);
    expect((await spend("")).status).toBe(400);
  });

  it("responds 401 when the store reports unauthorized", async () => {
    fake.user.listSessionCostsSince.mockResolvedValue({ ok: false, failure: "unauthorized" });
    expect((await spend("?tz=UTC")).status).toBe(401);
  });

  it("responds 503 when the store is unavailable", async () => {
    fake.user.listSessionCostsSince.mockResolvedValue({ ok: false, failure: "unavailable" });
    expect((await spend("?tz=UTC")).status).toBe(503);
  });
});

describe("GET /profile/stats", () => {
  async function stats(query: string) {
    return app.request(`/profile/stats${query}`, { headers: await authed() });
  }

  it("answers the session count, the day streak and the new words for the caller's zone", async () => {
    fake.user.getStats.mockResolvedValue({
      ok: true,
      value: {
        sessionCount: 12,
        sessionDays: ["2026-11-05", "2026-11-04", "2026-11-01"],
        newWords: 5,
      },
    });

    const res = await stats("?tz=America%2FArgentina%2FBuenos_Aires");

    expect(res.status).toBe(200);
    expect(profileStatsSchema.parse(await res.json())).toEqual({
      sessions: 12,
      dayStreak: 2,
      newWords: 5,
    });
    expect(fake.user.getStats).toHaveBeenCalledWith("America/Argentina/Buenos_Aires");
  });

  it("counts the streak back from yesterday while today has no session yet", async () => {
    fake.user.getStats.mockResolvedValue({
      ok: true,
      value: { sessionCount: 2, sessionDays: ["2026-11-04", "2026-11-03"], newWords: 0 },
    });

    const res = await stats("?tz=UTC");

    expect(await res.json()).toEqual({ sessions: 2, dayStreak: 2, newWords: 0 });
  });

  it("answers zeros for a user with no sessions", async () => {
    fake.user.getStats.mockResolvedValue({
      ok: true,
      value: { sessionCount: 0, sessionDays: [], newWords: 0 },
    });

    const res = await stats("?tz=UTC");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sessions: 0, dayStreak: 0, newWords: 0 });
  });

  it("answers 401 when the store is unauthorized", async () => {
    fake.user.getStats.mockResolvedValue({ ok: false, failure: "unauthorized" });
    expect((await stats("?tz=UTC")).status).toBe(401);
  });

  it("answers 503 when the store is unavailable", async () => {
    fake.user.getStats.mockResolvedValue({ ok: false, failure: "unavailable" });
    expect((await stats("?tz=UTC")).status).toBe(503);
  });

  it("answers 400 for an unknown zone and without tz, and reads nothing", async () => {
    expect((await stats("?tz=Mars%2FOlympus")).status).toBe(400);
    expect((await stats("")).status).toBe(400);
    expect(fake.user.getStats).not.toHaveBeenCalled();
  });

  it("answers 400 for a raw offset and a GMT offset form", async () => {
    expect((await stats("?tz=-03:00")).status).toBe(400);
    expect((await stats("?tz=%2B05:30")).status).toBe(400);
    expect((await stats("?tz=GMT-3")).status).toBe(400);
    expect(fake.user.getStats).not.toHaveBeenCalled();
  });
});

describe("DELETE /account", () => {
  async function remove() {
    return app.request("/account", { method: "DELETE", headers: await authed() });
  }

  it("deletes the caller from the token and answers { deleted: true }", async () => {
    fake.user.deleteAccount.mockResolvedValue({ ok: true, value: null });

    const res = await remove();

    expect(res.status).toBe(200);
    expect(accountDeletedSchema.parse(await res.json())).toEqual({ deleted: true });
    expect(fake.callers.map((caller) => caller.id)).toEqual(["user-1"]);
    expect(fake.user.deleteAccount).toHaveBeenCalledTimes(1);
  });

  it("answers 401 when the store is unauthorized", async () => {
    fake.user.deleteAccount.mockResolvedValue({ ok: false, failure: "unauthorized" });
    expect((await remove()).status).toBe(401);
  });

  it("answers 503 when the store is unavailable", async () => {
    fake.user.deleteAccount.mockResolvedValue({ ok: false, failure: "unavailable" });
    expect((await remove()).status).toBe(503);
  });

  it("answers 401 without a token and deletes nothing", async () => {
    const res = await app.request("/account", { method: "DELETE" });

    expect(res.status).toBe(401);
    expect(fake.user.deleteAccount).not.toHaveBeenCalled();
  });
});

describe("GET /sessions/:id/messages", () => {
  async function list(id: string) {
    return app.request(`/sessions/${id}/messages`, { headers: await authed() });
  }

  it("responds 200 with the session and its messages", async () => {
    fake.user.getSessionWithMessages.mockResolvedValue({
      ok: true,
      value: { session, messages: [message] },
    });
    fake.user.listThreadCounts.mockResolvedValue({ ok: true, value: [] });
    fake.user.listSessionNotes.mockResolvedValue({ ok: true, value: [] });

    const res = await list(sessionId);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      session,
      messages: [message],
      threadReplies: [],
      notes: [],
    });
    expect(fake.user.getSessionWithMessages).toHaveBeenCalledWith(sessionId);
  });

  it("responds 200 with no messages for a session with none", async () => {
    fake.user.getSessionWithMessages.mockResolvedValue({
      ok: true,
      value: { session, messages: [] },
    });
    fake.user.listThreadCounts.mockResolvedValue({ ok: true, value: [] });
    fake.user.listSessionNotes.mockResolvedValue({ ok: true, value: [] });

    const res = await list(sessionId);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ session, messages: [], threadReplies: [], notes: [] });
  });

  it("carries the reply count of each message that has a thread", async () => {
    fake.user.getSessionWithMessages.mockResolvedValue({
      ok: true,
      value: { session, messages: [message] },
    });
    fake.user.listThreadCounts.mockResolvedValue({
      ok: true,
      value: [{ messageId: message.id, count: 2 }],
    });
    fake.user.listSessionNotes.mockResolvedValue({ ok: true, value: [] });

    const res = await list(sessionId);

    expect(await res.json()).toMatchObject({
      threadReplies: [{ messageId: message.id, count: 2 }],
    });
    expect(fake.user.listThreadCounts).toHaveBeenCalledWith(sessionId);
  });

  it("responds 503 when the thread counts fail", async () => {
    fake.user.getSessionWithMessages.mockResolvedValue({
      ok: true,
      value: { session, messages: [message] },
    });
    fake.user.listThreadCounts.mockResolvedValue({ ok: false, failure: "unavailable" });

    expect((await list(sessionId)).status).toBe(503);
  });

  it("responds 401 when the thread counts report unauthorized", async () => {
    fake.user.getSessionWithMessages.mockResolvedValue({
      ok: true,
      value: { session, messages: [message] },
    });
    fake.user.listThreadCounts.mockResolvedValue({ ok: false, failure: "unauthorized" });

    expect((await list(sessionId)).status).toBe(401);
  });

  it("carries the notes saved in the session", async () => {
    fake.user.getSessionWithMessages.mockResolvedValue({
      ok: true,
      value: { session, messages: [message] },
    });
    fake.user.listThreadCounts.mockResolvedValue({ ok: true, value: [] });
    fake.user.listSessionNotes.mockResolvedValue({ ok: true, value: [studyNote] });

    const res = await list(sessionId);

    expect(await res.json()).toMatchObject({ notes: [studyNote] });
    expect(fake.user.listSessionNotes).toHaveBeenCalledWith(sessionId);
  });

  it("responds 503 when the notes read fails", async () => {
    fake.user.getSessionWithMessages.mockResolvedValue({
      ok: true,
      value: { session, messages: [message] },
    });
    fake.user.listThreadCounts.mockResolvedValue({ ok: true, value: [] });
    fake.user.listSessionNotes.mockResolvedValue({ ok: false, failure: "unavailable" });

    expect((await list(sessionId)).status).toBe(503);
  });

  it("responds 400 for an id that is not a uuid", async () => {
    expect((await list("abc")).status).toBe(400);
    expect(fake.user.getSessionWithMessages).not.toHaveBeenCalled();
  });

  it("responds 404 when the session is not visible", async () => {
    fake.user.getSessionWithMessages.mockResolvedValue({ ok: true, value: null });

    expect((await list(sessionId)).status).toBe(404);
  });

  it("responds 503 when the store is unavailable", async () => {
    fake.user.getSessionWithMessages.mockResolvedValue({ ok: false, failure: "unavailable" });

    expect((await list(sessionId)).status).toBe(503);
  });
});

describe("GET /sessions/:id/summary", () => {
  async function summary(id: string) {
    return app.request(`/sessions/${id}/summary`, { headers: await authed() });
  }

  it("responds 200 with the session, its message count, corrections and new words", async () => {
    const corrected: Message = {
      ...message,
      corrections: {
        items: [
          { original: "I never been", corrected: "I've never been", rule: "Present perfect" },
        ],
        explanation: "Use the present perfect.",
      },
      newWords: ["definitely"],
    };
    const reply: Message = { ...message, role: "tutor", text: "Nice!" };
    fake.user.getSessionWithMessages.mockResolvedValue({
      ok: true,
      value: { session, messages: [corrected, reply] },
    });
    fake.user.listThreadWords.mockResolvedValue({ ok: true, value: [] });

    const res = await summary(sessionId);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      session,
      messageCount: 2,
      corrections: [
        { original: "I never been", corrected: "I've never been", rule: "Present perfect" },
      ],
      newWords: ["definitely"],
    });
    expect(fake.user.getSessionWithMessages).toHaveBeenCalledWith(sessionId);
  });

  it("responds 200 with zero counts and empty lists for a session with no messages", async () => {
    fake.user.getSessionWithMessages.mockResolvedValue({
      ok: true,
      value: { session, messages: [] },
    });
    fake.user.listThreadWords.mockResolvedValue({ ok: true, value: [] });

    const res = await summary(sessionId);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ session, messageCount: 0, corrections: [], newWords: [] });
  });

  it("responds 404 for another user's session", async () => {
    fake.user.getSessionWithMessages.mockResolvedValue({ ok: true, value: null });

    const res = await summary(sessionId);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("responds 400 for an id that is not a uuid", async () => {
    expect((await summary("abc")).status).toBe(400);
    expect(fake.user.getSessionWithMessages).not.toHaveBeenCalled();
  });

  it("responds 401 without a token", async () => {
    const res = await app.request(`/sessions/${sessionId}/summary`);

    expect(res.status).toBe(401);
    expect(fake.user.getSessionWithMessages).not.toHaveBeenCalled();
  });

  it("responds 401 when the store is unauthorized", async () => {
    fake.user.getSessionWithMessages.mockResolvedValue({ ok: false, failure: "unauthorized" });

    const res = await summary(sessionId);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("responds 503 when the store is unavailable", async () => {
    fake.user.getSessionWithMessages.mockResolvedValue({ ok: false, failure: "unavailable" });

    expect((await summary(sessionId)).status).toBe(503);
  });

  it("responds 200 with the words taught in the session's threads, once each", async () => {
    fake.user.getSessionWithMessages.mockResolvedValue({
      ok: true,
      value: { session, messages: [{ ...message, newWords: ["definitely"] }] },
    });
    fake.user.listThreadWords.mockResolvedValue({
      ok: true,
      value: ["Deadline", "definitely", "deadline"],
    });

    const res = await summary(sessionId);

    expect(res.status).toBe(200);
    expect(((await res.json()) as { newWords: string[] }).newWords).toEqual([
      "definitely",
      "Deadline",
    ]);
    expect(fake.user.listThreadWords).toHaveBeenCalledWith(sessionId);
  });

  it("never returns a thread word of another session", async () => {
    fake.user.getSessionWithMessages.mockResolvedValue({
      ok: true,
      value: { session, messages: [] },
    });
    fake.user.listThreadWords.mockImplementation(async (id) => ({
      ok: true,
      value: id === sessionId ? ["deadline"] : ["elsewhere"],
    }));

    const res = await summary(sessionId);

    const body = (await res.json()) as { newWords: string[] };
    expect(body.newWords).toEqual(["deadline"]);
    expect(body.newWords).not.toContain("elsewhere");
    expect(fake.user.listThreadWords).toHaveBeenCalledTimes(1);
    expect(fake.user.listThreadWords).toHaveBeenCalledWith(sessionId);
  });

  it("does not read thread words for a session that is not the caller's", async () => {
    fake.user.getSessionWithMessages.mockResolvedValue({ ok: true, value: null });

    expect((await summary(sessionId)).status).toBe(404);
    expect(fake.user.listThreadWords).not.toHaveBeenCalled();
  });

  it("responds 401 when the thread words read is unauthorized", async () => {
    fake.user.getSessionWithMessages.mockResolvedValue({
      ok: true,
      value: { session, messages: [] },
    });
    fake.user.listThreadWords.mockResolvedValue({ ok: false, failure: "unauthorized" });

    const res = await summary(sessionId);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("responds 503 when the thread words read is unavailable", async () => {
    fake.user.getSessionWithMessages.mockResolvedValue({
      ok: true,
      value: { session, messages: [] },
    });
    fake.user.listThreadWords.mockResolvedValue({ ok: false, failure: "unavailable" });

    expect((await summary(sessionId)).status).toBe(503);
  });
});

describe("POST /sessions/:id/messages", () => {
  async function add(id: string, body: string, headers?: Record<string, string>) {
    return app.request(`/sessions/${id}/messages`, {
      method: "POST",
      headers: headers ?? (await authed(jsonType)),
      body,
    });
  }

  it("responds 201 with the saved message", async () => {
    fake.user.addMessage.mockResolvedValue({ ok: true, value: message });

    const res = await add(sessionId, json({ role: "user", text: "Hello" }));

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(message);
    expect(fake.user.addMessage).toHaveBeenCalledWith(sessionId, { role: "user", text: "Hello" });
  });

  it("passes the corrections and new words to the store", async () => {
    fake.user.addMessage.mockResolvedValue({ ok: true, value: message });
    const body = {
      role: "user",
      text: "I never been",
      corrections: { items: [{ original: "a", corrected: "b" }], explanation: null },
      newWords: ["definitely"],
    };

    await add(sessionId, json(body));

    expect(fake.user.addMessage).toHaveBeenCalledWith(sessionId, body);
  });

  it("passes replyToId to the store", async () => {
    fake.user.addMessage.mockResolvedValue({ ok: true, value: message });
    const replyToId = "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ec2";

    await add(sessionId, json({ role: "user", text: "Hi", replyToId }));

    expect(fake.user.addMessage).toHaveBeenCalledWith(sessionId, {
      role: "user",
      text: "Hi",
      replyToId,
    });
  });

  it("responds 400 for a replyToId that is not a uuid", async () => {
    const res = await add(sessionId, json({ role: "user", text: "Hi", replyToId: "abc" }));
    expect(res.status).toBe(400);
    expect(fake.user.addMessage).not.toHaveBeenCalled();
  });

  it("responds 503 unavailable when the store rejects the reply", async () => {
    fake.user.addMessage.mockResolvedValue({ ok: false, failure: "unavailable" });
    const replyToId = "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ec2";

    const res = await add(sessionId, json({ role: "user", text: "Hi", replyToId }));

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
  });

  it("responds 400 for an id that is not a uuid, a bad body and a missing Content-Type", async () => {
    expect((await add("abc", json({ role: "user", text: "Hi" }))).status).toBe(400);
    expect((await add(sessionId, json({ role: "user", text: "" }))).status).toBe(400);
    expect((await add(sessionId, json({ role: "user", text: "Hi" }), await authed())).status).toBe(
      400,
    );
    expect(fake.user.addMessage).not.toHaveBeenCalled();
  });

  it("responds 400 when the body carries an apiKey field", async () => {
    const res = await add(sessionId, json({ role: "user", text: "Hi", apiKey: "x" }));
    expect(res.status).toBe(400);
    expect(fake.user.addMessage).not.toHaveBeenCalled();
  });

  it("responds 404 when the session is not visible", async () => {
    fake.user.addMessage.mockResolvedValue({ ok: true, value: null });
    expect((await add(sessionId, json({ role: "user", text: "Hi" }))).status).toBe(404);
  });

  it("responds 503 when the store is unavailable", async () => {
    fake.user.addMessage.mockResolvedValue({ ok: false, failure: "unavailable" });
    expect((await add(sessionId, json({ role: "user", text: "Hi" }))).status).toBe(503);
  });
});

describe("POST /sessions/:id/usage", () => {
  const usage = {
    model: TUTOR_MODEL,
    inputTokens: 700,
    outputTokens: 150,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
  };

  async function post(id: string, body: string, headers?: Record<string, string>) {
    return app.request(`/sessions/${id}/usage`, {
      method: "POST",
      headers: headers ?? (await authed(jsonType)),
      body,
    });
  }

  it("adds the usage times the price", async () => {
    fake.user.addSessionCost.mockResolvedValue({
      ok: true,
      value: { ...session, costUsd: 0.000145 },
    });

    const res = await post(sessionId, json(usage));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...session, costUsd: 0.000145 });
    expect(fake.user.addSessionCost).toHaveBeenCalledWith(
      sessionId,
      usageCostUsd(TUTOR_MODEL, usage),
    );
    expect(fake.user.addSessionCost).toHaveBeenCalledWith(sessionId, 0.000145);
  });

  it("adds 0 for a zero usage", async () => {
    fake.user.addSessionCost.mockResolvedValue({ ok: true, value: session });

    await post(sessionId, json({ ...usage, inputTokens: 0, outputTokens: 0 }));

    expect(fake.user.addSessionCost).toHaveBeenCalledWith(sessionId, 0);
  });

  it("responds 400 for an unknown model", async () => {
    expect((await post(sessionId, json({ ...usage, model: "other" }))).status).toBe(400);
    expect(fake.user.addSessionCost).not.toHaveBeenCalled();
  });

  it("responds 400 for a bad id, a negative count and a missing Content-Type", async () => {
    expect((await post("abc", json(usage))).status).toBe(400);
    expect((await post(sessionId, json({ ...usage, inputTokens: -1 }))).status).toBe(400);
    expect((await post(sessionId, json(usage), await authed())).status).toBe(400);
  });

  it("responds 400 when the body carries an apiKey field", async () => {
    expect((await post(sessionId, json({ ...usage, apiKey: "x" }))).status).toBe(400);
    expect(fake.user.addSessionCost).not.toHaveBeenCalled();
  });

  it("responds 404 when the session is not visible", async () => {
    fake.user.addSessionCost.mockResolvedValue({ ok: true, value: null });
    expect((await post(sessionId, json(usage))).status).toBe(404);
  });

  it("responds 503 when the store is unavailable", async () => {
    fake.user.addSessionCost.mockResolvedValue({ ok: false, failure: "unavailable" });
    expect((await post(sessionId, json(usage))).status).toBe(503);
  });
});

describe("PATCH /sessions/:id/context", () => {
  const throughId = "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5eb1";

  async function save(id: string, body: unknown) {
    return app.request(`/sessions/${id}/context`, {
      method: "PATCH",
      headers: { ...(await authed()), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("responds 200 with the session and saves the trimmed summary", async () => {
    const saved = { ...session, contextSummary: "Lives in Lisbon.", contextThroughId: throughId };
    fake.user.setSessionContext.mockResolvedValue({ ok: true, value: saved });

    const res = await save(sessionId, { summary: "  Lives in Lisbon.  ", throughId });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(saved);
    expect(fake.user.setSessionContext).toHaveBeenCalledWith(sessionId, {
      summary: "Lives in Lisbon.",
      throughId,
    });
  });

  it("responds 400 for an id that is not a uuid", async () => {
    expect((await save("abc", { summary: "Lisbon.", throughId })).status).toBe(400);
    expect(fake.user.setSessionContext).not.toHaveBeenCalled();
  });

  it("responds 400 for an empty summary, one over 2000 characters, a through id that is not a uuid, or an unknown key", async () => {
    const bodies = [
      { summary: "  ", throughId },
      { summary: "a".repeat(2001), throughId },
      { summary: "Lisbon.", throughId: "m1" },
      { summary: "Lisbon.", throughId, apiKey: "x" },
    ];
    for (const body of bodies) {
      expect((await save(sessionId, body)).status).toBe(400);
    }
    expect(fake.user.setSessionContext).not.toHaveBeenCalled();
  });

  it("responds 404 when the session is not visible", async () => {
    fake.user.setSessionContext.mockResolvedValue({ ok: true, value: null });
    expect((await save(sessionId, { summary: "Lisbon.", throughId })).status).toBe(404);
  });

  it("responds 401 when the store answers unauthorized", async () => {
    fake.user.setSessionContext.mockResolvedValue({ ok: false, failure: "unauthorized" });
    expect((await save(sessionId, { summary: "Lisbon.", throughId })).status).toBe(401);
  });

  it("responds 503 when the store is unavailable", async () => {
    fake.user.setSessionContext.mockResolvedValue({ ok: false, failure: "unavailable" });
    expect((await save(sessionId, { summary: "Lisbon.", throughId })).status).toBe(503);
  });
});

describe("PATCH /sessions/:id/title", () => {
  async function save(id: string, body: unknown) {
    return app.request(`/sessions/${id}/title`, {
      method: "PATCH",
      headers: { ...(await authed()), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("responds 200 with the session and saves the trimmed title with its source", async () => {
    const saved = { ...session, title: "Ramen spots in Tokyo", titleSource: "auto" as const };
    fake.user.setSessionTitle.mockResolvedValue({ ok: true, value: saved });

    const res = await save(sessionId, { title: "  Ramen spots in Tokyo  ", source: "auto" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(saved);
    expect(fake.user.setSessionTitle).toHaveBeenCalledWith(sessionId, {
      title: "Ramen spots in Tokyo",
      source: "auto",
    });
  });

  it("responds 400 for an id that is not a uuid", async () => {
    expect((await save("abc", { title: "Ramen", source: "user" })).status).toBe(400);
    expect(fake.user.setSessionTitle).not.toHaveBeenCalled();
  });

  it("responds 400 for an empty title, one over 60 characters, the default source, an unknown source or an unknown key", async () => {
    const bodies = [
      { title: "  ", source: "user" },
      { title: "a".repeat(61), source: "user" },
      { title: "Ramen", source: "default" },
      { title: "Ramen", source: "other" },
      { title: "Ramen", source: "user", apiKey: "x" },
    ];
    for (const body of bodies) {
      expect((await save(sessionId, body)).status).toBe(400);
    }
    expect(fake.user.setSessionTitle).not.toHaveBeenCalled();
  });

  it("responds 404 when the session is not visible", async () => {
    fake.user.setSessionTitle.mockResolvedValue({ ok: true, value: null });
    expect((await save(sessionId, { title: "Ramen", source: "user" })).status).toBe(404);
  });

  it("responds 401 when the store answers unauthorized", async () => {
    fake.user.setSessionTitle.mockResolvedValue({ ok: false, failure: "unauthorized" });
    expect((await save(sessionId, { title: "Ramen", source: "user" })).status).toBe(401);
  });

  it("responds 503 when the store is unavailable", async () => {
    fake.user.setSessionTitle.mockResolvedValue({ ok: false, failure: "unavailable" });
    expect((await save(sessionId, { title: "Ramen", source: "user" })).status).toBe(503);
  });
});

describe("POST /sessions/:id/end", () => {
  async function end(id: string) {
    return app.request(`/sessions/${id}/end`, { method: "POST", headers: await authed() });
  }

  it("responds 200 with the ended session", async () => {
    fake.user.endSession.mockResolvedValue({ ok: true, value: { ...session, status: "ended" } });

    const res = await end(sessionId);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...session, status: "ended" });
    expect(fake.user.endSession).toHaveBeenCalledWith(sessionId);
  });

  it("responds 400 for an id that is not a uuid", async () => {
    expect((await end("abc")).status).toBe(400);
    expect(fake.user.endSession).not.toHaveBeenCalled();
  });

  it("responds 404 when the session is not visible", async () => {
    fake.user.endSession.mockResolvedValue({ ok: true, value: null });
    expect((await end(sessionId)).status).toBe(404);
  });

  it("responds 503 when the store is unavailable", async () => {
    fake.user.endSession.mockResolvedValue({ ok: false, failure: "unavailable" });
    expect((await end(sessionId)).status).toBe(503);
  });
});

const threadRow = {
  id: "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ee1",
  messageId: message.id,
  role: "user" as const,
  text: "Why?",
  newWords: null,
  createdAt: stamp,
};

describe("GET /messages/:id/thread", () => {
  async function read(id: string) {
    return app.request(`/messages/${id}/thread`, { headers: await authed() });
  }

  it("responds 200 with the session, the message and the thread", async () => {
    fake.user.getThread.mockResolvedValue({
      ok: true,
      value: { session, message, messages: [threadRow] },
    });

    const res = await read(message.id);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ session, message, messages: [threadRow] });
    expect(fake.user.getThread).toHaveBeenCalledWith(message.id);
  });

  it("responds 200 with an empty thread", async () => {
    fake.user.getThread.mockResolvedValue({ ok: true, value: { session, message, messages: [] } });

    const res = await read(message.id);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ session, message, messages: [] });
  });

  it("responds 400 for an id that is not a uuid", async () => {
    expect((await read("abc")).status).toBe(400);
    expect(fake.user.getThread).not.toHaveBeenCalled();
  });

  it("responds 404 when the message is not visible", async () => {
    fake.user.getThread.mockResolvedValue({ ok: true, value: null });
    expect((await read(message.id)).status).toBe(404);
  });

  it("responds 401 and 503 from the store", async () => {
    fake.user.getThread.mockResolvedValue({ ok: false, failure: "unauthorized" });
    expect((await read(message.id)).status).toBe(401);
    fake.user.getThread.mockResolvedValue({ ok: false, failure: "unavailable" });
    expect((await read(message.id)).status).toBe(503);
  });
});

describe("POST /messages/:id/thread", () => {
  async function write(id: string, body: unknown) {
    return app.request(`/messages/${id}/thread`, {
      method: "POST",
      headers: await authed(jsonType),
      body: json(body),
    });
  }

  it("responds 201 with the saved row", async () => {
    fake.user.addThreadMessage.mockResolvedValue({ ok: true, value: threadRow });

    const res = await write(message.id, { role: "user", text: "Why?" });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(threadRow);
    expect(fake.user.addThreadMessage).toHaveBeenCalledWith(message.id, {
      role: "user",
      text: "Why?",
    });
  });

  it("responds 400 for empty text and for an unknown key", async () => {
    expect((await write(message.id, { role: "user", text: " " })).status).toBe(400);
    expect((await write(message.id, { role: "user", text: "x", apiKey: "k" })).status).toBe(400);
    expect(fake.user.addThreadMessage).not.toHaveBeenCalled();
  });

  it("responds 404 when the message is not visible", async () => {
    fake.user.addThreadMessage.mockResolvedValue({ ok: true, value: null });
    expect((await write(message.id, { role: "user", text: "Why?" })).status).toBe(404);
  });

  it("responds 503 when the store is unavailable", async () => {
    fake.user.addThreadMessage.mockResolvedValue({ ok: false, failure: "unavailable" });
    expect((await write(message.id, { role: "user", text: "Why?" })).status).toBe(503);
  });
});

describe("POST /messages/:id/withdraw", () => {
  async function withdraw(id: string, body: unknown) {
    return app.request(`/messages/${id}/withdraw`, {
      method: "POST",
      headers: await authed(jsonType),
      body: json(body),
    });
  }

  it("responds 200 with the message", async () => {
    fake.user.withdrawCorrections.mockResolvedValue({ ok: true, value: message });

    const res = await withdraw(message.id, { items: [1] });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(message);
    expect(fake.user.withdrawCorrections).toHaveBeenCalledWith(message.id, [1]);
  });

  it("responds 400 for no indexes and for an index above 9", async () => {
    expect((await withdraw(message.id, { items: [] })).status).toBe(400);
    expect((await withdraw(message.id, { items: [10] })).status).toBe(400);
    expect(fake.user.withdrawCorrections).not.toHaveBeenCalled();
  });

  it("responds 404 when the message is not the caller's", async () => {
    fake.user.withdrawCorrections.mockResolvedValue({ ok: true, value: null });
    expect((await withdraw(message.id, { items: [0] })).status).toBe(404);
  });

  it("responds 503 when the store is unavailable", async () => {
    fake.user.withdrawCorrections.mockResolvedValue({ ok: false, failure: "unavailable" });
    expect((await withdraw(message.id, { items: [0] })).status).toBe(503);
  });
});

describe("typed client (data routes)", () => {
  it("exposes the thread routes through AppType", async () => {
    fake.user.getThread.mockResolvedValue({ ok: true, value: { session, message, messages: [] } });
    fake.user.addThreadMessage.mockResolvedValue({ ok: true, value: threadRow });
    fake.user.withdrawCorrections.mockResolvedValue({ ok: true, value: message });
    const client = testClient(app, undefined, undefined, { headers: await authed() });

    const readRes = await client.messages[":id"].thread.$get({ param: { id: message.id } });
    const writeRes = await client.messages[":id"].thread.$post({
      param: { id: message.id },
      json: { role: "user", text: "Why?" },
    });
    const withdrawRes = await client.messages[":id"].withdraw.$post({
      param: { id: message.id },
      json: { items: [0] },
    });

    expect(readRes.status).toBe(200);
    expect(writeRes.status).toBe(201);
    expect(withdrawRes.status).toBe(200);
  });

  it("exposes the recent prompts route through AppType", async () => {
    fake.user.listRecentPrompts.mockResolvedValue({ ok: true, value: [] });
    const client = testClient(app, undefined, undefined, { headers: await authed() });

    const res = await client.practice["recent-prompts"].$get({
      query: { days: "7", limit: "40" },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [] });
  });

  it("exposes the profile and session routes through AppType", async () => {
    fake.user.getProfile.mockResolvedValue({ ok: true, value: profile });
    fake.user.getActiveSession.mockResolvedValue({ ok: true, value: null });
    const client = testClient(app, undefined, undefined, { headers: await authed() });

    const profileRes = await client.profile.$get();
    const activeRes = await client.sessions.active.$get();

    fake.user.listSessionStarts.mockResolvedValue({ ok: true, value: [] });
    fake.user.listFinishedRunsSince.mockResolvedValue({ ok: true, value: [] });
    const weekRes = await client.sessions.week.$get({ query: { tz: "UTC" } });

    expect(profileRes.status).toBe(200);
    expect(await activeRes.json()).toEqual({ activeSession: null });
    expect(weekRes.status).toBe(200);
  });

  it("exposes the summary route through AppType", async () => {
    fake.user.getSessionWithMessages.mockResolvedValue({
      ok: true,
      value: { session, messages: [] },
    });
    fake.user.listThreadWords.mockResolvedValue({ ok: true, value: [] });
    const client = testClient(app, undefined, undefined, { headers: await authed() });

    const res = await client.sessions[":id"].summary.$get({ param: { id: sessionId } });

    expect(res.status).toBe(200);
  });

  it("exposes the chat routes through AppType", async () => {
    fake.user.listSessionCostsSince.mockResolvedValue({ ok: true, value: [] });
    fake.user.addMessage.mockResolvedValue({ ok: true, value: message });
    fake.user.addSessionCost.mockResolvedValue({ ok: true, value: session });
    fake.user.endSession.mockResolvedValue({ ok: true, value: session });
    const client = testClient(app, undefined, undefined, { headers: await authed() });

    const spendRes = await client.sessions.spend.$get({ query: { tz: "UTC" } });
    const messageRes = await client.sessions[":id"].messages.$post({
      param: { id: sessionId },
      json: { role: "user", text: "Hi" },
    });
    const usageRes = await client.sessions[":id"].usage.$post({
      param: { id: sessionId },
      json: {
        model: TUTOR_MODEL,
        inputTokens: 1,
        outputTokens: 1,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      },
    });
    const endRes = await client.sessions[":id"].end.$post({ param: { id: sessionId } });

    expect(spendRes.status).toBe(200);
    expect(messageRes.status).toBe(201);
    expect(usageRes.status).toBe(200);
    expect(endRes.status).toBe(200);
  });

  it("exposes the open chats routes through AppType", async () => {
    fake.user.listOpenSessions.mockResolvedValue({ ok: true, value: [] });
    fake.user.deleteSession.mockResolvedValue({ ok: true, value: session });
    const client = testClient(app, undefined, undefined, { headers: await authed() });

    const openRes = await client.sessions.open.$get();
    const deleteRes = await client.sessions[":id"].$delete({ param: { id: sessionId } });

    expect(await openRes.json()).toEqual({ sessions: [] });
    expect(deleteRes.status).toBe(200);
  });

  it("exposes the progress routes through AppType", async () => {
    fake.user.getMonthProgress.mockResolvedValue({
      ok: true,
      value: { sessionCount: 0, correctionCount: 0, newWordCount: 0 },
    });
    fake.user.listEndedSessions.mockResolvedValue({ ok: true, value: [] });
    fake.user.listMistakeGroups.mockResolvedValue({ ok: true, value: [] });
    fake.user.listNewWords.mockResolvedValue({ ok: true, value: [] });
    const client = testClient(app, undefined, undefined, { headers: await authed() });

    const monthRes = await client.progress.month.$get({ query: { tz: "UTC" } });
    const historyRes = await client.progress.history.$get({ query: { tz: "UTC", offset: "0" } });
    const mistakesRes = await client.progress.mistakes.$get({ query: {} });
    const wordsRes = await client.progress.words.$get({ query: { tz: "UTC" } });

    expect(monthRes.status).toBe(200);
    expect(await historyRes.json()).toEqual({ items: [], nextOffset: null });
    expect(await mistakesRes.json()).toEqual({ items: [], nextOffset: null });
    expect(await wordsRes.json()).toEqual({ items: [], nextOffset: null });
  });
});

describe("GET /progress/month", () => {
  const zeros = { sessionCount: 0, correctionCount: 0, newWordCount: 0 };

  async function month(query: string, target = app) {
    return target.request(`/progress/month${query}`, { headers: await authed() });
  }

  it("answers the month's sessions, corrections and new words in the caller's zone", async () => {
    fake.user.getMonthProgress.mockResolvedValue({
      ok: true,
      value: { sessionCount: 12, correctionCount: 31, newWordCount: 48 },
    });

    const res = await month("?tz=America%2FArgentina%2FBuenos_Aires");

    expect(res.status).toBe(200);
    expect(monthProgressSchema.parse(await res.json())).toEqual({
      monthStart: "2026-11-01",
      sessions: 12,
      corrections: 31,
      newWords: 48,
    });
    expect(fake.user.getMonthProgress).toHaveBeenCalledWith(
      "America/Argentina/Buenos_Aires",
      "2026-11-01",
    );
  });

  it("takes October as the month at 02:00 UTC on November 1 in Buenos Aires", async () => {
    fake.user.getMonthProgress.mockResolvedValue({ ok: true, value: zeros });
    const early = createApp({
      auth: { issuer, loadKeys: async () => keysOutcome },
      store: fake.store,
      now: () => new Date("2026-11-01T02:00:00Z"),
    });

    const res = await month("?tz=America%2FArgentina%2FBuenos_Aires", early);

    expect((await res.json()) as { monthStart: string }).toMatchObject({
      monthStart: "2026-10-01",
    });
    expect(fake.user.getMonthProgress).toHaveBeenCalledWith(
      "America/Argentina/Buenos_Aires",
      "2026-10-01",
    );
  });

  it("answers zeros for a user with no data", async () => {
    fake.user.getMonthProgress.mockResolvedValue({ ok: true, value: zeros });

    const res = await month("?tz=UTC");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      monthStart: "2026-11-01",
      sessions: 0,
      corrections: 0,
      newWords: 0,
    });
  });

  it("answers 400 for an unknown zone and without tz, and reads nothing", async () => {
    expect((await month("?tz=Nowhere%2FAtlantis")).status).toBe(400);
    expect((await month("")).status).toBe(400);
    expect(fake.user.getMonthProgress).not.toHaveBeenCalled();
  });

  it("answers 401 when the store is unauthorized and 503 when it is unavailable", async () => {
    fake.user.getMonthProgress.mockResolvedValueOnce({ ok: false, failure: "unauthorized" });
    expect((await month("?tz=UTC")).status).toBe(401);
    fake.user.getMonthProgress.mockResolvedValueOnce({ ok: false, failure: "unavailable" });
    expect((await month("?tz=UTC")).status).toBe(503);
  });

  it("builds the store for the token's user", async () => {
    fake.user.getMonthProgress.mockResolvedValue({ ok: true, value: zeros });
    const headers = await authed();

    await app.request("/progress/month?tz=UTC", { headers });

    expect(fake.callers).toEqual([
      { id: "user-1", accessToken: headers.Authorization.replace("Bearer ", "") },
    ]);
  });
});

function endedRow(n: number) {
  return {
    session: { ...session, id: `session-${n}`, status: "ended" as const },
    messageCount: 4,
    correctionCount: 1,
  };
}

describe("GET /progress/history", () => {
  async function history(query: string) {
    return app.request(`/progress/history${query}`, { headers: await authed() });
  }

  it("answers a page of ended sessions with local days and counts", async () => {
    fake.user.listEndedSessions.mockResolvedValue({
      ok: true,
      value: [
        {
          session: { ...endedRow(1).session, createdAt: "2026-11-01T02:30:00+00:00" },
          messageCount: 14,
          correctionCount: 3,
        },
      ],
    });

    const res = await history("?tz=America%2FArgentina%2FBuenos_Aires");

    expect(res.status).toBe(200);
    const page = historyPageSchema.parse(await res.json());
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      day: "2026-10-31",
      messageCount: 14,
      correctionCount: 3,
    });
    expect(page.nextOffset).toBeNull();
    expect(fake.user.listEndedSessions).toHaveBeenCalledWith(0, 21);
  });

  it("reads from the given offset and points to the next page when a row beyond it comes back", async () => {
    fake.user.listEndedSessions.mockResolvedValue({
      ok: true,
      value: Array.from({ length: 21 }, (_, n) => endedRow(n)),
    });

    const res = await history("?tz=UTC&offset=20");

    const page = historyPageSchema.parse(await res.json());
    expect(page.items).toHaveLength(20);
    expect(page.nextOffset).toBe(40);
    expect(fake.user.listEndedSessions).toHaveBeenCalledWith(20, 21);
  });

  it("answers an empty page with no next offset", async () => {
    fake.user.listEndedSessions.mockResolvedValue({ ok: true, value: [] });

    const res = await history("?tz=UTC");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [], nextOffset: null });
  });

  it("answers 400 for a bad offset and for an unknown zone, and reads nothing", async () => {
    for (const query of [
      "?tz=UTC&offset=-1",
      "?tz=UTC&offset=abc",
      "?tz=UTC&offset=01",
      "?tz=Nowhere%2FAtlantis",
      "",
    ]) {
      expect((await history(query)).status).toBe(400);
    }
    expect(fake.user.listEndedSessions).not.toHaveBeenCalled();
  });

  it("answers 401 when the store is unauthorized and 503 when it is unavailable", async () => {
    fake.user.listEndedSessions.mockResolvedValueOnce({ ok: false, failure: "unauthorized" });
    expect((await history("?tz=UTC")).status).toBe(401);
    fake.user.listEndedSessions.mockResolvedValueOnce({ ok: false, failure: "unavailable" });
    expect((await history("?tz=UTC")).status).toBe(503);
  });

  it("builds the store for the token's user", async () => {
    fake.user.listEndedSessions.mockResolvedValue({ ok: true, value: [] });
    const headers = await authed();

    await app.request("/progress/history?tz=UTC", { headers });

    expect(fake.callers).toEqual([
      { id: "user-1", accessToken: headers.Authorization.replace("Bearer ", "") },
    ]);
  });
});

describe("GET /progress/mistakes", () => {
  async function mistakes(query: string) {
    return app.request(`/progress/mistakes${query}`, { headers: await authed() });
  }

  it("answers groups with their rule (null for none), times and latest example", async () => {
    fake.user.listMistakeGroups.mockResolvedValue({
      ok: true,
      value: [
        { rule: "Articles", times: 5, original: "a apple", corrected: "an apple" },
        { rule: null, times: 1, original: "a", corrected: "b" },
      ],
    });

    const res = await mistakes("");

    expect(res.status).toBe(200);
    expect(mistakePageSchema.parse(await res.json())).toEqual({
      items: [
        { rule: "Articles", times: 5, latest: { original: "a apple", corrected: "an apple" } },
        { rule: null, times: 1, latest: { original: "a", corrected: "b" } },
      ],
      nextOffset: null,
    });
    expect(fake.user.listMistakeGroups).toHaveBeenCalledWith(0, 21);
  });

  it("reads from the given offset and points to the next page when a row beyond it comes back", async () => {
    fake.user.listMistakeGroups.mockResolvedValue({
      ok: true,
      value: Array.from({ length: 21 }, () => ({
        rule: null,
        times: 1,
        original: "a",
        corrected: "b",
      })),
    });

    const res = await mistakes("?offset=20");

    const page = mistakePageSchema.parse(await res.json());
    expect(page.items).toHaveLength(20);
    expect(page.nextOffset).toBe(40);
    expect(fake.user.listMistakeGroups).toHaveBeenCalledWith(20, 21);
  });

  it("answers an empty page with no next offset", async () => {
    fake.user.listMistakeGroups.mockResolvedValue({ ok: true, value: [] });

    const res = await mistakes("");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [], nextOffset: null });
  });

  it("answers 400 for a bad offset and reads nothing", async () => {
    for (const query of ["?offset=-1", "?offset=abc", "?offset=01"]) {
      expect((await mistakes(query)).status).toBe(400);
    }
    expect(fake.user.listMistakeGroups).not.toHaveBeenCalled();
  });

  it("answers 401 when the store is unauthorized and 503 when it is unavailable", async () => {
    fake.user.listMistakeGroups.mockResolvedValueOnce({ ok: false, failure: "unauthorized" });
    expect((await mistakes("")).status).toBe(401);
    fake.user.listMistakeGroups.mockResolvedValueOnce({ ok: false, failure: "unavailable" });
    expect((await mistakes("")).status).toBe(503);
  });

  it("builds the store for the token's user", async () => {
    fake.user.listMistakeGroups.mockResolvedValue({ ok: true, value: [] });
    const headers = await authed();

    await app.request("/progress/mistakes", { headers });

    expect(fake.callers).toEqual([
      { id: "user-1", accessToken: headers.Authorization.replace("Bearer ", "") },
    ]);
  });
});

describe("GET /progress/words", () => {
  const wordRow = {
    word: "catchy",
    sentence: "That song.",
    createdAt: "2026-11-05T01:00:00+00:00",
  };

  async function words(query: string) {
    return app.request(`/progress/words${query}`, { headers: await authed() });
  }

  it("answers words with their sentence and local day", async () => {
    fake.user.listNewWords.mockResolvedValue({ ok: true, value: [wordRow] });

    const res = await words("?tz=America%2FArgentina%2FBuenos_Aires");

    expect(res.status).toBe(200);
    expect(wordPageSchema.parse(await res.json())).toEqual({
      items: [{ word: "catchy", sentence: "That song.", day: "2026-11-04" }],
      nextOffset: null,
    });
    expect(fake.user.listNewWords).toHaveBeenCalledWith(0, 21);
  });

  it("reads from the given offset and points to the next page when a row beyond it comes back", async () => {
    fake.user.listNewWords.mockResolvedValue({
      ok: true,
      value: Array.from({ length: 21 }, () => wordRow),
    });

    const res = await words("?tz=UTC&offset=20");

    const page = wordPageSchema.parse(await res.json());
    expect(page.items).toHaveLength(20);
    expect(page.nextOffset).toBe(40);
    expect(fake.user.listNewWords).toHaveBeenCalledWith(20, 21);
  });

  it("answers an empty page with no next offset", async () => {
    fake.user.listNewWords.mockResolvedValue({ ok: true, value: [] });

    const res = await words("?tz=UTC");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [], nextOffset: null });
  });

  it("answers 400 for a bad offset and for an unknown zone, and reads nothing", async () => {
    for (const query of [
      "?tz=UTC&offset=-1",
      "?tz=UTC&offset=abc",
      "?tz=UTC&offset=01",
      "?tz=Nowhere%2FAtlantis",
      "",
    ]) {
      expect((await words(query)).status).toBe(400);
    }
    expect(fake.user.listNewWords).not.toHaveBeenCalled();
  });

  it("answers 401 when the store is unauthorized and 503 when it is unavailable", async () => {
    fake.user.listNewWords.mockResolvedValueOnce({ ok: false, failure: "unauthorized" });
    expect((await words("?tz=UTC")).status).toBe(401);
    fake.user.listNewWords.mockResolvedValueOnce({ ok: false, failure: "unavailable" });
    expect((await words("?tz=UTC")).status).toBe(503);
  });

  it("builds the store for the token's user", async () => {
    fake.user.listNewWords.mockResolvedValue({ ok: true, value: [] });
    const headers = await authed();

    await app.request("/progress/words?tz=UTC", { headers });

    expect(fake.callers).toEqual([
      { id: "user-1", accessToken: headers.Authorization.replace("Bearer ", "") },
    ]);
  });
});

describe("the practice routes", () => {
  const usage = {
    model: TUTOR_MODEL,
    inputTokens: 700,
    outputTokens: 150,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
  };

  async function call(method: string, path: string, body?: unknown) {
    return app.request(path, {
      method,
      headers: await authed(body === undefined ? {} : jsonType),
      body: body === undefined ? undefined : json(body),
    });
  }

  describe("GET /practice/today", () => {
    it("answers today's run in the caller's zone", async () => {
      fake.user.listPracticeRunsSince.mockResolvedValue({
        ok: true,
        value: [
          { run: { ...practiceRun, id: "old", createdAt: "2026-11-04T09:00:00+00:00" }, items: [] },
          { run: practiceRun, items: [practiceItem] },
        ],
      });
      const res = await call("GET", "/practice/today?tz=UTC");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ run: { run: practiceRun, items: [practiceItem] } });
      expect(fake.user.listPracticeRunsSince).toHaveBeenCalledWith("2026-11-03T12:00:00.000Z");
    });

    it("answers null with no run today", async () => {
      fake.user.listPracticeRunsSince.mockResolvedValue({ ok: true, value: [] });
      const res = await call("GET", "/practice/today?tz=America/Argentina/Buenos_Aires");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ run: null });
    });

    it("counts a run at 23:00 UTC as the next day in a zone ahead of UTC", async () => {
      fake.user.listPracticeRunsSince.mockResolvedValue({
        ok: true,
        value: [{ run: { ...practiceRun, createdAt: "2026-11-04T23:30:00+00:00" }, items: [] }],
      });
      const res = await call("GET", "/practice/today?tz=Asia/Tokyo");
      expect(((await res.json()) as { run: unknown }).run).not.toBeNull();
    });

    it("answers 400 for a bad zone and 503 when the store is down", async () => {
      expect((await call("GET", "/practice/today?tz=-03:00")).status).toBe(400);
      expect((await call("GET", "/practice/today")).status).toBe(400);
      fake.user.listPracticeRunsSince.mockResolvedValue({ ok: false, failure: "unavailable" });
      expect((await call("GET", "/practice/today?tz=UTC")).status).toBe(503);
    });
  });

  describe("GET /practice/recent-prompts", () => {
    const recent = [
      { runId: "run-2", prompt: "I ___ (be) there.", rule: "Present perfect" },
      { runId: "run-1", prompt: "She ___ (go) home.", rule: "Past simple" },
    ];

    it("answers the caller's recent prompts newest first", async () => {
      fake.user.listRecentPrompts.mockResolvedValue({ ok: true, value: recent });
      const res = await call("GET", "/practice/recent-prompts?days=7&limit=40");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ items: recent });
      expect(fake.user.listRecentPrompts).toHaveBeenCalledWith("2026-10-29T12:00:00.000Z", 40);
    });

    it("reads with the store of the token's user and the raw token", async () => {
      fake.user.listRecentPrompts.mockResolvedValue({ ok: true, value: [] });
      const headers = await authed();

      await app.request("/practice/recent-prompts?days=7&limit=40", { headers });

      expect(fake.callers).toEqual([
        { id: "user-1", accessToken: headers.Authorization.replace("Bearer ", "") },
      ]);
    });

    it("answers an empty list with no recent practice", async () => {
      fake.user.listRecentPrompts.mockResolvedValue({ ok: true, value: [] });
      const res = await call("GET", "/practice/recent-prompts?days=7&limit=40");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ items: [] });
    });

    it("answers 401 when the store reports unauthorized", async () => {
      fake.user.listRecentPrompts.mockResolvedValue({ ok: false, failure: "unauthorized" });
      expect((await call("GET", "/practice/recent-prompts?days=7&limit=40")).status).toBe(401);
    });

    it("answers 400 for days 8, limit 41 or a missing query", async () => {
      expect((await call("GET", "/practice/recent-prompts?days=8&limit=40")).status).toBe(400);
      expect((await call("GET", "/practice/recent-prompts?days=7&limit=41")).status).toBe(400);
      expect((await call("GET", "/practice/recent-prompts")).status).toBe(400);
      expect(fake.user.listRecentPrompts).not.toHaveBeenCalled();
    });

    it("answers 503 when the store is down", async () => {
      fake.user.listRecentPrompts.mockResolvedValue({ ok: false, failure: "unavailable" });
      expect((await call("GET", "/practice/recent-prompts?days=7&limit=40")).status).toBe(503);
    });
  });

  describe("POST /practice/runs", () => {
    it("answers 201 with the run", async () => {
      fake.user.createPracticeRun.mockResolvedValue({ ok: true, value: practiceRun });
      const res = await call("POST", "/practice/runs", { focus: "mistakes", target: 5 });
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual(practiceRun);
      expect(fake.user.createPracticeRun).toHaveBeenCalledWith({ focus: "mistakes", target: 5 });
    });

    it("answers 201 for a topic run on a grammar topic of the catalog", async () => {
      fake.user.createPracticeRun.mockResolvedValue({
        ok: true,
        value: { ...practiceRun, focus: "topic", topicId: "articles" },
      });
      const res = await call("POST", "/practice/runs", {
        focus: "topic",
        topicId: "articles",
        target: 5,
      });
      expect(res.status).toBe(201);
      expect(fake.user.createPracticeRun).toHaveBeenCalledWith({
        focus: "topic",
        topicId: "articles",
        target: 5,
      });
    });

    it("answers 400 invalid_input for a topic outside the grammar catalog", async () => {
      for (const topicId of ["subjunctive", "sports"]) {
        const res = await call("POST", "/practice/runs", { focus: "topic", topicId, target: 5 });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "invalid_input" });
      }
      expect(fake.user.createPracticeRun).not.toHaveBeenCalled();
    });

    it("answers 400 for a bad focus, a target of 20 and a topic run without a topic", async () => {
      expect((await call("POST", "/practice/runs", { focus: "chat", target: 5 })).status).toBe(400);
      expect((await call("POST", "/practice/runs", { focus: "mistakes", target: 20 })).status).toBe(
        400,
      );
      expect((await call("POST", "/practice/runs", { focus: "topic", target: 5 })).status).toBe(
        400,
      );
      expect(fake.user.createPracticeRun).not.toHaveBeenCalled();
    });

    it("answers 503 when the store is unavailable", async () => {
      fake.user.createPracticeRun.mockResolvedValue({ ok: false, failure: "unavailable" });
      expect((await call("POST", "/practice/runs", { focus: "mistakes", target: 5 })).status).toBe(
        503,
      );
    });
  });

  describe("GET /practice/runs/:id", () => {
    it("answers 200 with the run and its items", async () => {
      fake.user.getPracticeRun.mockResolvedValue({
        ok: true,
        value: { run: practiceRun, items: [] },
      });
      const res = await call("GET", `/practice/runs/${runId}`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ run: practiceRun, items: [] });
    });

    it("answers 404 when the run is not visible, 400 for a bad id and 503 when down", async () => {
      fake.user.getPracticeRun.mockResolvedValue({ ok: true, value: null });
      expect((await call("GET", `/practice/runs/${runId}`)).status).toBe(404);
      expect((await call("GET", "/practice/runs/abc")).status).toBe(400);
      fake.user.getPracticeRun.mockResolvedValue({ ok: false, failure: "unavailable" });
      expect((await call("GET", `/practice/runs/${runId}`)).status).toBe(503);
    });
  });

  describe("POST /practice/runs/:id/items", () => {
    it("answers 201 with every item of the run", async () => {
      fake.user.addPracticeItems.mockResolvedValue({ ok: true, value: [practiceItem] });
      const res = await call("POST", `/practice/runs/${runId}/items`, {
        items: [practiceItemBody],
      });
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ items: [practiceItem] });
      expect(fake.user.addPracticeItems).toHaveBeenCalledWith(runId, [practiceItemBody]);
    });

    it("answers 400 for six items and for a choose item with two options", async () => {
      const six = Array.from({ length: 6 }, (_, position) => ({ ...practiceItemBody, position }));
      expect((await call("POST", `/practice/runs/${runId}/items`, { items: six })).status).toBe(
        400,
      );
      expect(
        (
          await call("POST", `/practice/runs/${runId}/items`, {
            items: [{ ...practiceItemBody, options: ["have been", "was"] }],
          })
        ).status,
      ).toBe(400);
      expect(fake.user.addPracticeItems).not.toHaveBeenCalled();
    });

    it("answers 404 when the run is not visible and 503 when down", async () => {
      fake.user.addPracticeItems.mockResolvedValue({ ok: true, value: null });
      const body = { items: [practiceItemBody] };
      expect((await call("POST", `/practice/runs/${runId}/items`, body)).status).toBe(404);
      fake.user.addPracticeItems.mockResolvedValue({ ok: false, failure: "unavailable" });
      expect((await call("POST", `/practice/runs/${runId}/items`, body)).status).toBe(503);
    });
  });

  describe("POST /practice/runs/:id/checks", () => {
    const checkRow = {
      stage: "code",
      generatorModel: "claude-haiku-5-5",
      checkerModel: null,
      passed: true,
      reason: null,
      solverAnswer: null,
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
    const path = `/practice/runs/${runId}/checks`;

    it("answers 201 with the count and passes the rows to the store", async () => {
      fake.user.addPracticeChecks.mockResolvedValue({ ok: true, value: 2 });
      const res = await call("POST", path, { checks: [checkRow, checkRow] });
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ count: 2 });
      expect(fake.user.addPracticeChecks).toHaveBeenCalledWith(runId, [checkRow, checkRow]);
    });

    it("answers 400 for no rows, 21 rows, an extra key and a code row with a checker model", async () => {
      const rows = (n: number) => ({ checks: Array.from({ length: n }, () => checkRow) });
      expect((await call("POST", path, rows(0))).status).toBe(400);
      expect((await call("POST", path, rows(21))).status).toBe(400);
      expect((await call("POST", path, { checks: [checkRow], extra: 1 })).status).toBe(400);
      expect(
        (
          await call("POST", path, {
            checks: [{ ...checkRow, checkerModel: "claude-haiku-5-5" }],
          })
        ).status,
      ).toBe(400);
      expect(fake.user.addPracticeChecks).not.toHaveBeenCalled();
    });

    it("answers 404 when the run is another user's", async () => {
      fake.user.addPracticeChecks.mockResolvedValue({ ok: true, value: null });
      expect((await call("POST", path, { checks: [checkRow] })).status).toBe(404);
    });

    it("answers 503 when the store is down", async () => {
      fake.user.addPracticeChecks.mockResolvedValue({ ok: false, failure: "unavailable" });
      expect((await call("POST", path, { checks: [checkRow] })).status).toBe(503);
    });
  });

  describe("POST /practice/runs/:id/usage", () => {
    it("prices the practice usage with the model price", async () => {
      fake.user.addPracticeCost.mockResolvedValue({
        ok: true,
        value: { ...practiceRun, costUsd: 0.000145 },
      });
      const res = await call("POST", `/practice/runs/${runId}/usage`, usage);
      expect(res.status).toBe(200);
      expect(fake.user.addPracticeCost).toHaveBeenCalledWith(
        runId,
        usageCostUsd(TUTOR_MODEL, usage),
      );
      expect(fake.user.addPracticeCost).toHaveBeenCalledWith(runId, 0.000145);
    });

    it("answers 400 for an unknown model or an apiKey field", async () => {
      expect(
        (await call("POST", `/practice/runs/${runId}/usage`, { ...usage, model: "x" })).status,
      ).toBe(400);
      expect(
        (await call("POST", `/practice/runs/${runId}/usage`, { ...usage, apiKey: "x" })).status,
      ).toBe(400);
      expect(fake.user.addPracticeCost).not.toHaveBeenCalled();
    });

    it("answers 404 when the run is not visible and 503 when down", async () => {
      fake.user.addPracticeCost.mockResolvedValue({ ok: true, value: null });
      expect((await call("POST", `/practice/runs/${runId}/usage`, usage)).status).toBe(404);
      fake.user.addPracticeCost.mockResolvedValue({ ok: false, failure: "unavailable" });
      expect((await call("POST", `/practice/runs/${runId}/usage`, usage)).status).toBe(503);
    });
  });

  describe("POST /practice/runs/:id/target", () => {
    it("answers 200 with the run", async () => {
      fake.user.setPracticeTarget.mockResolvedValue({
        ok: true,
        value: { ...practiceRun, target: 10 },
      });
      const res = await call("POST", `/practice/runs/${runId}/target`, { target: 10 });
      expect(res.status).toBe(200);
      expect(fake.user.setPracticeTarget).toHaveBeenCalledWith(runId, 10);
    });

    it("answers 400 for a target of 20 or 5", async () => {
      expect((await call("POST", `/practice/runs/${runId}/target`, { target: 20 })).status).toBe(
        400,
      );
      expect((await call("POST", `/practice/runs/${runId}/target`, { target: 5 })).status).toBe(
        400,
      );
    });

    it("answers 404 and 503", async () => {
      fake.user.setPracticeTarget.mockResolvedValue({ ok: true, value: null });
      expect((await call("POST", `/practice/runs/${runId}/target`, { target: 10 })).status).toBe(
        404,
      );
      fake.user.setPracticeTarget.mockResolvedValue({ ok: false, failure: "unavailable" });
      expect((await call("POST", `/practice/runs/${runId}/target`, { target: 10 })).status).toBe(
        503,
      );
    });
  });

  describe("POST /practice/runs/:id/finish", () => {
    it("finishes the run at the server's time", async () => {
      fake.user.finishPracticeRun.mockResolvedValue({
        ok: true,
        value: { ...practiceRun, finishedAt: "2026-11-05T12:00:00.000Z" },
      });
      const res = await call("POST", `/practice/runs/${runId}/finish`);
      expect(res.status).toBe(200);
      expect(fake.user.finishPracticeRun).toHaveBeenCalledWith(runId, "2026-11-05T12:00:00.000Z");
    });

    it("answers 404, 400 and 503", async () => {
      fake.user.finishPracticeRun.mockResolvedValue({ ok: true, value: null });
      expect((await call("POST", `/practice/runs/${runId}/finish`)).status).toBe(404);
      expect((await call("POST", "/practice/runs/abc/finish")).status).toBe(400);
      fake.user.finishPracticeRun.mockResolvedValue({ ok: false, failure: "unavailable" });
      expect((await call("POST", `/practice/runs/${runId}/finish`)).status).toBe(503);
    });
  });

  describe("POST /practice/items/:id/answer", () => {
    it("saves the answer at the server's time", async () => {
      fake.user.answerPracticeItem.mockResolvedValue({
        ok: true,
        value: { ...practiceItem, userAnswer: "was", correct: false },
      });
      const res = await call("POST", `/practice/items/${itemId}/answer`, {
        userAnswer: " was ",
        correct: false,
      });
      expect(res.status).toBe(200);
      expect(fake.user.answerPracticeItem).toHaveBeenCalledWith(
        itemId,
        { userAnswer: "was", correct: false },
        "2026-11-05T12:00:00.000Z",
      );
    });

    it("answers 400 for an empty answer, 404 and 503", async () => {
      expect(
        (await call("POST", `/practice/items/${itemId}/answer`, { userAnswer: " ", correct: true }))
          .status,
      ).toBe(400);
      const body = { userAnswer: "was", correct: false };
      fake.user.answerPracticeItem.mockResolvedValue({ ok: true, value: null });
      expect((await call("POST", `/practice/items/${itemId}/answer`, body)).status).toBe(404);
      fake.user.answerPracticeItem.mockResolvedValue({ ok: false, failure: "unavailable" });
      expect((await call("POST", `/practice/items/${itemId}/answer`, body)).status).toBe(503);
    });
  });
});

describe("the notes routes", () => {
  async function call(method: string, path: string, body?: unknown) {
    return app.request(path, {
      method,
      headers: await authed(body === undefined ? {} : jsonType),
      body: body === undefined ? undefined : json(body),
    });
  }

  describe("POST /notes", () => {
    it("answers 201 with the note", async () => {
      fake.user.createNote.mockResolvedValue({ ok: true, value: studyNote });
      const res = await call("POST", "/notes", noteBody);
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual(studyNote);
      expect(fake.user.createNote).toHaveBeenCalledWith(noteBody);
    });

    it("answers 400 for a table with two columns, a bad session id and an unknown key", async () => {
      const twoColumns = { ...noteBody, content: { ...noteContent, columns: ["a", "b"] } };
      expect((await call("POST", "/notes", twoColumns)).status).toBe(400);
      expect((await call("POST", "/notes", { ...noteBody, sessionId: "x" })).status).toBe(400);
      expect((await call("POST", "/notes", { ...noteBody, apiKey: "x" })).status).toBe(400);
      expect(fake.user.createNote).not.toHaveBeenCalled();
    });

    it("answers 404 when the session is not visible and 503 when the store is down", async () => {
      fake.user.createNote.mockResolvedValueOnce({ ok: true, value: null });
      expect((await call("POST", "/notes", noteBody)).status).toBe(404);
      fake.user.createNote.mockResolvedValueOnce({ ok: false, failure: "unavailable" });
      expect((await call("POST", "/notes", noteBody)).status).toBe(503);
    });
  });

  describe("GET /notes/:id", () => {
    it("answers 200 with the note", async () => {
      fake.user.getNote.mockResolvedValue({ ok: true, value: studyNote });
      const res = await call("GET", `/notes/${noteId}`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(studyNote);
      expect(fake.user.getNote).toHaveBeenCalledWith(noteId);
    });

    it("answers 404, 400 and 503", async () => {
      fake.user.getNote.mockResolvedValueOnce({ ok: true, value: null });
      expect((await call("GET", `/notes/${noteId}`)).status).toBe(404);
      expect((await call("GET", "/notes/abc")).status).toBe(400);
      fake.user.getNote.mockResolvedValueOnce({ ok: false, failure: "unavailable" });
      expect((await call("GET", `/notes/${noteId}`)).status).toBe(503);
    });
  });

  describe("DELETE /notes/:id", () => {
    it("answers 200 with the id", async () => {
      fake.user.deleteNote.mockResolvedValue({ ok: true, value: { id: noteId } });
      const res = await call("DELETE", `/notes/${noteId}`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ id: noteId });
    });

    it("answers 404 and 503", async () => {
      fake.user.deleteNote.mockResolvedValueOnce({ ok: true, value: null });
      expect((await call("DELETE", `/notes/${noteId}`)).status).toBe(404);
      fake.user.deleteNote.mockResolvedValueOnce({ ok: false, failure: "unavailable" });
      expect((await call("DELETE", `/notes/${noteId}`)).status).toBe(503);
    });
  });

  describe("GET /progress/notes", () => {
    const row = {
      id: noteId,
      kind: "table" as const,
      title: "Future forms",
      topic: "Going to, will",
      createdAt: "2026-11-05T01:00:00+00:00",
    };

    it("answers the page with each day in the zone and today", async () => {
      fake.user.listNotes.mockResolvedValue({ ok: true, value: [row] });
      const res = await call("GET", "/progress/notes?tz=America%2FArgentina%2FBuenos_Aires");
      expect(res.status).toBe(200);
      expect(notePageSchema.parse(await res.json())).toEqual({
        items: [
          {
            id: noteId,
            kind: "table",
            title: "Future forms",
            topic: "Going to, will",
            day: "2026-11-04",
          },
        ],
        nextOffset: null,
        today: "2026-11-05",
      });
      expect(fake.user.listNotes).toHaveBeenCalledWith(0, 21);
    });

    it("points to the next page when a row beyond the page comes back", async () => {
      fake.user.listNotes.mockResolvedValue({
        ok: true,
        value: Array.from({ length: 21 }, () => row),
      });
      const page = notePageSchema.parse(
        await (await call("GET", "/progress/notes?tz=UTC&offset=20")).json(),
      );
      expect(page.items).toHaveLength(20);
      expect(page.nextOffset).toBe(40);
      expect(fake.user.listNotes).toHaveBeenCalledWith(20, 21);
    });

    it("answers an empty page with no next offset", async () => {
      fake.user.listNotes.mockResolvedValue({ ok: true, value: [] });
      const res = await call("GET", "/progress/notes?tz=UTC");
      expect(await res.json()).toEqual({ items: [], nextOffset: null, today: "2026-11-05" });
    });

    it("answers 400 for an unknown zone and 503 when the store is down", async () => {
      expect((await call("GET", "/progress/notes?tz=Nowhere%2FAtlantis")).status).toBe(400);
      expect(fake.user.listNotes).not.toHaveBeenCalled();
      fake.user.listNotes.mockResolvedValue({ ok: false, failure: "unavailable" });
      expect((await call("GET", "/progress/notes?tz=UTC")).status).toBe(503);
    });
  });

  describe("the note id of a message and of a run", () => {
    it("passes the note id of a message to the store", async () => {
      fake.user.addMessage.mockResolvedValue({ ok: true, value: { ...message, noteId } });
      const res = await call("POST", `/sessions/${sessionId}/messages`, {
        role: "tutor",
        text: "Here is your table.",
        noteId,
      });
      expect(res.status).toBe(201);
      expect(fake.user.addMessage).toHaveBeenCalledWith(sessionId, {
        role: "tutor",
        text: "Here is your table.",
        noteId,
      });
    });

    it("creates a note run and answers 404 when its note is not visible", async () => {
      const run = { ...practiceRun, focus: "note" as const, noteId };
      fake.user.createPracticeRun.mockResolvedValueOnce({ ok: true, value: run });
      const created = await call("POST", "/practice/runs", { focus: "note", noteId, target: 5 });
      expect(created.status).toBe(201);
      expect(await created.json()).toEqual(run);
      fake.user.createPracticeRun.mockResolvedValueOnce({ ok: true, value: null });
      expect(
        (await call("POST", "/practice/runs", { focus: "note", noteId, target: 5 })).status,
      ).toBe(404);
      expect((await call("POST", "/practice/runs", { focus: "note", target: 5 })).status).toBe(400);
    });
  });
});
