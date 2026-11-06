import type { Provider } from "@fluency-lab/shared";
import { router, Stack, useLocalSearchParams, useNavigation } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import type { FailureCause } from "@/auth/auth-port";
import { AiStepFields } from "@/components/ai-step-fields";
import { Button } from "@/components/button";
import { FailureMessage } from "@/components/failure-message";
import { StepScreen } from "@/components/step-screen";
import { TextLink } from "@/components/text-link";
import { useOnboarding } from "@/hooks/use-onboarding";
import { keys } from "@/keys";
import {
  dataFailureMessage,
  keyDeleteFailureMessage,
  keySaveFailureMessage,
} from "@/utils/data-message";
import { keyStepStart, removeKeyButtons, removeKeyPrompt } from "@/utils/key-step";
import {
  aiStepUpdate,
  normalizeApiKey,
  validateAiStep,
  type AiStepErrors,
} from "@/utils/onboarding-form";
import { stepTitles } from "@/utils/onboarding-options";

type SaveFailure = { message: string; cause?: FailureCause };

export default function ApiKey() {
  const { finish } = useOnboarding();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ provider?: string; limit?: string; removable?: string }>();
  const start = keyStepStart(params);
  const [provider, setProvider] = useState<Provider>(start.provider);
  const [apiKey, setApiKey] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState(start.monthlyLimit);
  const [errors, setErrors] = useState<AiStepErrors>({});
  const [failure, setFailure] = useState<SaveFailure | undefined>(undefined);
  const [running, setRunning] = useState(false);

  async function save() {
    setFailure(undefined);
    const found = validateAiStep({ apiKey, monthlyLimit }, "key");
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setRunning(true);
    // INFO: the profile goes first, so a profile failure leaves no key stored whose
    // provider was never recorded. finish also keeps the gate in sync. The key is
    // never passed to it.
    const outcome = await finish(aiStepUpdate({ provider, monthlyLimit }));
    if (!outcome.ok) {
      setRunning(false);
      setFailure({ message: dataFailureMessage(outcome.failure) });
      return;
    }
    const saved = await keys.saveApiKey(normalizeApiKey(apiKey));
    setRunning(false);
    if (!saved.ok) {
      setFailure({ message: keySaveFailureMessage, cause: saved.cause });
      return;
    }
    // INFO: if the user already left this screen during the save, back would pop Chat.
    if (navigation.isFocused()) router.back();
  }

  // INFO: only the key in secure storage is removed; the profile is not touched.
  async function remove() {
    setFailure(undefined);
    setRunning(true);
    const removed = await keys.deleteApiKey();
    setRunning(false);
    if (!removed.ok) {
      setFailure({ message: keyDeleteFailureMessage, cause: removed.cause });
      return;
    }
    if (navigation.isFocused()) router.back();
  }

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: !running }} />
      <StepScreen
        title={stepTitles[3] ?? ""}
        onBack={() => router.back()}
        backDisabled={running}
        footer={
          <>
            {failure === undefined ? null : (
              <FailureMessage message={failure.message} cause={failure.cause} />
            )}
            <Button variant="deep" label="Save" loading={running} onPress={() => void save()} />
            {start.removable ? (
              <View style={styles.remove}>
                <TextLink
                  variant="footerLink"
                  label="Remove key"
                  disabled={running}
                  onPress={() =>
                    Alert.alert(
                      removeKeyPrompt.title,
                      removeKeyPrompt.message,
                      removeKeyButtons(() => void remove()),
                    )
                  }
                />
              </View>
            ) : null}
          </>
        }
      >
        <AiStepFields
          provider={provider}
          apiKey={apiKey}
          monthlyLimit={monthlyLimit}
          errors={errors}
          onProviderChange={setProvider}
          onApiKeyChange={setApiKey}
          onMonthlyLimitChange={setMonthlyLimit}
        />
      </StepScreen>
    </>
  );
}

const styles = StyleSheet.create({
  remove: { alignItems: "center" },
});
