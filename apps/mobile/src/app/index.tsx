import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { auth } from "@/auth";
import { Button } from "@/components/button";
import { FailureMessage } from "@/components/failure-message";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { spacing } from "@/constants/theme";
import { authFailureView, type FailureView } from "@/utils/auth-message";

export default function Index() {
  const [running, setRunning] = useState(false);
  const [failure, setFailure] = useState<FailureView | undefined>(undefined);

  // INFO: no navigation here: the guard in the root layout sends the user
  // back to Login once the session goes away.
  async function signOut() {
    setFailure(undefined);
    setRunning(true);
    const outcome = await auth.signOut();
    setRunning(false);
    if (!outcome.ok) setFailure(authFailureView(outcome));
  }

  return (
    <Screen>
      <View style={styles.content}>
        <Text variant="title">Home</Text>
        {failure !== undefined ? (
          <FailureMessage message={failure.message} cause={failure.cause} />
        ) : null}
        <Button variant="deep" label="Sign out" loading={running} onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.screenSide, gap: spacing.md },
});
