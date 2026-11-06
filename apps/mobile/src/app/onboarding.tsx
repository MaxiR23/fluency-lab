import { useReducer, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { AiStepFields } from "@/components/ai-step-fields";
import { Button } from "@/components/button";
import { FailureMessage } from "@/components/failure-message";
import { GoalStepFields } from "@/components/goal-step-fields";
import { LevelStepFields } from "@/components/level-step-fields";
import { Screen } from "@/components/screen";
import { SignOutButton } from "@/components/sign-out-button";
import { StepScreen } from "@/components/step-screen";
import { TextLink } from "@/components/text-link";
import { TopicStepFields } from "@/components/topic-step-fields";
import { colors, spacing } from "@/constants/theme";
import { useOnboarding } from "@/hooks/use-onboarding";
import { keys } from "@/keys";
import type { FailureCause } from "@/auth/auth-port";
import {
  dataFailureMessage,
  keyDeleteFailureMessage,
  keySaveFailureMessage,
} from "@/utils/data-message";
import { onboardingView } from "@/utils/onboarding-gate";
import {
  canContinue,
  initialOnboardingForm,
  normalizeApiKey,
  onboardingFormReducer,
  onboardingUpdate,
  showsBack,
  validateAiStep,
  type AiStepErrors,
} from "@/utils/onboarding-form";
import { ONBOARDING_STEPS, stepTitles } from "@/utils/onboarding-options";

type SaveFailure = { message: string; cause?: FailureCause };

export default function Onboarding() {
  const { gate, userId, retry } = useOnboarding();
  const view = onboardingView(userId, gate);

  if (view.kind === "loading") {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} testID="onboarding-loading" />
        </View>
      </Screen>
    );
  }
  if (view.kind === "failed") {
    return (
      <Screen>
        <View style={styles.content}>
          <FailureMessage message={dataFailureMessage(view.failure)} />
          <Button variant="deep" label="Try again" onPress={() => void retry()} />
          <SignOutButton />
        </View>
      </Screen>
    );
  }
  return <Steps />;
}

function Steps() {
  const { finish } = useOnboarding();
  const [form, dispatch] = useReducer(onboardingFormReducer, initialOnboardingForm);
  const [errors, setErrors] = useState<AiStepErrors>({});
  const [failure, setFailure] = useState<SaveFailure | undefined>(undefined);
  const [running, setRunning] = useState(false);
  const { step, draft } = form;

  async function complete(mode: "finish" | "skip") {
    setFailure(undefined);
    if (mode === "finish") {
      const found = validateAiStep(draft);
      setErrors(found);
      if (Object.keys(found).length > 0) return;
    } else {
      setErrors({});
    }
    setRunning(true);
    if (mode === "skip") {
      // INFO: a Finish that saved the key and then failed on the profile leaves it
      // stored; Skip must end with no key saved.
      const removed = await keys.deleteApiKey();
      if (!removed.ok) {
        setRunning(false);
        setFailure({ message: keyDeleteFailureMessage, cause: removed.cause });
        return;
      }
    } else {
      const saved = await keys.saveApiKey(normalizeApiKey(draft.apiKey));
      if (!saved.ok) {
        setRunning(false);
        setFailure({ message: keySaveFailureMessage, cause: saved.cause });
        return;
      }
    }
    // INFO: no navigation here: once the profile is completed the guard in the
    // root layout opens Home.
    const outcome = await finish(onboardingUpdate(draft, mode));
    setRunning(false);
    if (!outcome.ok) setFailure({ message: dataFailureMessage(outcome.failure) });
  }

  const footer =
    step < 4 ? (
      <Button
        variant="deep"
        label="Continue"
        disabled={!canContinue(step, draft)}
        onPress={() => dispatch({ type: "continued" })}
      />
    ) : (
      <>
        {failure === undefined ? null : (
          <FailureMessage message={failure.message} cause={failure.cause} />
        )}
        <Button
          variant="deep"
          label="Finish"
          loading={running}
          onPress={() => void complete("finish")}
        />
        <View style={styles.skip}>
          <TextLink
            variant="footerLink"
            label="Skip for now"
            disabled={running}
            onPress={() => void complete("skip")}
          />
        </View>
      </>
    );

  return (
    <StepScreen
      step={step}
      total={ONBOARDING_STEPS}
      title={stepTitles[step - 1] ?? ""}
      onBack={showsBack(step) ? () => dispatch({ type: "went_back" }) : undefined}
      backDisabled={running}
      footer={footer}
    >
      {step === 1 ? (
        <LevelStepFields
          value={draft.level}
          onChange={(level) => dispatch({ type: "level_picked", level })}
        />
      ) : null}
      {step === 2 ? (
        <GoalStepFields
          value={draft.goals}
          onToggle={(goal) => dispatch({ type: "goal_toggled", goal })}
        />
      ) : null}
      {step === 3 ? (
        <TopicStepFields
          value={draft.topics}
          onToggle={(topic) => dispatch({ type: "topic_toggled", topic })}
        />
      ) : null}
      {step === 4 ? (
        <AiStepFields
          provider={draft.provider}
          apiKey={draft.apiKey}
          monthlyLimit={draft.monthlyLimit}
          errors={errors}
          onProviderChange={(provider) => dispatch({ type: "provider_picked", provider })}
          onApiKeyChange={(apiKey) => dispatch({ type: "api_key_changed", apiKey })}
          onMonthlyLimitChange={(monthlyLimit) =>
            dispatch({ type: "monthly_limit_changed", monthlyLimit })
          }
        />
      ) : null}
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.screenSide, gap: spacing.md },
  skip: { alignItems: "center" },
});
