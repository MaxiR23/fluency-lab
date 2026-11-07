// apps/mobile/test/auth/supabase-auth-real-client.test.ts
//
// Tests of the Supabase adapter against the real client of the locked version.
//
// Tested:
// - signOut with a valid session and with an expired one, while fetch rejects
// - The cause of the failure, with the transport message the library keeps
// - The restore at launch with an expired session while the server does not answer
//
// What is covered:
// - The assumptions the fake client of supabase-auth.test.ts makes about the library
//
// Run with: pnpm exec jest apps/mobile/test/auth/supabase-auth-real-client.test.ts
//
// SEE: apps/mobile/src/auth/supabase-auth.ts

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createClient } from "@supabase/supabase-js";

import { createSupabaseAuth, withRequestDeadline } from "@/auth/supabase-auth";

const storageKey = "sb-localhost-auth-token";

type Options = { fetch?: typeof fetch; autoRefreshToken?: boolean; stored?: boolean };

function setup(expiresAt: number, options: Options = {}) {
  const store = new Map<string, string>();
  if (options.stored !== false)
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
    auth: {
      storage,
      autoRefreshToken: options.autoRefreshToken ?? false,
      persistSession: true,
      detectSessionInUrl: false,
    },
    global: {
      fetch:
        options.fetch ??
        (async () => {
          throw new TypeError("Network request failed");
        }),
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

describe("the restore at launch against the real client", () => {
  const neverFetch: typeof fetch = () => new Promise<Response>(() => {});
  const rejectingFetch: typeof fetch = async () => {
    throw new TypeError("Network request failed");
  };

  it("never reports a session event when the refresh request never settles", async () => {
    const { client } = setup(now() - 3600, { fetch: neverFetch, autoRefreshToken: true });
    const listener = jest.fn();
    client.auth.onAuthStateChange(listener);

    await jest.advanceTimersByTimeAsync(300_000);

    expect(listener).not.toHaveBeenCalled();
  });

  it("currentSession returns network when the refresh request never settles, with the request deadline", async () => {
    const { auth, store } = setup(now() - 3600, {
      fetch: withRequestDeadline(neverFetch, 10_000),
      autoRefreshToken: true,
    });

    expect(await settle(auth.currentSession())).toEqual({
      ok: false,
      failure: "network",
      cause: expect.objectContaining({ name: "AuthRetryableFetchError" }),
    });
    expect(store.has(storageKey)).toBe(true);
  });

  it("currentSession returns no session and no error with nothing stored", async () => {
    const { auth } = setup(0, { fetch: rejectingFetch, autoRefreshToken: true, stored: false });

    expect(await settle(auth.currentSession())).toEqual({ ok: true, value: null });
  });

  it("the port listener gets no event at launch with nothing stored", async () => {
    const { auth, client } = setup(0, {
      fetch: rejectingFetch,
      autoRefreshToken: true,
      stored: false,
    });
    const listener = jest.fn();
    const raw = jest.fn();
    auth.onSessionChange(listener);
    client.auth.onAuthStateChange(raw);

    await jest.advanceTimersByTimeAsync(300_000);

    expect(raw).toHaveBeenCalledWith("INITIAL_SESSION", null);
    expect(listener).not.toHaveBeenCalled();
  });
});
