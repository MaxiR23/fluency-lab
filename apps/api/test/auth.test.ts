// apps/api/test/auth.test.ts
//
// Tests for the token verification helpers.
//
// Tested:
// - readTokenUser reads the user out of a verified payload
// - readBearerToken reads the raw token out of the Authorization header
// - authConfigFromEnv builds the issuer and the JWKS path from SUPABASE_URL
// - fetchJwks turns the JWKS response into a typed outcome
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec vitest run apps/api/test/auth.test.ts
//
// SEE: apps/api/src/auth.ts

import { describe, expect, it, vi } from "vitest";
import { authConfigFromEnv, fetchJwks, readBearerToken, readTokenUser } from "../src/auth";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), init);
}

describe("readTokenUser", () => {
  it("reads the id and email from the payload", () => {
    expect(readTokenUser({ sub: "user-1", email: "a@example.com" })).toEqual({
      id: "user-1",
      email: "a@example.com",
    });
  });

  it("returns null for an empty payload", () => {
    expect(readTokenUser({})).toBeNull();
  });

  it("returns null when the payload is not an object", () => {
    expect(readTokenUser(null)).toBeNull();
    expect(readTokenUser("token")).toBeNull();
  });

  it("gives a null email when the payload has none", () => {
    expect(readTokenUser({ sub: "user-1" })).toEqual({ id: "user-1", email: null });
  });

  it("gives a null email when the email is an empty string", () => {
    expect(readTokenUser({ sub: "user-1", email: "" })).toEqual({ id: "user-1", email: null });
  });

  it("returns null when sub is empty or not a string", () => {
    expect(readTokenUser({ sub: "" })).toBeNull();
    expect(readTokenUser({ sub: 7 })).toBeNull();
  });
});

describe("authConfigFromEnv", () => {
  it("builds the issuer and reads the keys from the JWKS path of SUPABASE_URL", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ keys: [{ kty: "EC", kid: "k1" }] }));
    const config = authConfigFromEnv({ SUPABASE_URL: "http://127.0.0.1:54321" }, fetchFn);

    expect(config.issuer).toBe("http://127.0.0.1:54321/auth/v1");
    expect(await config.loadKeys()).toEqual({ ok: true, keys: [{ kty: "EC", kid: "k1" }] });
    expect(fetchFn).toHaveBeenCalledWith("http://127.0.0.1:54321/auth/v1/.well-known/jwks.json", {
      signal: expect.any(AbortSignal),
    });
  });

  it("throws naming SUPABASE_URL when it is missing", () => {
    expect(() => authConfigFromEnv({}, fetch)).toThrow("SUPABASE_URL");
  });

  it("treats a blank SUPABASE_URL as missing", () => {
    expect(() => authConfigFromEnv({ SUPABASE_URL: "  " }, fetch)).toThrow("SUPABASE_URL");
  });

  it("drops a trailing slash from the url", () => {
    const config = authConfigFromEnv({ SUPABASE_URL: "http://127.0.0.1:54321/" }, fetch);

    expect(config.issuer).toBe("http://127.0.0.1:54321/auth/v1");
  });
});

describe("fetchJwks", () => {
  const url = "http://127.0.0.1:54321/auth/v1/.well-known/jwks.json";

  it("returns the keys of the JWKS document", async () => {
    const fetchFn = async () => jsonResponse({ keys: [{ kty: "EC", kid: "k1" }] });

    expect(await fetchJwks(url, fetchFn)).toEqual({ ok: true, keys: [{ kty: "EC", kid: "k1" }] });
  });

  it("returns an empty key list as a success", async () => {
    expect(await fetchJwks(url, async () => jsonResponse({ keys: [] }))).toEqual({
      ok: true,
      keys: [],
    });
  });

  it("returns unavailable when the response is not OK", async () => {
    expect(await fetchJwks(url, async () => new Response("down", { status: 503 }))).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("returns unavailable when fetch rejects", async () => {
    const fetchFn = async () => {
      throw new TypeError("fetch failed");
    };

    expect(await fetchJwks(url, fetchFn)).toEqual({ ok: false, reason: "unavailable" });
  });

  it("returns unavailable when the server does not answer before the deadline", async () => {
    const fetchFn = (_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });

    expect(await fetchJwks(url, fetchFn, 20)).toEqual({ ok: false, reason: "unavailable" });
  });

  it("returns bad_body when the body is not JSON", async () => {
    expect(await fetchJwks(url, async () => new Response("<html>"))).toEqual({
      ok: false,
      reason: "bad_body",
    });
  });

  it("returns bad_body when keys is missing or not an array", async () => {
    expect(await fetchJwks(url, async () => jsonResponse({}))).toEqual({
      ok: false,
      reason: "bad_body",
    });
    expect(await fetchJwks(url, async () => jsonResponse({ keys: "x" }))).toEqual({
      ok: false,
      reason: "bad_body",
    });
  });

  it("returns bad_body when a key is not an object", async () => {
    expect(await fetchJwks(url, async () => jsonResponse({ keys: ["x"] }))).toEqual({
      ok: false,
      reason: "bad_body",
    });
  });
});

describe("readBearerToken", () => {
  it("reads the token after Bearer", () => {
    expect(readBearerToken("Bearer abc.def")).toBe("abc.def");
  });

  it("accepts a lowercase bearer scheme", () => {
    expect(readBearerToken("bearer abc.def")).toBe("abc.def");
  });

  it("returns null without a header", () => {
    expect(readBearerToken(undefined)).toBeNull();
  });

  it("returns null for another scheme", () => {
    expect(readBearerToken("Basic abc")).toBeNull();
  });

  it("returns null for an empty token", () => {
    expect(readBearerToken("Bearer ")).toBeNull();
    expect(readBearerToken("Bearer    ")).toBeNull();
  });
});
