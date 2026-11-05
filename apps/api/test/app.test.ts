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
import { createApp } from "../src/app";
import type { JwksOutcome } from "../src/auth";

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

const app = createApp({
  auth: { issuer, loadKeys: async () => keysOutcome },
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
      "invented-secret",
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
