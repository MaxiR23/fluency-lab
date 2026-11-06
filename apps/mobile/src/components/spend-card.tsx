import { StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import { TextLink } from "@/components/text-link";
import { barWidth } from "@/utils/settings";
import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

export function SpendCard({
  spent,
  limitLine,
  fraction,
  resetLine,
  onEditLimit,
}: {
  spent: string;
  limitLine: string;
  fraction: number | null;
  resetLine: string;
  onEditLimit: () => void;
}) {
  return (
    <View testID="spend-card" style={styles.card}>
      <View style={styles.top}>
        <Text variant="label">Spent this month</Text>
        <TextLink variant="captionLinkStrong" label="Edit limit" onPress={onEditLimit} />
      </View>
      <View style={styles.amount}>
        <Text variant="title">{spent}</Text>
        <Text variant="muted">{limitLine}</Text>
      </View>
      {fraction === null ? null : (
        <View testID="spend-bar" style={styles.track}>
          <View testID="spend-fill" style={[styles.fill, { width: barWidth(fraction) }]} />
        </View>
      )}
      <Text variant="why">{resetLine}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.group,
    padding: spacing.md,
    borderRadius: radius.control,
    backgroundColor: colors.accentDeep,
    borderColor: colors.accentLine,
    borderWidth: borderWidth.thin,
  },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  amount: { flexDirection: "row", alignItems: "baseline", gap: spacing.stack },
  track: {
    height: size.spendBar,
    borderRadius: radius.pill,
    backgroundColor: colors.progressTrack,
    overflow: "hidden",
  },
  fill: {
    minWidth: size.spendBarMin,
    height: size.spendBar,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
});
