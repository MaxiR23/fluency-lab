import { StyleSheet, View } from "react-native";

import { Tag } from "@/components/tag";
import { Text } from "@/components/text";
import { borderWidth, colors, radius, spacing } from "@/constants/theme";

export function MistakeCard({
  rule,
  times,
  original,
  corrected,
}: {
  rule: string;
  times: string;
  original: string;
  corrected: string;
}) {
  return (
    <View testID="mistake-card" style={styles.card}>
      <View style={styles.header}>
        <Text variant="bodyStrong" style={styles.rule}>
          {rule}
        </Text>
        <Tag variant="count" label={times} />
      </View>
      <Text variant="correction">
        <Text variant="struck">{original}</Text>
        {" → "}
        {corrected}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    paddingVertical: spacing.card,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.thin,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: spacing.sm,
  },
  rule: { flexShrink: 1 },
});
