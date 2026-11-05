// apps/mobile/test/auth/supabase-auth-real-client.test.ts
//
// Tests of the Supabase adapter against the real client of the locked version.
//
// Tested:
// - signOut with a valid session and with an expired one, while fetch rejects
// - The cause of the failure, with the transport message the library keeps
//
// What is covered:
// - The assumptions the fake client of supabase-auth.test.ts makes about the library
//
// Run with: pnpm exec jest apps/mobile/test/auth/supabase-auth-real-client.test.ts
//
// SEE: apps/mobile/src/auth/supabase-auth.ts

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createClient } from "@supabase/supabase-js";

import { createSupabaseAuth } from "@/auth/supabase-auth";

const storageKey = "sb-localhost-auth-token";

function setup(expiresAt: number) {
  const store = new Map<string, string>();
  store.set(
    storageKey,
    JSON.stringify({
      access_token: "token-1",
      refresh_token: "refresh-1",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: expiresAt,
      user: { id: "user-1", aud: "authenticated", email: "a@example.com", app_metadata: {} },
    }),
  );
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };
  const client = createClient("http://localhost:54321", "anon-key", {
    auth: { storage, autoRefreshToken: false, persistSession: true, detectSessionInUrl: false },
    global: {
      fetch: async () => {
        throw new TypeError("Network request failed");
      },
    },
  });
  return { store, client, auth: createSupabaseAuth(client.auth) };
}

// INFO: auth-js retries a refresh that cannot reach the server with a growing backoff;
// fake timers let the test move past it without waiting.
async function settle<T>(pending: Promise<T>): Promise<T> {
  await jest.advanceTimersByTimeAsync(300_000);
  return pending;
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

const now = () => Math.floor(Date.now() / 1000);

describe("signOut against the real client with fetch rejecting", () => {
  it("returns ok when the session was valid, because the device ends signed out", async () => {
    const { auth, store } = setup(now() + 3600);

    expect(await settle(auth.signOut())).toEqual({ ok: true, value: null });
    expect(store.has(storageKey)).toBe(false);
  });

  it("returns network when the session was expired, because it stays stored", async () => {
    const { auth, store } = setup(now() - 3600);

    expect(await settle(auth.signOut())).toEqual({
      ok: false,
      failure: "network",
      cause: { name: "AuthRetryableFetchError", detail: "Network request failed" },
    });
    expect(store.has(storageKey)).toBe(true);
  });
});
