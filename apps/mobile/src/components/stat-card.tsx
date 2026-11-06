import { StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import { borderWidth, colors, radius, spacing } from "@/constants/theme";

export function StatCard({
  value,
  label,
  compact,
}: {
  value: string;
  label: string;
  compact?: boolean;
}) {
  return (
    <View testID="stat-card" style={compact === true ? [styles.card, styles.compact] : styles.card}>
      <Text variant={compact === true ? "statSmall" : "stat"}>{value}</Text>
      <Text variant="why">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: spacing.xs,
    padding: spacing.card,
    borderRadius: radius.badgeLarge,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.thin,
  },
  compact: { padding: spacing.group, borderRadius: radius.note },
});
