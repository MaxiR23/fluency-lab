// apps/mobile/test/utils/session-state.test.ts
//
// Tests for the session state rules.
//
// Tested:
// - The reducer over session and reset events
// - The launch restore: started, finished with a session, with none, failed; a later event wins
// - The launch view, and when a user may enter the app
// - Which reset and Apple outcomes keep the guard on hold
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/session-state.test.ts
//
// SEE: apps/mobile/src/utils/session-state.ts

import { describe, expect, it } from "@jest/globals";

import { DEADLINE } from "@/utils/deadline";
import type { AppleSignInOutcome, AuthSession } from "@/auth/auth-port";
import {
  canEnterApp,
  initialSessionState,
  launchView,
  keepsAppleHold,
  keepsResetHold,
  RESTORE_TIMEOUT_MS,
  sessionReducer,
  type SessionState,
  toRestoreOutcome,
} from "@/utils/session-state";
import { generatedSecret } from "../helpers/generated-secret";

const session: AuthSession = {
  accessToken: generatedSecret("token"),
  user: { id: "user-1", email: "name@email.com" },
};
const other: AuthSession = { ...session, user: { id: "user-2", email: null } };

function state(overrides: Partial<SessionState>): SessionState {
  return { ...initialSessionState, ...overrides };
}

describe("sessionReducer", () => {
  it("starts loading with no session, no reset and no restore", () => {
    expect(initialSessionState).toEqual({
      loaded: false,
      session: null,
      resetRunning: false,
      appleRunning: false,
      restoreRunning: false,
      restoreFailure: null,
    });
  });

  it("marks loaded with no session on the first null event", () => {
    expect(sessionReducer(initialSessionState, { type: "session_changed", session: null })).toEqual(
      {
        loaded: true,
        session: null,
        resetRunning: false,
        appleRunning: false,
        restoreRunning: false,
        restoreFailure: null,
      },
    );
  });

  it("marks loaded with the session on the first session event", () => {
    expect(sessionReducer(initialSessionState, { type: "session_changed", session })).toEqual({
      loaded: true,
      session,
      resetRunning: false,
      appleRunning: false,
      restoreRunning: false,
      restoreFailure: null,
    });
  });

  it("replaces the session on a later event", () => {
    const next = sessionReducer(state({ loaded: true, session }), {
      type: "session_changed",
      session: other,
    });
    expect(next.session).toBe(other);
  });

  it("keeps the session when a reset starts", () => {
    expect(sessionReducer(state({ loaded: true, session }), { type: "reset_started" })).toEqual({
      loaded: true,
      session,
      resetRunning: true,
      appleRunning: false,
      restoreRunning: false,
      restoreFailure: null,
    });
  });

  it("records a session that arrives during a reset", () => {
    const next = sessionReducer(state({ loaded: true, resetRunning: true }), {
      type: "session_changed",
      session,
    });
    expect(next).toEqual({
      loaded: true,
      session,
      resetRunning: true,
      appleRunning: false,
      restoreRunning: false,
      restoreFailure: null,
    });
  });

  it("ends the reset without touching the session", () => {
    expect(
      sessionReducer(state({ loaded: true, session, resetRunning: true }), {
        type: "reset_finished",
      }),
    ).toEqual({
      loaded: true,
      session,
      resetRunning: false,
      appleRunning: false,
      restoreRunning: false,
      restoreFailure: null,
    });
  });

  it("ignores a finish with no reset running", () => {
    const before = state({ loaded: true, session });
    expect(sessionReducer(before, { type: "reset_finished" })).toEqual(before);
  });
});

describe("sessionReducer, Apple events", () => {
  it("keeps the session when an Apple sign-in starts", () => {
    expect(sessionReducer(state({ loaded: true, session }), { type: "apple_started" })).toEqual({
      loaded: true,
      session,
      resetRunning: false,
      appleRunning: true,
      restoreRunning: false,
      restoreFailure: null,
    });
  });

  it("records a session that arrives during an Apple sign-in", () => {
    const next = sessionReducer(
      state({ loaded: true, appleRunning: true, restoreRunning: false, restoreFailure: null }),
      {
        type: "session_changed",
        session,
      },
    );
    expect(next).toEqual({
      loaded: true,
      session,
      resetRunning: false,
      appleRunning: true,
      restoreRunning: false,
      restoreFailure: null,
    });
  });

  it("ends the Apple hold without touching the session", () => {
    expect(
      sessionReducer(
        state({
          loaded: true,
          session,
          appleRunning: true,
          restoreRunning: false,
          restoreFailure: null,
        }),
        {
          type: "apple_finished",
        },
      ),
    ).toEqual({
      loaded: true,
      session,
      resetRunning: false,
      appleRunning: false,
      restoreRunning: false,
      restoreFailure: null,
    });
  });

  it("ignores an Apple finish with nothing running", () => {
    const before = state({ loaded: true, session });
    expect(sessionReducer(before, { type: "apple_finished" })).toEqual(before);
  });
});

describe("sessionReducer, launch restore", () => {
  const failure = { ok: false, failure: "network", cause: { name: "X", detail: null } } as const;

  it("marks the restore running when it starts", () => {
    expect(sessionReducer(initialSessionState, { type: "restore_started" }).restoreRunning).toBe(
      true,
    );
  });

  it("keeps the failure while a retry runs", () => {
    const failed = sessionReducer(initialSessionState, {
      type: "restore_finished",
      outcome: failure,
    });
    const next = sessionReducer(failed, { type: "restore_started" });
    expect(next.restoreRunning).toBe(true);
    expect(next.restoreFailure).toEqual({ failure: "network", cause: failure.cause });
  });

  it("loads with the session when the restore finds one", () => {
    const next = sessionReducer(initialSessionState, {
      type: "restore_finished",
      outcome: { ok: true, value: session },
    });
    expect(next).toMatchObject({ loaded: true, session, restoreRunning: false });
  });

  it("loads signed out when the restore finds no session", () => {
    const next = sessionReducer(state({ restoreRunning: true }), {
      type: "restore_finished",
      outcome: { ok: true, value: null },
    });
    expect(next).toMatchObject({
      loaded: true,
      session: null,
      restoreRunning: false,
      restoreFailure: null,
    });
  });

  it("records the failure and its cause when the restore fails", () => {
    const next = sessionReducer(state({ restoreRunning: true }), {
      type: "restore_finished",
      outcome: failure,
    });
    expect(next).toMatchObject({
      loaded: false,
      restoreRunning: false,
      restoreFailure: { failure: "network", cause: failure.cause },
    });
  });

  it("records a failure without a cause", () => {
    const next = sessionReducer(initialSessionState, {
      type: "restore_finished",
      outcome: { ok: false, failure: "network" },
    });
    expect(next.restoreFailure).toEqual({ failure: "network" });
  });

  it("ignores a restore start or finish after the session loaded", () => {
    const before = state({ loaded: true, session });
    expect(sessionReducer(before, { type: "restore_started" })).toEqual(before);
    expect(
      sessionReducer(before, { type: "restore_finished", outcome: { ok: true, value: null } }),
    ).toEqual(before);
    expect(sessionReducer(before, { type: "restore_finished", outcome: failure })).toEqual(before);
  });

  it("clears the failure when a session event arrives", () => {
    const failed = sessionReducer(initialSessionState, {
      type: "restore_finished",
      outcome: failure,
    });
    const next = sessionReducer(failed, { type: "session_changed", session });
    expect(next).toMatchObject({
      loaded: true,
      session,
      restoreRunning: false,
      restoreFailure: null,
    });
  });
});

describe("toRestoreOutcome", () => {
  it("turns the deadline into network", () => {
    expect(toRestoreOutcome(DEADLINE)).toEqual({ ok: false, failure: "network" });
  });

  it("returns a session outcome as it is", () => {
    const outcome = { ok: true, value: session } as const;
    expect(toRestoreOutcome(outcome)).toBe(outcome);
  });

  it("returns a null session as it is", () => {
    const outcome = { ok: true, value: null } as const;
    expect(toRestoreOutcome(outcome)).toBe(outcome);
  });

  it("returns a failure as it is", () => {
    const outcome = { ok: false, failure: "unknown" } as const;
    expect(toRestoreOutcome(outcome)).toBe(outcome);
  });

  it("has a deadline longer than one Supabase request", () => {
    expect(RESTORE_TIMEOUT_MS).toBe(15000);
  });
});

describe("launchView", () => {
  const failed = state({ restoreFailure: { failure: "network" } });

  it("waits while the fonts load, even with a failure", () => {
    expect(launchView(false, failed)).toEqual({ kind: "waiting" });
    expect(launchView(false, state({ loaded: true }))).toEqual({ kind: "waiting" });
  });

  it("waits while the restore runs", () => {
    expect(launchView(true, state({ restoreRunning: true }))).toEqual({ kind: "waiting" });
    expect(launchView(true, initialSessionState)).toEqual({ kind: "waiting" });
  });

  it("is ready once the session loaded, with or without a session", () => {
    expect(launchView(true, state({ loaded: true }))).toEqual({ kind: "ready" });
    expect(launchView(true, state({ loaded: true, session }))).toEqual({ kind: "ready" });
  });

  it("is failed with the failure and not retrying", () => {
    expect(launchView(true, failed)).toEqual({
      kind: "failed",
      failure: "network",
      cause: undefined,
      retrying: false,
    });
  });

  it("is failed and retrying while a retry runs", () => {
    expect(launchView(true, { ...failed, restoreRunning: true })).toMatchObject({
      kind: "failed",
      retrying: true,
    });
  });
});

describe("canEnterApp", () => {
  it("is false with no session", () => {
    expect(canEnterApp(state({ loaded: true }))).toBe(false);
  });

  it("is true with a session", () => {
    expect(canEnterApp(state({ loaded: true, session }))).toBe(true);
  });

  it("is false with a session while a reset runs", () => {
    expect(canEnterApp(state({ loaded: true, session, resetRunning: true }))).toBe(false);
  });

  it("is false with no session while a reset runs", () => {
    expect(canEnterApp(state({ loaded: true, resetRunning: true }))).toBe(false);
  });
});

describe("canEnterApp, Apple", () => {
  it("is false with a session while an Apple sign-in runs", () => {
    expect(
      canEnterApp(
        state({
          loaded: true,
          session,
          appleRunning: true,
          restoreRunning: false,
          restoreFailure: null,
        }),
      ),
    ).toBe(false);
  });
});

describe("keepsAppleHold", () => {
  it("is true only for name_not_saved", () => {
    const name = { fullName: "Ada", givenName: "Ada", familyName: null };
    const outcomes: [AppleSignInOutcome, boolean][] = [
      [{ status: "signed_in" }, false],
      [{ status: "canceled" }, false],
      [{ status: "failed", failure: "network" }, false],
      [{ status: "name_not_saved", failure: "network", name }, true],
    ];
    for (const [outcome, expected] of outcomes) {
      expect(keepsAppleHold(outcome)).toBe(expected);
    }
  });
});

describe("keepsResetHold", () => {
  it("is false on success", () => {
    expect(keepsResetHold({ ok: true, value: session })).toBe(false);
  });

  it("is false at step code", () => {
    expect(keepsResetHold({ ok: false, step: "code", failure: "network" })).toBe(false);
  });

  it("is false at step password when signed out", () => {
    expect(
      keepsResetHold({ ok: false, step: "password", failure: "network", stillSignedIn: false }),
    ).toBe(false);
  });

  it("is true at step password when still signed in", () => {
    expect(
      keepsResetHold({ ok: false, step: "password", failure: "network", stillSignedIn: true }),
    ).toBe(true);
  });
});
