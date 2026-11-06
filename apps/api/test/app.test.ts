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
// - GET/PUT /profile, GET/POST /sessions, GET /sessions/week and GET /sessions/:id/messages: 401
//   without a valid token, 400 on invalid input, 404, 503, and the typed client
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
import type { ActiveSession, Message, Profile, Session } from "@fluency-lab/shared";
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
  { name: "GET /sessions/active", path: "/sessions/active", method: "GET" },
  { name: "GET /sessions/week", path: "/sessions/week?tz=UTC", method: "GET" },
  { name: "POST /sessions", path: "/sessions", method: "POST", body: { topicId: null } },
  { name: "GET /sessions/:id/messages", path: `/sessions/${sessionId}/messages`, method: "GET" },
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

describe("GET /sessions/:id/messages", () => {
  async function list(id: string) {
    return app.request(`/sessions/${id}/messages`, { headers: await authed() });
  }

  it("responds 200 with the messages", async () => {
    fake.user.listMessages.mockResolvedValue({ ok: true, value: [message] });

    const res = await list(sessionId);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ messages: [message] });
    expect(fake.user.listMessages).toHaveBeenCalledWith(sessionId);
  });

  it("responds 200 with { messages: [] } for a session with none", async () => {
    fake.user.listMessages.mockResolvedValue({ ok: true, value: [] });

    const res = await list(sessionId);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ messages: [] });
  });

  it("responds 400 for an id that is not a uuid", async () => {
    expect((await list("abc")).status).toBe(400);
    expect(fake.user.listMessages).not.toHaveBeenCalled();
  });

  it("responds 404 when the session is not visible", async () => {
    fake.user.listMessages.mockResolvedValue({ ok: true, value: null });

    expect((await list(sessionId)).status).toBe(404);
  });

  it("responds 503 when the store is unavailable", async () => {
    fake.user.listMessages.mockResolvedValue({ ok: false, failure: "unavailable" });

    expect((await list(sessionId)).status).toBe(503);
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
});
