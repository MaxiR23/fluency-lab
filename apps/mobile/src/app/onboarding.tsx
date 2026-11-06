import { TOPICS } from "@fluency-lab/shared";
import { useReducer, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Chip } from "@/components/chip";
import { FailureMessage } from "@/components/failure-message";
import { OptionCard } from "@/components/option-card";
import { Screen } from "@/components/screen";
import { SegmentedControl } from "@/components/segmented-control";
import { StepScreen } from "@/components/step-screen";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { TextLink } from "@/components/text-link";
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
  selectedCountLabel,
  showsBack,
  validateAiStep,
  type AiStepErrors,
} from "@/utils/onboarding-form";
import {
  apiKeyNote,
  goalOptions,
  levelOptions,
  monthlyLimitNote,
  ONBOARDING_STEPS,
  providerOptions,
  stepTitles,
} from "@/utils/onboarding-options";

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
        <View style={styles.list}>
          {levelOptions.map((option) => (
            <OptionCard
              key={option.id}
              role="radio"
              label={option.label}
              description={option.description}
              selected={draft.level === option.id}
              onPress={() => dispatch({ type: "level_picked", level: option.id })}
            />
          ))}
        </View>
      ) : null}
      {step === 2 ? (
        <View style={styles.list}>
          {goalOptions.map((option) => (
            <OptionCard
              key={option.id}
              role="checkbox"
              label={option.label}
              selected={draft.goals.includes(option.id)}
              onPress={() => dispatch({ type: "goal_toggled", goal: option.id })}
            />
          ))}
        </View>
      ) : null}
      {step === 3 ? (
        <View style={styles.list}>
          <Text variant="caption">{selectedCountLabel(draft.topics.length)}</Text>
          <View style={styles.chips}>
            {TOPICS.map((topic) => (
              <Chip
                key={topic.id}
                label={topic.label}
                selected={draft.topics.includes(topic.id)}
                onPress={() => dispatch({ type: "topic_toggled", topic: topic.id })}
              />
            ))}
          </View>
        </View>
      ) : null}
      {step === 4 ? (
        <View style={styles.list}>
          <SegmentedControl
            label="Provider"
            options={providerOptions}
            value={draft.provider}
            onChange={(provider) => dispatch({ type: "provider_picked", provider })}
          />
          <View style={styles.field}>
            <TextField
              label="API key"
              value={draft.apiKey}
              onChangeText={(apiKey) => dispatch({ type: "api_key_changed", apiKey })}
              error={errors.apiKey}
              secure
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
            />
            <Text variant="caption">{apiKeyNote}</Text>
          </View>
          <View style={styles.field}>
            <TextField
              label="Monthly limit (USD)"
              value={draft.monthlyLimit}
              onChangeText={(monthlyLimit) =>
                dispatch({ type: "monthly_limit_changed", monthlyLimit })
              }
              error={errors.monthlyLimit}
              keyboardType="decimal-pad"
            />
            <Text variant="caption">{monthlyLimitNote}</Text>
          </View>
        </View>
      ) : null}
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.screenSide, gap: spacing.md },
  list: { gap: spacing.group },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  field: { gap: spacing.sm },
  skip: { alignItems: "center" },
});
