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
//   GET /profile/stats, DELETE /account,
//   GET/POST /sessions/:id/messages, GET /sessions/:id/summary, POST /sessions/:id/usage and POST /sessions/:id/end:
//   401 without a valid token, 400 on invalid input, 404, 503, and the typed client
// - GET /sessions/:id/summary counts the messages and collects the corrections and new words
// - GET /sessions/spend still counts the cost of a deleted session
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
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  STARTERS,
  TUTOR_MODEL,
  accountDeletedSchema,
  profileStatsSchema,
  usageCostUsd,
  type ActiveSession,
  type Message,
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
  { name: "POST /sessions/:id/end", path: `/sessions/${sessionId}/end`, method: "POST" },
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

  it("responds 200 with the week and no days when there are no sessions", async () => {
    fake.user.listSessionStarts.mockResolvedValue({ ok: true, value: [] });

    const res = await week("?tz=UTC");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ weekStart: "2026-11-02", today: "2026-11-05", days: [] });
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
    });
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
    expect((await post(json({ topicId: "cooking" }))).status).toBe(400);
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

    const res = await list(sessionId);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ session, messages: [message] });
    expect(fake.user.getSessionWithMessages).toHaveBeenCalledWith(sessionId);
  });

  it("responds 200 with no messages for a session with none", async () => {
    fake.user.getSessionWithMessages.mockResolvedValue({
      ok: true,
      value: { session, messages: [] },
    });

    const res = await list(sessionId);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ session, messages: [] });
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

describe("typed client (data routes)", () => {
  it("exposes the profile and session routes through AppType", async () => {
    fake.user.getProfile.mockResolvedValue({ ok: true, value: profile });
    fake.user.getActiveSession.mockResolvedValue({ ok: true, value: null });
    const client = testClient(app, undefined, undefined, { headers: await authed() });

    const profileRes = await client.profile.$get();
    const activeRes = await client.sessions.active.$get();

    fake.user.listSessionStarts.mockResolvedValue({ ok: true, value: [] });
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
});
