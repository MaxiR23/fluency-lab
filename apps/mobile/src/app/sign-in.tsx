import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { auth } from "@/auth";
import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/button";
import { Divider } from "@/components/divider";
import { EmailField } from "@/components/email-field";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { TextLink } from "@/components/text-link";
import { spacing } from "@/constants/theme";
import {
  hasFieldErrors,
  normalizeEmail,
  validateCredentials,
  type FieldErrors,
} from "@/utils/auth-form";
import { authFailureMessage } from "@/utils/auth-message";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [running, setRunning] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | undefined>(undefined);

  async function submit() {
    const errors = validateCredentials({ email, password });
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) return;
    setFailure(undefined);
    setRunning(true);
    const outcome = await auth.signInWithEmail({ email: normalizeEmail(email), password });
    setRunning(false);
    if (!outcome.ok) setFailure(authFailureMessage(outcome.failure));
  }

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Practice English by writing, at your own pace."
      footer={{
        prompt: "New here?",
        linkLabel: "Create an account",
        onPress: () => router.push("/create-account"),
        disabled: running,
      }}
    >
      <View style={styles.form}>
        <EmailField value={email} onChangeText={setEmail} error={fieldErrors.email} />
        <View style={styles.passwordBlock}>
          <TextField
            label="Password"
            placeholder="Your password"
            value={password}
            onChangeText={setPassword}
            error={fieldErrors.password}
            secure
            autoCapitalize="none"
            autoComplete="current-password"
          />
          <TextLink
            label="Forgot password?"
            style={styles.forgot}
            disabled={running}
            onPress={() => router.push("/forgot-password")}
          />
        </View>
        {failure !== undefined ? (
          <Text variant="error" accessibilityRole="alert">
            {failure}
          </Text>
        ) : null}
        <Button variant="deep" label="Sign in" loading={running} onPress={() => void submit()} />
      </View>
      <Divider label="or" />
      {/* INFO: the Apple button goes here when its issue lands; Google stays out until its own issue. */}
      <View testID="sign-in-providers" style={styles.providers} />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  passwordBlock: { gap: spacing.sm },
  forgot: { alignSelf: "flex-end", paddingVertical: spacing.linkVertical },
  providers: { gap: spacing.group },
});
