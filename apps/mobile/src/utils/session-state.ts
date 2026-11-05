import type { AppleSignInOutcome, AuthSession, PasswordResetOutcome } from "@/auth/auth-port";

export type SessionState = {
  loaded: boolean;
  session: AuthSession | null;
  resetRunning: boolean;
  appleRunning: boolean;
};

export type SessionEvent =
  | { type: "session_changed"; session: AuthSession | null }
  | { type: "reset_started" }
  | { type: "reset_finished" }
  | { type: "apple_started" }
  | { type: "apple_finished" };

export const initialSessionState: SessionState = {
  loaded: false,
  session: null,
  resetRunning: false,
  appleRunning: false,
};

export function sessionReducer(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case "session_changed":
      return { ...state, loaded: true, session: event.session };
    case "reset_started":
      return { ...state, resetRunning: true };
    case "reset_finished":
      return { ...state, resetRunning: false };
    case "apple_started":
      return { ...state, appleRunning: true };
    case "apple_finished":
      return { ...state, appleRunning: false };
  }
}

export function isAppReady(fontsSettled: boolean, state: SessionState): boolean {
  return fontsSettled && state.loaded;
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
