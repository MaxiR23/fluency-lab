import { useState } from "react";

import { auth } from "@/auth";
import { authFailureView, type FailureView } from "@/utils/auth-message";

// INFO: no navigation here: the guard in the root layout sends the user to
// Login once the session goes away.
export function useSignOut(): {
  running: boolean;
  failure: FailureView | undefined;
  signOut: () => Promise<void>;
} {
  const [running, setRunning] = useState(false);
  const [failure, setFailure] = useState<FailureView | undefined>(undefined);

  async function signOut(): Promise<void> {
    setFailure(undefined);
    setRunning(true);
    const outcome = await auth.signOut();
    setRunning(false);
    if (!outcome.ok) setFailure(authFailureView(outcome));
  }

  return { running, failure, signOut };
}
