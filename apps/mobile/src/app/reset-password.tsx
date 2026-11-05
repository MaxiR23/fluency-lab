import { router, useLocalSearchParams, usePreventRemove } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/button";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { spacing } from "@/constants/theme";
import { useSession } from "@/hooks/use-session";
import {
  hasFieldErrors,
  readEmailParam,
  validateResetConfirm,
  type FieldErrors,
} from "@/utils/auth-form";
import {
  blocksResetExit,
  missingResetEmailMessage,
  resetCodeSentMessage,
  resetFailureView,
  type ResetFailureAction,
} from "@/utils/auth-message";

export default function ResetPassword() {
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const email = readEmailParam(params.email);
  const session = useSession();
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [running, setRunning] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | undefined>(undefined);
  const [action, setAction] = useState<ResetFailureAction>("retry");

  function requestCode() {
    router.replace(
      email === null
        ? { pathname: "/forgot-password" }
        : { pathname: "/forgot-password", params: { email } },
    );
  }

  async function submit() {
    if (email === null) return;
    const errors = validateResetConfirm({ code, newPassword });
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) return;
    setFailure(undefined);
    setRunning(true);
    const outcome = await session.confirmPasswordReset({ email, code: code.trim(), newPassword });
    setRunning(false);
    if (!outcome.ok) {
      const view = resetFailureView(outcome);
      setFailure(view.message);
      setAction(view.action);
    }
  }

  usePreventRemove(blocksResetExit(running, action), () => {});

  const showForm = email !== null && action === "retry";

  return (
    <AuthScreen
      title="Enter your code"
      subtitle={email === null ? missingResetEmailMessage : resetCodeSentMessage(email)}
      footer={
        action === "continue"
          ? undefined
          : {
              prompt: "No code?",
              linkLabel: "Request a new code",
              onPress: requestCode,
              disabled: running,
            }
      }
    >
      {email === null ? (
        <Button variant="deep" label="Request a code" onPress={requestCode} />
      ) : showForm ? (
        <View style={styles.form}>
          <TextField
            label="Code"
            value={code}
            onChangeText={setCode}
            error={fieldErrors.code}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
          />
          <TextField
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
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
            label="Set new password"
            loading={running}
            onPress={() => void submit()}
          />
        </View>
      ) : (
        <View style={styles.form}>
          <Text variant="error" accessibilityRole="alert">
            {failure}
          </Text>
          {action === "continue" ? (
            <Button variant="deep" label="Continue" onPress={session.releaseReset} />
          ) : (
            <Button variant="deep" label="Request a new code" onPress={requestCode} />
          )}
        </View>
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
});
