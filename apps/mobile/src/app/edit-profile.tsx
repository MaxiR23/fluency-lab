import { router, Stack, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { FailureMessage } from "@/components/failure-message";
import { GoalStepFields } from "@/components/goal-step-fields";
import { OfflineCard } from "@/components/offline-card";
import { LevelStepFields } from "@/components/level-step-fields";
import { Screen } from "@/components/screen";
import { SegmentedControl } from "@/components/segmented-control";
import { StepScreen } from "@/components/step-screen";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { TextLink } from "@/components/text-link";
import { TopicStepFields } from "@/components/topic-step-fields";
import { colors, spacing } from "@/constants/theme";
import { useOfflineMotion } from "@/hooks/use-offline-motion";
import { useProfileEdit } from "@/hooks/use-profile-edit";
import { dataFailureMessage } from "@/utils/data-message";
import { loadFailureView } from "@/utils/load-failure";
import { monthlyLimitNote, providerOptions } from "@/utils/onboarding-options";
import { canSaveEdit, editField, editTitle, type EditField } from "@/utils/profile-edit";

export default function EditProfile() {
  const { field: param } = useLocalSearchParams<{ field?: string }>();
  const field = editField(param);
  if (field === null) {
    return (
      <Screen>
        <View style={styles.failure}>
          <FailureMessage message={dataFailureMessage("not_found")} />
          <TextLink variant="footerLink" label="Back" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }
  return <EditScreen field={field} />;
}

function EditScreen({ field }: { field: EditField }) {
  const { state, change, save, retry } = useProfileEdit(field);
  const motion = useOfflineMotion();

  if (state.kind === "loading") {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} testID="edit-loading" />
        </View>
      </Screen>
    );
  }
  if (state.kind === "failed") {
    // INFO: a profile that could not be read on the network draws the can't-connect card under the title; any other failure keeps its red text.
    const offline = loadFailureView("edit-profile", state);
    if (offline.kind === "offline_card") {
      return (
        <StepScreen title={editTitle(field)} onBack={() => router.back()} footer={null}>
          <OfflineCard
            title={offline.title}
            retrying={offline.retrying}
            onRetry={() => void retry()}
            motion={motion}
          />
        </StepScreen>
      );
    }
    return (
      <Screen>
        <View style={styles.failure}>
          <FailureMessage message={dataFailureMessage(state.failure)} />
          <Button variant="deep" label="Try again" onPress={() => void retry()} />
          <TextLink variant="footerLink" label="Back" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const { draft, errors, saving, saveFailure } = state;
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: !saving }} />
      <StepScreen
        title={editTitle(field)}
        onBack={() => router.back()}
        backDisabled={saving}
        footer={
          <>
            {saveFailure === null ? null : <FailureMessage message={saveFailure} />}
            <Button
              variant="deep"
              label="Save"
              loading={saving}
              disabled={!canSaveEdit(field, draft)}
              onPress={() => void save()}
            />
          </>
        }
      >
        {field === "name" ? (
          <TextField
            label="Name"
            value={draft.name}
            onChangeText={(name) => change({ type: "name_changed", name })}
            error={errors.name}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
          />
        ) : null}
        {field === "limit" ? (
          <View style={styles.field}>
            <TextField
              label="Monthly limit (USD)"
              value={draft.limit}
              onChangeText={(limit) => change({ type: "limit_changed", limit })}
              error={errors.limit}
              keyboardType="decimal-pad"
            />
            <Text variant="caption">{monthlyLimitNote}</Text>
          </View>
        ) : null}
        {field === "provider" ? (
          <SegmentedControl
            label="Provider"
            options={providerOptions}
            value={draft.provider}
            onChange={(provider) => change({ type: "provider_picked", provider })}
          />
        ) : null}
        {field === "level" ? (
          <LevelStepFields
            value={draft.level}
            onChange={(level) => change({ type: "level_picked", level })}
          />
        ) : null}
        {field === "goals" ? (
          <GoalStepFields
            value={draft.goals}
            onToggle={(goal) => change({ type: "goal_toggled", goal })}
          />
        ) : null}
        {field === "topics" ? (
          <TopicStepFields
            value={draft.topics}
            onToggle={(topic) => change({ type: "topic_toggled", topic })}
          />
        ) : null}
      </StepScreen>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  failure: { padding: spacing.screenSide, gap: spacing.lg },
  field: { gap: spacing.sm },
});
