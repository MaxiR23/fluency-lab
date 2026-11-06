import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { auth } from "@/auth";
import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/button";
import { EmailField } from "@/components/email-field";
import { FailureMessage } from "@/components/failure-message";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { spacing } from "@/constants/theme";
import {
  hasFieldErrors,
  normalizeEmail,
  normalizeName,
  validateSignUp,
  type FieldErrors,
} from "@/utils/auth-form";
import { authFailureView, signUpPendingMessage, type FailureView } from "@/utils/auth-message";

export default function CreateAccount() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [running, setRunning] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<FailureView | undefined>(undefined);
  const [pending, setPending] = useState(false);

  async function submit() {
    const errors = validateSignUp({ name, email, password });
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) return;
    setFailure(undefined);
    setRunning(true);
    const outcome = await auth.signUpWithEmail({
      email: normalizeEmail(email),
      password,
      name: normalizeName(name),
    });
    setRunning(false);
    if (!outcome.ok) {
      setFailure(authFailureView(outcome));
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
          <TextField
            label="Name"
            placeholder="Your name"
            value={name}
            onChangeText={setName}
            error={fieldErrors.name}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
          />
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
            <FailureMessage message={failure.message} cause={failure.cause} />
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
