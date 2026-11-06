import { useState } from "react";

import { auth } from "@/auth";
import { Button } from "@/components/button";
import { FailureMessage } from "@/components/failure-message";
import { authFailureView, type FailureView } from "@/utils/auth-message";

// INFO: no navigation here: the guard in the root layout sends the user to
// Login once the session goes away.
export function SignOutButton() {
  const [running, setRunning] = useState(false);
  const [failure, setFailure] = useState<FailureView | undefined>(undefined);

  async function signOut() {
    setFailure(undefined);
    setRunning(true);
    const outcome = await auth.signOut();
    setRunning(false);
    if (!outcome.ok) setFailure(authFailureView(outcome));
  }

  return (
    <>
      {failure !== undefined ? (
        <FailureMessage message={failure.message} cause={failure.cause} />
      ) : null}
      <Button variant="deep" label="Sign out" loading={running} onPress={() => void signOut()} />
    </>
  );
}
