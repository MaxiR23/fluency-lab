import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { auth } from "@/auth";
import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/button";
import { EmailField } from "@/components/email-field";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { spacing } from "@/constants/theme";
import {
  hasFieldErrors,
  normalizeEmail,
  validateCredentials,
  type FieldErrors,
} from "@/utils/auth-form";
import { authFailureMessage, signUpPendingMessage } from "@/utils/auth-message";

export default function CreateAccount() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [running, setRunning] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);

  async function submit() {
    const errors = validateCredentials({ email, password });
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) return;
    setFailure(undefined);
    setRunning(true);
    const outcome = await auth.signUpWithEmail({ email: normalizeEmail(email), password });
    setRunning(false);
    if (!outcome.ok) {
      setFailure(authFailureMessage(outcome.failure));
    } else if (outcome.value === null) {
      setPending(true);
    }
  }

  return (
    <AuthScreen
      title="Create your account"
      subtitle="Start practicing English by writing."
      footer={{
        prompt: "Already have an account?",
        linkLabel: "Sign in",
        onPress: () => router.replace("/sign-in"),
        disabled: running,
      }}
    >
      {pending ? (
        <Text variant="subtitle">{signUpPendingMessage}</Text>
      ) : (
        <View style={styles.form}>
          <EmailField value={email} onChangeText={setEmail} error={fieldErrors.email} />
          <TextField
            label="Password"
            placeholder="Choose a password"
            value={password}
            onChangeText={setPassword}
            error={fieldErrors.password}
            secure
            autoCapitalize="none"
            autoComplete="new-password"
          />
          {failure !== undefined ? (
            <Text variant="error" accessibilityRole="alert">
              {failure}
            </Text>
          ) : null}
          <Button
            variant="deep"
            label="Create account"
            loading={running}
            onPress={() => void submit()}
          />
        </View>
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
});
