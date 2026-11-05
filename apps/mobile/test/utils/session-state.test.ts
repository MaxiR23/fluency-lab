// apps/mobile/test/utils/session-state.test.ts
//
// Tests for the session state rules.
//
// Tested:
// - The reducer over session and reset events
// - When the app is ready and when a user may enter it
// - Which reset and Apple outcomes keep the guard on hold
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/session-state.test.ts
//
// SEE: apps/mobile/src/utils/session-state.ts

import { describe, expect, it } from "@jest/globals";

import type { AppleSignInOutcome, AuthSession } from "@/auth/auth-port";
import {
  canEnterApp,
  initialSessionState,
  isAppReady,
  keepsAppleHold,
  keepsResetHold,
  sessionReducer,
  type SessionState,
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
  it("starts loading with no session and no reset", () => {
    expect(initialSessionState).toEqual({
      loaded: false,
      session: null,
      resetRunning: false,
      appleRunning: false,
    });
  });

  it("marks loaded with no session on the first null event", () => {
    expect(sessionReducer(initialSessionState, { type: "session_changed", session: null })).toEqual(
      {
        loaded: true,
        session: null,
        resetRunning: false,
        appleRunning: false,
      },
    );
  });

  it("marks loaded with the session on the first session event", () => {
    expect(sessionReducer(initialSessionState, { type: "session_changed", session })).toEqual({
      loaded: true,
      session,
      resetRunning: false,
      appleRunning: false,
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
    });
  });

  it("records a session that arrives during a reset", () => {
    const next = sessionReducer(state({ loaded: true, resetRunning: true }), {
      type: "session_changed",
      session,
    });
    expect(next).toEqual({ loaded: true, session, resetRunning: true, appleRunning: false });
  });

  it("ends the reset without touching the session", () => {
    expect(
      sessionReducer(state({ loaded: true, session, resetRunning: true }), {
        type: "reset_finished",
      }),
    ).toEqual({ loaded: true, session, resetRunning: false, appleRunning: false });
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
    });
  });

  it("records a session that arrives during an Apple sign-in", () => {
    const next = sessionReducer(state({ loaded: true, appleRunning: true }), {
      type: "session_changed",
      session,
    });
    expect(next).toEqual({ loaded: true, session, resetRunning: false, appleRunning: true });
  });

  it("ends the Apple hold without touching the session", () => {
    expect(
      sessionReducer(state({ loaded: true, session, appleRunning: true }), {
        type: "apple_finished",
      }),
    ).toEqual({ loaded: true, session, resetRunning: false, appleRunning: false });
  });

  it("ignores an Apple finish with nothing running", () => {
    const before = state({ loaded: true, session });
    expect(sessionReducer(before, { type: "apple_finished" })).toEqual(before);
  });
});

describe("isAppReady", () => {
  it("is false while fonts are unsettled", () => {
    expect(isAppReady(false, state({ loaded: true }))).toBe(false);
  });

  it("is false while the session loads", () => {
    expect(isAppReady(true, initialSessionState)).toBe(false);
  });

  it("is true when both settled, with or without a session", () => {
    expect(isAppReady(true, state({ loaded: true }))).toBe(true);
    expect(isAppReady(true, state({ loaded: true, session }))).toBe(true);
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
    expect(canEnterApp(state({ loaded: true, session, appleRunning: true }))).toBe(false);
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
