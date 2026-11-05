import type {
  AuthFailure,
  AuthOutcome,
  AuthPort,
  AuthSession,
  PasswordResetOutcome,
} from "@/auth/auth-port";
import { toAuthFailure } from "@/utils/auth-error";
import { toAuthSession } from "@/utils/auth-session";

type LibError = { name: string; code?: string } | null;
type LibSession = { access_token: string; user: { id: string; email?: string } };
type SessionResult = { data: { session: LibSession | null }; error: LibError };

export type SupabaseAuthClient = {
  signInWithPassword(c: { email: string; password: string }): Promise<SessionResult>;
  signUp(c: { email: string; password: string }): Promise<SessionResult>;
  signInWithIdToken(c: { provider: "apple"; token: string; nonce: string }): Promise<SessionResult>;
  resetPasswordForEmail(email: string): Promise<{ error: LibError }>;
  verifyOtp(p: { email: string; token: string; type: "recovery" }): Promise<SessionResult>;
  updateUser(
    a:
      | { password: string }
      | { data: { full_name: string; given_name: string | null; family_name: string | null } },
  ): Promise<{ error: LibError }>;
  signOut(o?: { scope: "local" }): Promise<{ error: LibError }>;
  getSession(): Promise<SessionResult>;
  onAuthStateChange(cb: (event: string, session: LibSession | null) => void): {
    data: { subscription: { unsubscribe(): void } };
  };
};

async function guarded<T>(run: () => Promise<AuthOutcome<T>>): Promise<AuthOutcome<T>> {
  try {
    return await run();
  } catch (thrown) {
    // INFO: auth-js rethrows what is not an AuthError; it reaches the screen typed.
    return { ok: false, failure: toAuthFailure(thrown) };
  }
}

function fromSessionResult(result: SessionResult): AuthOutcome<AuthSession> {
  if (result.error !== null) return { ok: false, failure: toAuthFailure(result.error) };
  if (result.data.session === null) return { ok: false, failure: "unknown" };
  return { ok: true, value: toAuthSession(result.data.session) };
}

function fromOptionalSessionResult(result: SessionResult): AuthOutcome<AuthSession | null> {
  if (result.error !== null) return { ok: false, failure: toAuthFailure(result.error) };
  const session = result.data.session;
  return { ok: true, value: session === null ? null : toAuthSession(session) };
}

function fromError(result: { error: LibError }): AuthOutcome<null> {
  if (result.error !== null) return { ok: false, failure: toAuthFailure(result.error) };
  return { ok: true, value: null };
}

async function deviceIsSignedOut(client: SupabaseAuthClient): Promise<boolean> {
  try {
    const { data, error } = await client.getSession();
    return error === null && data.session === null;
  } catch {
    // INFO: a rejected read is not a confirmation; the caller reports the session as possibly there.
    return false;
  }
}

async function localSignOutLeftSession(client: SupabaseAuthClient): Promise<boolean> {
  try {
    const { error } = await client.signOut({ scope: "local" });
    if (error === null) return false;
  } catch {
    // INFO: a rejection falls through to the same read as an error.
  }
  // INFO: auth-js removes the stored session after the request returns, but not when it
  // could not read an expired one. Only a second read tells which of the two happened.
  return !(await deviceIsSignedOut(client));
}

export function createSupabaseAuth(client: SupabaseAuthClient): AuthPort {
  async function confirmPasswordReset(input: {
    email: string;
    code: string;
    newPassword: string;
  }): Promise<PasswordResetOutcome> {
    let session: LibSession;
    try {
      const verified = await client.verifyOtp({
        email: input.email,
        token: input.code,
        type: "recovery",
      });
      if (verified.error !== null) {
        return { ok: false, step: "code", failure: toAuthFailure(verified.error) };
      }
      if (verified.data.session === null) {
        return { ok: false, step: "code", failure: "unknown" };
      }
      session = verified.data.session;
    } catch (thrown) {
      return { ok: false, step: "code", failure: toAuthFailure(thrown) };
    }

    let failure: AuthFailure;
    try {
      const updated = await client.updateUser({ password: input.newPassword });
      if (updated.error === null) return { ok: true, value: toAuthSession(session) };
      failure = toAuthFailure(updated.error);
    } catch (thrown) {
      failure = toAuthFailure(thrown);
    }
    const stillSignedIn = await localSignOutLeftSession(client);
    return { ok: false, step: "password", failure, stillSignedIn };
  }

  return {
    signInWithEmail: (input) =>
      guarded(async () => fromSessionResult(await client.signInWithPassword(input))),
    signUpWithEmail: (input) =>
      guarded(async () => fromOptionalSessionResult(await client.signUp(input))),
    requestPasswordReset: (email) =>
      guarded(async () => fromError(await client.resetPasswordForEmail(email))),
    confirmPasswordReset,
    signInWithApple: (input) =>
      guarded(async () =>
        fromSessionResult(
          await client.signInWithIdToken({
            provider: "apple",
            token: input.idToken,
            nonce: input.nonce,
          }),
        ),
      ),
    saveName: (name) =>
      guarded(async () =>
        fromError(
          await client.updateUser({
            data: {
              full_name: name.fullName,
              given_name: name.givenName,
              family_name: name.familyName,
            },
          }),
        ),
      ),
    signOut: () =>
      guarded(async () => {
        const result = await client.signOut();
        if (result.error === null) return { ok: true, value: null };
        // INFO: auth-js removes the stored session after most failed requests, but keeps it
        // when it cannot refresh an expired one. The error alone does not say which, so the
        // port reports a sign-out only when a second read finds no session and no error.
        if (await deviceIsSignedOut(client)) return { ok: true, value: null };
        return { ok: false, failure: toAuthFailure(result.error) };
      }),
    currentSession: () => guarded(async () => fromOptionalSessionResult(await client.getSession())),
    onSessionChange(listener) {
      const { data } = client.onAuthStateChange((_event, session) => {
        listener(session === null ? null : toAuthSession(session));
      });
      return () => data.subscription.unsubscribe();
    },
  };
}

export function supabaseAuthOptions<S>(storage: S) {
  return {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  } as const;
}

export function bindAutoRefresh(
  auth: { startAutoRefresh(): unknown; stopAutoRefresh(): unknown },
  appState: {
    addEventListener(type: "change", listener: (state: string) => void): unknown;
  },
): void {
  appState.addEventListener("change", (state) => {
    if (state === "active") auth.startAutoRefresh();
    else auth.stopAutoRefresh();
  });
}
