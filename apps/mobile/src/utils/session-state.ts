import type {
  AppleSignInOutcome,
  AuthFailure,
  AuthOutcome,
  AuthSession,
  FailureCause,
  PasswordResetOutcome,
} from "@/auth/auth-port";
import { DEADLINE } from "@/utils/deadline";

export type SessionState = {
  loaded: boolean;
  session: AuthSession | null;
  resetRunning: boolean;
  appleRunning: boolean;
  restoreRunning: boolean;
  restoreFailure: { failure: AuthFailure; cause?: FailureCause } | null;
};

export type SessionEvent =
  | { type: "session_changed"; session: AuthSession | null }
  | { type: "reset_started" }
  | { type: "reset_finished" }
  | { type: "apple_started" }
  | { type: "apple_finished" }
  | { type: "restore_started" }
  | { type: "restore_finished"; outcome: AuthOutcome<AuthSession | null> };

export const initialSessionState: SessionState = {
  loaded: false,
  session: null,
  resetRunning: false,
  appleRunning: false,
  restoreRunning: false,
  restoreFailure: null,
};

export function sessionReducer(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case "session_changed":
      return {
        ...state,
        loaded: true,
        session: event.session,
        restoreRunning: false,
        restoreFailure: null,
      };
    case "reset_started":
      return { ...state, resetRunning: true };
    case "reset_finished":
      return { ...state, resetRunning: false };
    case "apple_started":
      return { ...state, appleRunning: true };
    case "apple_finished":
      return { ...state, appleRunning: false };
    case "restore_started":
      return state.loaded ? state : { ...state, restoreRunning: true };
    case "restore_finished": {
      if (state.loaded) return state;
      const outcome = event.outcome;
      if (outcome.ok) {
        return {
          ...state,
          loaded: true,
          session: outcome.value,
          restoreRunning: false,
          restoreFailure: null,
        };
      }
      return {
        ...state,
        restoreRunning: false,
        restoreFailure:
          outcome.cause === undefined
            ? { failure: outcome.failure }
            : { failure: outcome.failure, cause: outcome.cause },
      };
    }
  }
}

// INFO: longer than one Supabase request (10 s), so a slow refresh that answers still wins.
export const RESTORE_TIMEOUT_MS = 15000;

export function toRestoreOutcome(
  read: AuthOutcome<AuthSession | null> | typeof DEADLINE,
): AuthOutcome<AuthSession | null> {
  if (read === DEADLINE) return { ok: false, failure: "network" };
  return read;
}

export type LaunchView =
  | { kind: "waiting" }
  | { kind: "failed"; failure: AuthFailure; cause?: FailureCause; retrying: boolean }
  | { kind: "ready" };

export function launchView(fontsSettled: boolean, state: SessionState): LaunchView {
  if (!fontsSettled) return { kind: "waiting" };
  if (state.loaded) return { kind: "ready" };
  if (state.restoreFailure !== null) {
    return {
      kind: "failed",
      failure: state.restoreFailure.failure,
      cause: state.restoreFailure.cause,
      retrying: state.restoreRunning,
    };
  }
  return { kind: "waiting" };
}

// INFO: verifyOtp issues a session before the password is set, so while a
// reset runs the guard must not read the session.
export function canEnterApp(state: SessionState): boolean {
  return state.session !== null && !state.resetRunning && !state.appleRunning;
}

// INFO: when the password step failed and the session is still there, ending
// the hold at once would send the user to Home and lose the message.
export function keepsResetHold(outcome: PasswordResetOutcome): boolean {
  return !outcome.ok && outcome.step === "password" && outcome.stillSignedIn;
}

// INFO: signInWithIdToken issues the session before the name is saved, so a failed
// save must hold the guard or Home would show before the message is seen.
export function keepsAppleHold(outcome: AppleSignInOutcome): boolean {
  return outcome.status === "name_not_saved";
}
