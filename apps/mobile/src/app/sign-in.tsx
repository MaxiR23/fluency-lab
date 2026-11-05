import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { apple, auth } from "@/auth";
import type { AuthOutcome, ProfileName } from "@/auth/auth-port";
import { AppleButton } from "@/components/apple-button";
import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/button";
import { Divider } from "@/components/divider";
import { EmailField } from "@/components/email-field";
import { FailureMessage } from "@/components/failure-message";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { TextLink } from "@/components/text-link";
import { spacing } from "@/constants/theme";
import { useSession } from "@/hooks/use-session";
import { showsAppleSignIn } from "@/utils/apple-sign-in";
import {
  hasFieldErrors,
  normalizeEmail,
  validateCredentials,
  type FieldErrors,
} from "@/utils/auth-form";
import {
  appleNameFailureMessage,
  appleSignInView,
  authFailureView,
  type FailureView,
} from "@/utils/auth-message";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const session = useSession();
  const [busy, setBusy] = useState<"email" | "apple" | null>(null);
  const running = busy !== null;
  const [availability, setAvailability] = useState<AuthOutcome<boolean> | undefined>(undefined);
  const [nameFailure, setNameFailure] = useState<
    { message: string; name: ProfileName } | undefined
  >(undefined);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<FailureView | undefined>(undefined);

  // INFO: the port never rejects; a failed check is a typed value that hides the button.
  useEffect(() => {
    void apple.isAvailable().then(setAvailability);
  }, []);
  const showApple = showsAppleSignIn(Platform.OS, availability);

  async function continueWithApple() {
    setFailure(undefined);
    setBusy("apple");
    const outcome = await session.signInWithApple();
    setBusy(null);
    const view = appleSignInView(outcome);
    if (view.kind === "message") setFailure({ message: view.message, cause: view.cause });
    if (view.kind === "name_not_saved") setNameFailure({ message: view.message, name: view.name });
  }

  async function retryName(name: ProfileName) {
    setBusy("apple");
    const outcome = await session.retryAppleName(name);
    setBusy(null);
    if (!outcome.ok) {
      setNameFailure({ message: appleNameFailureMessage(outcome.failure), name });
    }
  }

  function continueWithoutName() {
    setNameFailure(undefined);
    session.releaseApple();
  }

  async function submit() {
    const errors = validateCredentials({ email, password });
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) return;
    setFailure(undefined);
    setBusy("email");
    const outcome = await auth.signInWithEmail({ email: normalizeEmail(email), password });
    setBusy(null);
    if (!outcome.ok) setFailure(authFailureView(outcome));
  }

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Practice English by writing, at your own pace."
      footer={
        nameFailure !== undefined
          ? undefined
          : {
              prompt: "New here?",
              linkLabel: "Create an account",
              onPress: () => router.push("/create-account"),
              disabled: running,
            }
      }
    >
      {nameFailure !== undefined ? (
        <View style={styles.form}>
          <Text variant="error" accessibilityRole="alert">
            {nameFailure.message}
          </Text>
          <Button
            variant="deep"
            label="Try again"
            loading={running}
            onPress={() => void retryName(nameFailure.name)}
          />
          <Button
            variant="secondary"
            label="Continue"
            disabled={running}
            onPress={continueWithoutName}
          />
        </View>
      ) : (
        <>
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
              <FailureMessage message={failure.message} cause={failure.cause} />
            ) : null}
            <Button
              variant="deep"
              label="Sign in"
              loading={busy === "email"}
              disabled={busy === "apple"}
              onPress={() => void submit()}
            />
          </View>
          {showApple ? (
            <>
              <Divider label="or" />
              <View testID="sign-in-providers" style={styles.providers}>
                <AppleButton disabled={running} onPress={() => void continueWithApple()} />
              </View>
            </>
          ) : null}
        </>
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  passwordBlock: { gap: spacing.sm },
  forgot: { alignSelf: "flex-end", paddingVertical: spacing.linkVertical },
  providers: { gap: spacing.group },
});
