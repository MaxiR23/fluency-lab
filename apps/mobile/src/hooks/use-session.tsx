import { createContext, type ReactNode, use, useEffect, useReducer } from "react";

import { apple, auth } from "@/auth";
import { runAppleSignIn } from "@/auth/apple-sign-in";
import type {
  AppleSignInOutcome,
  AuthOutcome,
  AuthSession,
  PasswordResetOutcome,
  ProfileName,
} from "@/auth/auth-port";
import { withinDeadline } from "@/utils/deadline";
import {
  canEnterApp,
  initialSessionState,
  keepsAppleHold,
  keepsResetHold,
  RESTORE_TIMEOUT_MS,
  sessionReducer,
  type SessionState,
  toRestoreOutcome,
} from "@/utils/session-state";

type ConfirmInput = { email: string; code: string; newPassword: string };

type SessionValue = {
  state: SessionState;
  signedIn: boolean;
  confirmPasswordReset: (input: ConfirmInput) => Promise<PasswordResetOutcome>;
  releaseReset: () => void;
  signInWithApple: () => Promise<AppleSignInOutcome>;
  retryAppleName: (name: ProfileName) => Promise<AuthOutcome<null>>;
  releaseApple: () => void;
  retryRestore: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

async function restoreSession(): Promise<AuthOutcome<AuthSession | null>> {
  return toRestoreOutcome(await withinDeadline(RESTORE_TIMEOUT_MS, () => auth.currentSession()));
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, initialSessionState);

  // INFO: the listener only dispatches; auth-js warns against async work inside it.
  useEffect(
    () => auth.onSessionChange((session) => dispatch({ type: "session_changed", session })),
    [],
  );

  // INFO: the session at launch is read once and bounded; a late result is dropped by the reducer.
  useEffect(() => {
    dispatch({ type: "restore_started" });
    void restoreSession().then((outcome) => dispatch({ type: "restore_finished", outcome }));
  }, []);

  async function retryRestore(): Promise<void> {
    dispatch({ type: "restore_started" });
    dispatch({ type: "restore_finished", outcome: await restoreSession() });
  }

  async function confirmPasswordReset(input: ConfirmInput): Promise<PasswordResetOutcome> {
    dispatch({ type: "reset_started" });
    const outcome = await auth.confirmPasswordReset(input);
    if (!keepsResetHold(outcome)) {
      dispatch({ type: "reset_finished" });
    }
    return outcome;
  }

  async function signInWithApple(): Promise<AppleSignInOutcome> {
    dispatch({ type: "apple_started" });
    const outcome = await runAppleSignIn({ apple, auth });
    if (!keepsAppleHold(outcome)) {
      dispatch({ type: "apple_finished" });
    }
    return outcome;
  }

  async function retryAppleName(name: ProfileName): Promise<AuthOutcome<null>> {
    const outcome = await auth.saveName(name);
    if (outcome.ok) dispatch({ type: "apple_finished" });
    return outcome;
  }

  const value: SessionValue = {
    state,
    signedIn: canEnterApp(state),
    confirmPasswordReset,
    releaseReset: () => dispatch({ type: "reset_finished" }),
    signInWithApple,
    retryAppleName,
    releaseApple: () => dispatch({ type: "apple_finished" }),
    retryRestore,
  };

  return <SessionContext value={value}>{children}</SessionContext>;
}

// INFO: using the hook outside the provider is a programming error, not an outcome.
export function useSession(): SessionValue {
  const value = use(SessionContext);
  if (value === null) {
    throw new Error("useSession must be used inside SessionProvider");
  }
  return value;
}
