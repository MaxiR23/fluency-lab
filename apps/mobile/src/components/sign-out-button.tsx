import { Button } from "@/components/button";
import { FailureMessage } from "@/components/failure-message";
import { useSignOut } from "@/hooks/use-sign-out";

export function SignOutButton() {
  const { running, failure, signOut } = useSignOut();

  return (
    <>
      {failure !== undefined ? (
        <FailureMessage message={failure.message} cause={failure.cause} />
      ) : null}
      <Button variant="deep" label="Sign out" loading={running} onPress={() => void signOut()} />
    </>
  );
}
