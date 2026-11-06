import { StyleSheet, View } from "react-native";

import { progressSegments, segmentStyle } from "@/components/step-progress-style";
import { Text } from "@/components/text";
import { spacing } from "@/constants/theme";
import { stepLabel } from "@/utils/onboarding-form";

export function StepProgress({ step, total }: { step: number; total: number }) {
  return (
    <View style={styles.block}>
      <Text variant="label">{stepLabel(step)}</Text>
      <View style={styles.bar}>
        {progressSegments(step, total).map((filled, index) => (
          <View key={index} style={segmentStyle(filled)} testID="progress-segment" />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  bar: { flexDirection: "row", gap: spacing.xs },
});
