import type { Correction } from "@fluency-lab/shared";
import { StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import { borderWidth, colors, radius, spacing } from "@/constants/theme";

export function ReviewCard({ correction }: { correction: Correction }) {
  return (
    <View testID="review-card" style={styles.card}>
      <Text variant="correction">
        <Text variant="struck">{correction.original}</Text>
        {" → "}
        {correction.corrected}
      </Text>
      {correction.rule === undefined ? null : <Text variant="why">{correction.rule}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
    paddingVertical: spacing.group,
    paddingHorizontal: spacing.card,
    borderRadius: radius.note,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.thin,
  },
});
