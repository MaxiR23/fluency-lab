import { createContext, type ReactNode, use, useEffect, useReducer } from "react";

import { auth } from "@/auth";
import type { PasswordResetOutcome } from "@/auth/auth-port";
import {
  canEnterApp,
  initialSessionState,
  keepsResetHold,
  sessionReducer,
  type SessionState,
} from "@/utils/session-state";

type ConfirmInput = { email: string; code: string; newPassword: string };

type SessionValue = {
  state: SessionState;
  signedIn: boolean;
  confirmPasswordReset: (input: ConfirmInput) => Promise<PasswordResetOutcome>;
  releaseReset: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, initialSessionState);

  // INFO: the listener only dispatches; auth-js warns against async work inside it.
  useEffect(
    () => auth.onSessionChange((session) => dispatch({ type: "session_changed", session })),
    [],
  );

  async function confirmPasswordReset(input: ConfirmInput): Promise<PasswordResetOutcome> {
    dispatch({ type: "reset_started" });
    const outcome = await auth.confirmPasswordReset(input);
    if (!keepsResetHold(outcome)) {
      dispatch({ type: "reset_finished" });
    }
    return outcome;
  }

  const value: SessionValue = {
    state,
    signedIn: canEnterApp(state),
    confirmPasswordReset,
    releaseReset: () => dispatch({ type: "reset_finished" }),
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
