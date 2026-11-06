import type { Provider } from "@fluency-lab/shared";
import { router, Stack, useNavigation } from "expo-router";
import { useState } from "react";

import type { FailureCause } from "@/auth/auth-port";
import { AiStepFields } from "@/components/ai-step-fields";
import { Button } from "@/components/button";
import { FailureMessage } from "@/components/failure-message";
import { StepScreen } from "@/components/step-screen";
import { useOnboarding } from "@/hooks/use-onboarding";
import { keys } from "@/keys";
import { dataFailureMessage, keySaveFailureMessage } from "@/utils/data-message";
import {
  aiStepUpdate,
  normalizeApiKey,
  validateAiStep,
  type AiStepErrors,
} from "@/utils/onboarding-form";
import { DEFAULT_MONTHLY_LIMIT, stepTitles } from "@/utils/onboarding-options";

type SaveFailure = { message: string; cause?: FailureCause };

export default function ApiKey() {
  const { finish } = useOnboarding();
  const navigation = useNavigation();
  const [provider, setProvider] = useState<Provider>("claude");
  const [apiKey, setApiKey] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState(DEFAULT_MONTHLY_LIMIT);
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
