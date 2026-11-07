// apps/mobile/test/hooks/use-session.test.tsx
//
// Tests for the session provider and its hook.
//
// Tested:
// - Loading until the first session event, then signed in or out
// - The guard value stays closed while a reset confirmation runs
// - The guard value stays closed while an Apple sign-in runs and after a name failure
// - The listener is removed on unmount
// - The launch restore: a session, no session, a failure, the deadline, the retry, a late event
// - The hook throws outside the provider
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/hooks/use-session.test.tsx
//
// SEE: apps/mobile/src/hooks/use-session.tsx

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";

import type {
  AppleSignInOutcome,
  AuthOutcome,
  AuthSession,
  PasswordResetOutcome,
  ProfileName,
} from "@/auth/auth-port";
import { SessionProvider, useSession } from "@/hooks/use-session";
import { RESTORE_TIMEOUT_MS } from "@/utils/session-state";
import { emitSession, fakeApple, fakeAuth, fakeSession, resetFakeAuth } from "../helpers/fake-auth";
import { generatedSecret } from "../helpers/generated-secret";

jest.mock("@/auth", () => ({
  auth: jest.requireActual<typeof import("../helpers/fake-auth")>("../helpers/fake-auth").fakeAuth,
  apple:
    jest.requireActual<typeof import("../helpers/fake-auth")>("../helpers/fake-auth").fakeApple,
}));

function wrapper({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

const resetInput = {
  email: "name@email.com",
  code: generatedSecret("code"),
  newPassword: generatedSecret("password"),
};

const appleCredential = {
  ok: true,
  value: {
    idToken: generatedSecret("id-token"),
    rawNonce: generatedSecret("nonce"),
    fullName: { givenName: "Ada", familyName: "Lovelace" },
  },
} as const;

const profileName: ProfileName = {
  fullName: "Ada Lovelace",
  givenName: "Ada",
  familyName: "Lovelace",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("useSession", () => {
  beforeEach(() => {
    resetFakeAuth();
  });

  it("reports loading until the first event", async () => {
    const { result } = await renderHook(() => useSession(), { wrapper });
    expect(result.current.state.loaded).toBe(false);
    expect(result.current.signedIn).toBe(false);
  });

  it("reports signed in after a session event", async () => {
    const { result } = await renderHook(() => useSession(), { wrapper });
    await act(async () => emitSession(fakeSession()));
    expect(result.current.state.loaded).toBe(true);
    expect(result.current.signedIn).toBe(true);
  });

  it("reports signed out after a null event", async () => {
    const { result } = await renderHook(() => useSession(), { wrapper });
    await act(async () => emitSession(null));
    expect(result.current.state.loaded).toBe(true);
    expect(result.current.signedIn).toBe(false);
  });

  it("unsubscribes on unmount", async () => {
    const { unmount } = await renderHook(() => useSession(), { wrapper });
    await unmount();
    expect(() => emitSession(null)).toThrow("no session listener");
  });

  it("throws outside the provider", async () => {
    await expect(renderHook(() => useSession())).rejects.toThrow("SessionProvider");
  });

  it("keeps the guard closed while the confirmation runs, then opens it on success", async () => {
    const pending = deferred<PasswordResetOutcome>();
    fakeAuth.confirmPasswordReset.mockReturnValue(pending.promise);
    const { result } = await renderHook(() => useSession(), { wrapper });
    await act(async () => emitSession(null));

    let outcome: Promise<PasswordResetOutcome> | undefined;
    await act(async () => {
      outcome = result.current.confirmPasswordReset(resetInput);
    });
    const session = fakeSession();
    await act(async () => emitSession(session));
    expect(result.current.signedIn).toBe(false);

    await act(async () => pending.resolve({ ok: true, value: session }));
    expect(await outcome).toEqual({ ok: true, value: session });
    expect(result.current.signedIn).toBe(true);
    expect(fakeAuth.confirmPasswordReset).toHaveBeenCalledWith(resetInput);
  });

  it("holds the guard after a failed password step while still signed in, until released", async () => {
    fakeAuth.confirmPasswordReset.mockResolvedValue({
      ok: false,
      step: "password",
      failure: "weak_password",
      stillSignedIn: true,
    });
    const { result } = await renderHook(() => useSession(), { wrapper });
    await act(async () => emitSession(fakeSession()));
    await act(async () => {
      await result.current.confirmPasswordReset(resetInput);
    });
    expect(result.current.signedIn).toBe(false);
    await act(async () => result.current.releaseReset());
    expect(result.current.signedIn).toBe(true);
  });

  it("releases the guard after a failure at step code", async () => {
    fakeAuth.confirmPasswordReset.mockResolvedValue({
      ok: false,
      step: "code",
      failure: "invalid_or_expired_code",
    });
    const { result } = await renderHook(() => useSession(), { wrapper });
    await act(async () => emitSession(null));
    await act(async () => {
      await result.current.confirmPasswordReset(resetInput);
    });
    expect(result.current.state.resetRunning).toBe(false);
    expect(result.current.signedIn).toBe(false);
  });

  it("keeps the guard closed while the Apple sign-in runs, then opens it when it ends", async () => {
    const pending = deferred<AuthOutcome<AuthSession>>();
    fakeApple.requestCredential.mockResolvedValue(appleCredential);
    fakeAuth.signInWithApple.mockReturnValue(pending.promise);
    fakeAuth.saveName.mockResolvedValue({ ok: true, value: null });
    const { result } = await renderHook(() => useSession(), { wrapper });
    await act(async () => emitSession(null));
    let running!: Promise<AppleSignInOutcome>;
    await act(async () => {
      running = result.current.signInWithApple();
    });
    await act(async () => emitSession(fakeSession()));
    expect(result.current.signedIn).toBe(false);
    await act(async () => {
      pending.resolve({ ok: true, value: fakeSession() });
      await running;
    });
    expect(result.current.signedIn).toBe(true);
  });

  it("keeps the guard closed after a name failure, until released", async () => {
    fakeApple.requestCredential.mockResolvedValue(appleCredential);
    fakeAuth.signInWithApple.mockResolvedValue({ ok: true, value: fakeSession() });
    fakeAuth.saveName.mockResolvedValue({ ok: false, failure: "network" });
    const { result } = await renderHook(() => useSession(), { wrapper });
    await act(async () => emitSession(fakeSession()));
    let outcome!: AppleSignInOutcome;
    await act(async () => {
      outcome = await result.current.signInWithApple();
    });
    expect(outcome.status).toBe("name_not_saved");
    expect(result.current.signedIn).toBe(false);
    await act(async () => result.current.releaseApple());
    expect(result.current.signedIn).toBe(true);
  });

  it("opens the guard when the name retry succeeds", async () => {
    fakeApple.requestCredential.mockResolvedValue(appleCredential);
    fakeAuth.signInWithApple.mockResolvedValue({ ok: true, value: fakeSession() });
    fakeAuth.saveName.mockResolvedValueOnce({ ok: false, failure: "network" });
    const { result } = await renderHook(() => useSession(), { wrapper });
    await act(async () => emitSession(fakeSession()));
    await act(async () => {
      expect((await result.current.signInWithApple()).status).toBe("name_not_saved");
    });
    fakeAuth.saveName.mockResolvedValueOnce({ ok: true, value: null });
    await act(async () => {
      await result.current.retryAppleName(profileName);
    });
    expect(fakeAuth.saveName).toHaveBeenLastCalledWith(profileName);
    expect(result.current.signedIn).toBe(true);
  });

  it("keeps the guard closed when the name retry fails", async () => {
    fakeApple.requestCredential.mockResolvedValue(appleCredential);
    fakeAuth.signInWithApple.mockResolvedValue({ ok: true, value: fakeSession() });
    fakeAuth.saveName.mockResolvedValue({ ok: false, failure: "network" });
    const { result } = await renderHook(() => useSession(), { wrapper });
    await act(async () => emitSession(fakeSession()));
    await act(async () => {
      expect((await result.current.signInWithApple()).status).toBe("name_not_saved");
    });
    let retried!: AuthOutcome<null>;
    await act(async () => {
      retried = await result.current.retryAppleName(profileName);
    });
    expect(retried).toEqual({ ok: false, failure: "network" });
    expect(result.current.signedIn).toBe(false);
  });

  it("releases the hold after a cancel", async () => {
    fakeApple.requestCredential.mockResolvedValue({ ok: false, failure: "canceled" });
    const { result } = await renderHook(() => useSession(), { wrapper });
    await act(async () => emitSession(fakeSession()));
    await act(async () => {
      await result.current.signInWithApple();
    });
    expect(result.current.state.appleRunning).toBe(false);
    expect(result.current.signedIn).toBe(true);
  });

  it("releases the hold after a failed sign-in", async () => {
    fakeApple.requestCredential.mockResolvedValue(appleCredential);
    fakeAuth.signInWithApple.mockResolvedValue({ ok: false, failure: "unknown" });
    const { result } = await renderHook(() => useSession(), { wrapper });
    await act(async () => emitSession(null));
    await act(async () => {
      await result.current.signInWithApple();
    });
    expect(result.current.state.appleRunning).toBe(false);
    expect(result.current.signedIn).toBe(false);
  });
});

describe("useSession, launch restore", () => {
  beforeEach(() => {
    resetFakeAuth();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const failure = { ok: false, failure: "network" } as const;

  it("restores the session at launch from currentSession", async () => {
    fakeAuth.currentSession.mockResolvedValue({ ok: true, value: fakeSession() });
    const { result } = await renderHook(() => useSession(), { wrapper });
    expect(result.current.state.loaded).toBe(true);
    expect(result.current.signedIn).toBe(true);
  });

  it("loads signed out when currentSession finds no session", async () => {
    fakeAuth.currentSession.mockResolvedValue({ ok: true, value: null });
    const { result } = await renderHook(() => useSession(), { wrapper });
    expect(result.current.state.loaded).toBe(true);
    expect(result.current.signedIn).toBe(false);
    expect(result.current.state.restoreFailure).toBeNull();
  });

  it("records the failure when currentSession fails", async () => {
    fakeAuth.currentSession.mockResolvedValue(failure);
    const { result } = await renderHook(() => useSession(), { wrapper });
    expect(result.current.state.loaded).toBe(false);
    expect(result.current.state.restoreFailure?.failure).toBe("network");
  });

  it("records network when currentSession does not settle before the deadline", async () => {
    jest.useFakeTimers();
    const { result } = await renderHook(() => useSession(), { wrapper });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(RESTORE_TIMEOUT_MS);
    });
    expect(result.current.state.loaded).toBe(false);
    expect(result.current.state.restoreFailure?.failure).toBe("network");
  });

  it("retries the restore and loads when it succeeds", async () => {
    fakeAuth.currentSession.mockResolvedValueOnce(failure);
    const { result } = await renderHook(() => useSession(), { wrapper });
    const second = deferred<AuthOutcome<AuthSession | null>>();
    fakeAuth.currentSession.mockReturnValueOnce(second.promise);

    let retry!: Promise<void>;
    await act(async () => {
      retry = result.current.retryRestore();
    });
    expect(result.current.state.restoreRunning).toBe(true);

    await act(async () => {
      second.resolve({ ok: true, value: null });
      await retry;
    });
    expect(result.current.state.loaded).toBe(true);
    expect(result.current.state.restoreRunning).toBe(false);
    expect(fakeAuth.currentSession).toHaveBeenCalledTimes(2);
  });

  it("keeps the failure when the retry fails again", async () => {
    fakeAuth.currentSession.mockResolvedValue(failure);
    const { result } = await renderHook(() => useSession(), { wrapper });
    await act(async () => result.current.retryRestore());
    expect(result.current.state.loaded).toBe(false);
    expect(result.current.state.restoreRunning).toBe(false);
    expect(result.current.state.restoreFailure?.failure).toBe("network");
  });

  it("lets a later session event replace the failure", async () => {
    fakeAuth.currentSession.mockResolvedValue(failure);
    const { result } = await renderHook(() => useSession(), { wrapper });
    await act(async () => emitSession(fakeSession()));
    expect(result.current.state.loaded).toBe(true);
    expect(result.current.signedIn).toBe(true);
    expect(result.current.state.restoreFailure).toBeNull();
  });

  it("drops a restore that ends after a session event", async () => {
    const pending = deferred<AuthOutcome<AuthSession | null>>();
    fakeAuth.currentSession.mockReturnValue(pending.promise);
    const { result } = await renderHook(() => useSession(), { wrapper });
    await act(async () => emitSession(fakeSession()));
    await act(async () => pending.resolve({ ok: true, value: null }));
    expect(result.current.signedIn).toBe(true);
  });
});
