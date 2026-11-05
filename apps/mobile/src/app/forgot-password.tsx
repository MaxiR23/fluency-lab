import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { auth } from "@/auth";
import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/button";
import { EmailField } from "@/components/email-field";
import { Text } from "@/components/text";
import { spacing } from "@/constants/theme";
import {
  hasFieldErrors,
  normalizeEmail,
  readEmailParam,
  validateResetRequest,
  type FieldErrors,
} from "@/utils/auth-form";
import { authFailureMessage } from "@/utils/auth-message";

export default function ForgotPassword() {
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const [email, setEmail] = useState(readEmailParam(params.email) ?? "");
  const [running, setRunning] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | undefined>(undefined);

  async function submit() {
    const errors = validateResetRequest({ email });
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) return;
    setFailure(undefined);
    setRunning(true);
    const outcome = await auth.requestPasswordReset(normalizeEmail(email));
    setRunning(false);
    if (outcome.ok) {
      router.push({ pathname: "/reset-password", params: { email: normalizeEmail(email) } });
    } else {
      setFailure(authFailureMessage(outcome.failure));
    }
  }

  return (
    <AuthScreen
      title="Reset your password"
      subtitle="We will email you a code."
      footer={{
        prompt: "Remembered it?",
        linkLabel: "Sign in",
        onPress: () => router.replace("/sign-in"),
        disabled: running,
      }}
    >
      <View style={styles.form}>
        <EmailField value={email} onChangeText={setEmail} error={fieldErrors.email} />
        {failure !== undefined ? (
          <Text variant="error" accessibilityRole="alert">
            {failure}
          </Text>
        ) : null}
        <Button variant="deep" label="Send code" loading={running} onPress={() => void submit()} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
});
