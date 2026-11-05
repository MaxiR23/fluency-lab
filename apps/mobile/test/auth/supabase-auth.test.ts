// apps/mobile/test/auth/supabase-auth.test.ts
//
// Tests for the Supabase adapter of the auth port.
//
// Tested:
// - Every AuthPort call: success, expected empty, the failures a screen
//   branches on, and transport failure
// - The reset by code, step by step
// - The client options and the auto refresh binding
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/auth/supabase-auth.test.ts
//
// SEE: apps/mobile/src/auth/supabase-auth.ts

import { describe, expect, it, jest } from "@jest/globals";

import type { AuthPort } from "@/auth/auth-port";
import {
  bindAutoRefresh,
  createSupabaseAuth,
  supabaseAuthOptions,
  type SupabaseAuthClient,
} from "@/auth/supabase-auth";

import { generatedSecret } from "../helpers/generated-secret";

type LibSession = { access_token: string; user: { id: string; email?: string } };

const libSession: LibSession = {
  access_token: "token-1",
  user: { id: "user-1", email: "a@example.com" },
};
const session = { accessToken: "token-1", user: { id: "user-1", email: "a@example.com" } };

const ok = { data: { session: libSession }, error: null };
const noSession = { data: { session: null }, error: null };
const apiError = (code: string) => ({
  data: { session: null },
  error: { name: "AuthApiError", code },
});
const nativeMessage = "fetch failed: The Internet connection appears to be offline.";
const networkError = { name: "AuthRetryableFetchError", message: nativeMessage };
const networkCause = { name: "AuthRetryableFetchError", detail: nativeMessage };
const apiCause = { name: "AuthApiError", detail: null };
const failed = (error: { name: string; code?: string; message?: string }) => ({
  data: { session: null },
  error,
});

function fakeClient(overrides: Partial<Omit<SupabaseAuthClient, "onAuthStateChange">> = {}) {
  const unsubscribe = jest.fn();
  const client = {
    signInWithPassword: jest.fn<SupabaseAuthClient["signInWithPassword"]>().mockResolvedValue(ok),
    signUp: jest.fn<SupabaseAuthClient["signUp"]>().mockResolvedValue(ok),
    signInWithIdToken: jest.fn<SupabaseAuthClient["signInWithIdToken"]>().mockResolvedValue(ok),
    resetPasswordForEmail: jest
      .fn<SupabaseAuthClient["resetPasswordForEmail"]>()
      .mockResolvedValue({ error: null }),
    verifyOtp: jest.fn<SupabaseAuthClient["verifyOtp"]>().mockResolvedValue(ok),
    updateUser: jest.fn<SupabaseAuthClient["updateUser"]>().mockResolvedValue({ error: null }),
    signOut: jest.fn<SupabaseAuthClient["signOut"]>().mockResolvedValue({ error: null }),
    getSession: jest.fn<SupabaseAuthClient["getSession"]>().mockResolvedValue(ok),
    onAuthStateChange: jest.fn<SupabaseAuthClient["onAuthStateChange"]>().mockReturnValue({
      data: { subscription: { unsubscribe } },
    }),
    ...overrides,
  };
  return { client, unsubscribe, auth: createSupabaseAuth(client) };
}

const credentials = { email: "a@example.com", password: generatedSecret("password") };
const reset = {
  email: "a@example.com",
  code: "123456",
  newPassword: generatedSecret("new-password"),
};

describe("signInWithEmail", () => {
  it("returns the session for valid credentials", async () => {
    const { auth, client } = fakeClient();

    expect(await auth.signInWithEmail(credentials)).toEqual({ ok: true, value: session });
    expect(client.signInWithPassword).toHaveBeenCalledWith(credentials);
  });

  it("returns unknown, not a success, when the response has no session", async () => {
    const { auth } = fakeClient({ signInWithPassword: async () => noSession });

    expect(await auth.signInWithEmail(credentials)).toEqual({
      ok: false,
      failure: "unknown",
    });
    expect(await auth.signInWithEmail(credentials)).not.toHaveProperty("cause");
  });

  it("returns invalid_credentials for a wrong password", async () => {
    const { auth } = fakeClient({
      signInWithPassword: async () => apiError("invalid_credentials"),
    });

    expect(await auth.signInWithEmail(credentials)).toEqual({
      ok: false,
      failure: "invalid_credentials",
      cause: apiCause,
    });
  });

  it("returns network when the email sign-in cannot reach the server", async () => {
    const { auth } = fakeClient({ signInWithPassword: async () => failed(networkError) });

    expect(await auth.signInWithEmail(credentials)).toEqual({
      ok: false,
      failure: "network",
      cause: networkCause,
    });
  });
});

describe("signUpWithEmail", () => {
  it("returns the session of a new account", async () => {
    const { auth, client } = fakeClient();

    expect(await auth.signUpWithEmail(credentials)).toEqual({ ok: true, value: session });
    expect(client.signUp).toHaveBeenCalledWith(credentials);
  });

  it("returns a null session when the account needs confirmation", async () => {
    const { auth } = fakeClient({ signUp: async () => noSession });

    expect(await auth.signUpWithEmail(credentials)).toEqual({ ok: true, value: null });
  });

  it("returns email_taken for a duplicate email", async () => {
    const { auth } = fakeClient({ signUp: async () => apiError("user_already_exists") });

    expect(await auth.signUpWithEmail(credentials)).toEqual({
      ok: false,
      failure: "email_taken",
      cause: apiCause,
    });
  });

  it("returns weak_password for a short password", async () => {
    const { auth } = fakeClient({ signUp: async () => apiError("weak_password") });

    expect(await auth.signUpWithEmail(credentials)).toEqual({
      ok: false,
      failure: "weak_password",
      cause: apiCause,
    });
  });

  it("returns network when sign-up cannot reach the server", async () => {
    const { auth } = fakeClient({ signUp: async () => failed(networkError) });

    expect(await auth.signUpWithEmail(credentials)).toEqual({
      ok: false,
      failure: "network",
      cause: networkCause,
    });
  });
});

describe("requestPasswordReset", () => {
  it("asks the client to email the address and returns ok", async () => {
    const { auth, client } = fakeClient();

    expect(await auth.requestPasswordReset("a@example.com")).toEqual({ ok: true, value: null });
    expect(client.resetPasswordForEmail).toHaveBeenCalledWith("a@example.com");
  });

  it("returns ok for an address with no account", async () => {
    // INFO: the server answers the same, so it does not reveal who has an account.
    const { auth } = fakeClient({ resetPasswordForEmail: async () => ({ error: null }) });

    expect(await auth.requestPasswordReset("nobody@example.com")).toEqual({
      ok: true,
      value: null,
    });
  });

  it("returns unknown when the email rate limit is hit", async () => {
    const { auth } = fakeClient({
      resetPasswordForEmail: async () => ({
        error: { name: "AuthApiError", code: "over_email_send_rate_limit" },
      }),
    });

    expect(await auth.requestPasswordReset("a@example.com")).toEqual({
      ok: false,
      failure: "unknown",
      cause: apiCause,
    });
  });

  it("returns network when the reset request cannot reach the server", async () => {
    const { auth } = fakeClient({ resetPasswordForEmail: async () => ({ error: networkError }) });

    expect(await auth.requestPasswordReset("a@example.com")).toEqual({
      ok: false,
      failure: "network",
      cause: networkCause,
    });
  });
});

describe("confirmPasswordReset", () => {
  it("verifies the code, updates the password and returns the session", async () => {
    const { auth, client } = fakeClient();

    expect(await auth.confirmPasswordReset(reset)).toEqual({ ok: true, value: session });
    expect(client.verifyOtp).toHaveBeenCalledWith({
      email: "a@example.com",
      token: "123456",
      type: "recovery",
    });
    expect(client.updateUser).toHaveBeenCalledWith({ password: reset.newPassword });
    expect(client.signOut).not.toHaveBeenCalled();
  });

  it("returns step code and unknown when the code verifies with no session", async () => {
    const { auth, client } = fakeClient({ verifyOtp: async () => noSession });

    expect(await auth.confirmPasswordReset(reset)).toEqual({
      ok: false,
      step: "code",
      failure: "unknown",
    });
    expect(await auth.confirmPasswordReset(reset)).not.toHaveProperty("cause");
    expect(client.updateUser).not.toHaveBeenCalled();
  });

  it("returns step code and invalid_or_expired_code and does not touch the password", async () => {
    const { auth, client } = fakeClient({ verifyOtp: async () => apiError("otp_expired") });

    expect(await auth.confirmPasswordReset(reset)).toEqual({
      ok: false,
      step: "code",
      failure: "invalid_or_expired_code",
      cause: apiCause,
    });
    expect(client.updateUser).not.toHaveBeenCalled();
  });

  it("signs out locally and returns step password and weak_password when the password is rejected", async () => {
    const { auth, client } = fakeClient({
      updateUser: async () => ({ error: { name: "AuthApiError", code: "weak_password" } }),
    });

    expect(await auth.confirmPasswordReset(reset)).toEqual({
      ok: false,
      step: "password",
      failure: "weak_password",
      cause: apiCause,
      stillSignedIn: false,
    });
    expect(client.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("returns step code and network when the code cannot be verified", async () => {
    const { auth } = fakeClient({ verifyOtp: async () => failed(networkError) });

    expect(await auth.confirmPasswordReset(reset)).toEqual({
      ok: false,
      step: "code",
      failure: "network",
      cause: networkCause,
    });
  });

  it("returns step password, network and not stillSignedIn when the update and the sign-out both lose the network", async () => {
    const { auth } = fakeClient({
      updateUser: async () => ({ error: networkError }),
      signOut: async () => ({ error: networkError }),
      getSession: async () => noSession,
    });

    expect(await auth.confirmPasswordReset(reset)).toEqual({
      ok: false,
      step: "password",
      failure: "network",
      cause: networkCause,
      stillSignedIn: false,
    });
  });

  it("reports not stillSignedIn when the local sign-out errors but the second read finds no session", async () => {
    const { auth } = fakeClient({
      updateUser: async () => ({ error: { name: "AuthApiError", code: "weak_password" } }),
      signOut: async () => ({ error: { name: "AuthApiError", code: "over_request_rate_limit" } }),
      getSession: async () => noSession,
    });

    expect(await auth.confirmPasswordReset(reset)).toEqual({
      ok: false,
      step: "password",
      failure: "weak_password",
      cause: apiCause,
      stillSignedIn: false,
    });
  });

  it("reports stillSignedIn when the local sign-out errors and the second read still finds the session", async () => {
    const { auth } = fakeClient({
      updateUser: async () => ({ error: { name: "AuthApiError", code: "weak_password" } }),
      signOut: async () => ({ error: networkError }),
    });

    expect(await auth.confirmPasswordReset(reset)).toEqual({
      ok: false,
      step: "password",
      failure: "weak_password",
      cause: apiCause,
      stillSignedIn: true,
    });
  });

  it("reports stillSignedIn when the local sign-out rejects and the second read finds the session", async () => {
    const { auth } = fakeClient({
      updateUser: async () => ({ error: { name: "AuthApiError", code: "weak_password" } }),
      signOut: jest.fn<SupabaseAuthClient["signOut"]>().mockRejectedValue(new Error("boom")),
    });

    expect(await auth.confirmPasswordReset(reset)).toEqual({
      ok: false,
      step: "password",
      failure: "weak_password",
      cause: apiCause,
      stillSignedIn: true,
    });
  });

  it("signs out locally and does not return a session when the update rejects", async () => {
    const { auth, client } = fakeClient({
      updateUser: jest.fn<SupabaseAuthClient["updateUser"]>().mockRejectedValue(new Error("boom")),
    });

    expect(await auth.confirmPasswordReset(reset)).toEqual({
      ok: false,
      step: "password",
      failure: "unknown",
      cause: { name: "Error", detail: null },
      stillSignedIn: false,
    });
    expect(client.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});

describe("the cause of a failure", () => {
  it("carries the redacted transport message, without the email, on a network failure", async () => {
    const { auth } = fakeClient({
      resetPasswordForEmail: async () => ({
        error: {
          name: "AuthRetryableFetchError",
          message: "fetch failed: cannot reach a@example.com",
        },
      }),
    });

    expect(await auth.requestPasswordReset("a@example.com")).toEqual({
      ok: false,
      failure: "network",
      cause: { name: "AuthRetryableFetchError", detail: "fetch failed: cannot reach [email]" },
    });
  });

  it("carries the cause of the failed step on a code failure", async () => {
    const { auth } = fakeClient({ verifyOtp: async () => apiError("otp_expired") });

    const outcome = await auth.confirmPasswordReset(reset);

    expect(outcome).toMatchObject({ ok: false, step: "code", cause: apiCause });
  });

  it("carries the cause of the update on a password step failure", async () => {
    const { auth } = fakeClient({
      updateUser: async () => ({ error: { name: "AuthApiError", code: "weak_password" } }),
      signOut: async () => ({ error: networkError }),
      getSession: async () => noSession,
    });

    const outcome = await auth.confirmPasswordReset(reset);

    expect(outcome).toMatchObject({ ok: false, step: "password", cause: apiCause });
  });
});

describe("signInWithApple", () => {
  const apple = { idToken: "id-token-1", nonce: "raw-nonce-1" };

  it("passes the id token and raw nonce and returns the session", async () => {
    const { auth, client } = fakeClient();

    expect(await auth.signInWithApple(apple)).toEqual({ ok: true, value: session });
    expect(client.signInWithIdToken).toHaveBeenCalledWith({
      provider: "apple",
      token: "id-token-1",
      nonce: "raw-nonce-1",
    });
  });

  it("returns unknown, not a success, when the Apple response has no session", async () => {
    const { auth } = fakeClient({ signInWithIdToken: async () => noSession });

    expect(await auth.signInWithApple(apple)).toEqual({
      ok: false,
      failure: "unknown",
    });
    expect(await auth.signInWithApple(apple)).not.toHaveProperty("cause");
  });

  it("returns unknown for a token the server rejects as validation_failed", async () => {
    const { auth } = fakeClient({ signInWithIdToken: async () => apiError("validation_failed") });

    expect(await auth.signInWithApple(apple)).toEqual({
      ok: false,
      failure: "unknown",
      cause: apiCause,
    });
  });

  it("returns network when Apple sign-in cannot reach the server", async () => {
    const { auth } = fakeClient({ signInWithIdToken: async () => failed(networkError) });

    expect(await auth.signInWithApple(apple)).toEqual({
      ok: false,
      failure: "network",
      cause: networkCause,
    });
  });
});

describe("saveName", () => {
  const profileName = { fullName: "Ada Lovelace", givenName: "Ada", familyName: "Lovelace" };

  it("sends the three name fields as user data and returns ok", async () => {
    const { auth, client } = fakeClient();

    expect(await auth.saveName(profileName)).toEqual({ ok: true, value: null });
    expect(client.updateUser).toHaveBeenCalledWith({
      data: { full_name: "Ada Lovelace", given_name: "Ada", family_name: "Lovelace" },
    });
  });

  it("sends null for a name part Apple left out and returns ok", async () => {
    const { auth, client } = fakeClient();

    expect(await auth.saveName({ fullName: "Ada", givenName: "Ada", familyName: null })).toEqual({
      ok: true,
      value: null,
    });
    expect(client.updateUser).toHaveBeenCalledWith({
      data: { full_name: "Ada", given_name: "Ada", family_name: null },
    });
  });

  it("returns unknown when the server refuses the name", async () => {
    const { auth } = fakeClient({
      updateUser: async () => ({ error: { name: "AuthApiError", code: "validation_failed" } }),
    });

    expect(await auth.saveName(profileName)).toEqual({
      ok: false,
      failure: "unknown",
      cause: apiCause,
    });
  });

  it("returns network when the name cannot reach the server", async () => {
    const { auth } = fakeClient({ updateUser: async () => ({ error: networkError }) });

    expect(await auth.saveName(profileName)).toEqual({
      ok: false,
      failure: "network",
      cause: networkCause,
    });
  });
});

describe("signOut", () => {
  it("returns ok when the session is revoked", async () => {
    const { auth, client } = fakeClient();

    expect(await auth.signOut()).toEqual({ ok: true, value: null });
    expect(client.signOut).toHaveBeenCalledWith();
  });

  it("returns ok when there is no session", async () => {
    // INFO: the library answers { error: null } when there is nothing to revoke.
    const { auth } = fakeClient({ signOut: async () => ({ error: null }) });

    expect(await auth.signOut()).toEqual({ ok: true, value: null });
  });

  it("returns unknown when the server refuses the sign-out and the session is still there", async () => {
    const { auth } = fakeClient({
      signOut: async () => ({ error: { name: "AuthApiError", code: "over_request_rate_limit" } }),
    });

    expect(await auth.signOut()).toEqual({ ok: false, failure: "unknown", cause: apiCause });
  });

  it("returns ok when the sign-out errors but the second read finds no session", async () => {
    const getSession = jest.fn<SupabaseAuthClient["getSession"]>().mockResolvedValue(noSession);
    const { auth, client } = fakeClient({
      signOut: async () => ({ error: networkError }),
      getSession,
    });

    expect(await auth.signOut()).toEqual({ ok: true, value: null });
    expect(client.getSession).toHaveBeenCalledTimes(1);
  });

  it("returns network when the sign-out errors and the session is still there", async () => {
    const { auth } = fakeClient({ signOut: async () => ({ error: networkError }) });

    expect(await auth.signOut()).toEqual({ ok: false, failure: "network", cause: networkCause });
  });

  it("returns the sign-out failure when the second read also errors", async () => {
    const { auth } = fakeClient({
      signOut: async () => ({ error: networkError }),
      getSession: async () => failed(networkError),
    });

    expect(await auth.signOut()).toEqual({ ok: false, failure: "network", cause: networkCause });
  });

  it("returns the sign-out failure when the second read rejects", async () => {
    const { auth } = fakeClient({
      signOut: async () => ({ error: networkError }),
      getSession: jest.fn<SupabaseAuthClient["getSession"]>().mockRejectedValue(new Error("boom")),
    });

    expect(await auth.signOut()).toEqual({ ok: false, failure: "network", cause: networkCause });
  });
});

describe("currentSession", () => {
  it("returns the stored session", async () => {
    const { auth } = fakeClient();

    expect(await auth.currentSession()).toEqual({ ok: true, value: session });
  });

  it("returns null when there is no session", async () => {
    const { auth } = fakeClient({ getSession: async () => noSession });

    expect(await auth.currentSession()).toEqual({ ok: true, value: null });
  });

  it("returns unknown when the stored session cannot be refreshed", async () => {
    const { auth } = fakeClient({ getSession: async () => apiError("refresh_token_not_found") });

    expect(await auth.currentSession()).toEqual({ ok: false, failure: "unknown", cause: apiCause });
  });

  it("returns network when the refresh cannot reach the server", async () => {
    const { auth } = fakeClient({ getSession: async () => failed(networkError) });

    expect(await auth.currentSession()).toEqual({
      ok: false,
      failure: "network",
      cause: networkCause,
    });
  });
});

describe("onSessionChange", () => {
  it("calls the listener with the mapped session", () => {
    const { auth, client } = fakeClient();
    const listener = jest.fn();
    auth.onSessionChange(listener);
    const [callback] = client.onAuthStateChange.mock.calls[0] ?? [];

    callback?.("SIGNED_IN", libSession);

    expect(listener).toHaveBeenCalledWith(session);
  });

  it("calls the listener with null on sign out", () => {
    const { auth, client } = fakeClient();
    const listener = jest.fn();
    auth.onSessionChange(listener);
    const [callback] = client.onAuthStateChange.mock.calls[0] ?? [];

    callback?.("SIGNED_OUT", null);

    expect(listener).toHaveBeenCalledWith(null);
  });

  it("stops calling the listener's subscription when unsubscribed", () => {
    const { auth, unsubscribe } = fakeClient();

    const stop = auth.onSessionChange(jest.fn());
    expect(unsubscribe).not.toHaveBeenCalled();
    stop();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe("a client that rejects", () => {
  const boom = () => Promise.reject(new Error("boom"));
  const calls: [
    string,
    Partial<Omit<SupabaseAuthClient, "onAuthStateChange">>,
    (auth: AuthPort) => Promise<unknown>,
  ][] = [
    ["signInWithEmail", { signInWithPassword: boom }, (a) => a.signInWithEmail(credentials)],
    ["signUpWithEmail", { signUp: boom }, (a) => a.signUpWithEmail(credentials)],
    [
      "requestPasswordReset",
      { resetPasswordForEmail: boom },
      (a) => a.requestPasswordReset("a@b.c"),
    ],
    ["confirmPasswordReset", { verifyOtp: boom }, (a) => a.confirmPasswordReset(reset)],
    [
      "signInWithApple",
      { signInWithIdToken: boom },
      (a) => a.signInWithApple({ idToken: "t", nonce: "n" }),
    ],
    [
      "saveName",
      { updateUser: boom },
      (a) => a.saveName({ fullName: "Ada", givenName: "Ada", familyName: null }),
    ],
    ["signOut", { signOut: boom }, (a) => a.signOut()],
    ["currentSession", { getSession: boom }, (a) => a.currentSession()],
  ];

  it.each(calls)(
    "returns unknown instead of throwing when %s rejects",
    async (_name, overrides, run) => {
      const { auth } = fakeClient(overrides);

      expect(await run(auth)).toMatchObject({
        ok: false,
        failure: "unknown",
        cause: { name: "Error", detail: null },
      });
    },
  );
});

describe("supabaseAuthOptions", () => {
  const storage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };

  it("persists the session in the given storage and refreshes it automatically", () => {
    expect(supabaseAuthOptions(storage)).toMatchObject({
      storage,
      persistSession: true,
      autoRefreshToken: true,
    });
  });

  it("does not look for a session in the url", () => {
    expect(supabaseAuthOptions(storage).detectSessionInUrl).toBe(false);
  });
});

describe("bindAutoRefresh", () => {
  function setup() {
    const auth = { startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() };
    const addEventListener =
      jest.fn<(type: "change", listener: (state: string) => void) => unknown>();
    bindAutoRefresh(auth, { addEventListener });
    const emit = (state: string) => addEventListener.mock.calls[0]?.[1](state);
    return { auth, emit };
  }

  it("starts refreshing when the app becomes active", () => {
    const { auth, emit } = setup();

    emit("active");

    expect(auth.startAutoRefresh).toHaveBeenCalledTimes(1);
    expect(auth.stopAutoRefresh).not.toHaveBeenCalled();
  });

  it("stops refreshing when the app goes to the background", () => {
    const { auth, emit } = setup();

    emit("background");

    expect(auth.stopAutoRefresh).toHaveBeenCalledTimes(1);
    expect(auth.startAutoRefresh).not.toHaveBeenCalled();
  });

  it("does nothing until the app state changes", () => {
    const { auth } = setup();

    expect(auth.startAutoRefresh).not.toHaveBeenCalled();
    expect(auth.stopAutoRefresh).not.toHaveBeenCalled();
  });

  it("stops refreshing on inactive", () => {
    const { auth, emit } = setup();

    emit("inactive");

    expect(auth.stopAutoRefresh).toHaveBeenCalledTimes(1);
  });
});
