import { StyleSheet, View } from "react-native";

import { SegmentedProgress } from "@/components/segmented-progress";
import { progressSegments } from "@/components/step-progress-style";
import { Text } from "@/components/text";
import { spacing } from "@/constants/theme";
import { stepLabel } from "@/utils/onboarding-form";

export function StepProgress({ step, total }: { step: number; total: number }) {
  return (
    <View style={styles.block}>
      <Text variant="label">{stepLabel(step)}</Text>
      <SegmentedProgress
        segments={progressSegments(step, total).map((filled) => (filled ? "done" : "pending"))}
        look="step"
        label={stepLabel(step)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
});
