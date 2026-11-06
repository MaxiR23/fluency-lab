import type { SessionWeek } from "@fluency-lab/shared";
import { StyleSheet, View } from "react-native";

import { Icon } from "@/components/icon";
import { selectableStyle } from "@/components/selectable-style";
import { Text } from "@/components/text";
import { dayCircleStyle, dayLetterVariant } from "@/components/week-strip-style";
import { colors, size, spacing, strokeWidth } from "@/constants/theme";
import { weekStrip } from "@/utils/week-strip";

export function WeekStrip({ week }: { week: SessionWeek }) {
  const { days, countLabel } = weekStrip(week);
  return (
    <View style={[selectableStyle({ selected: false }), styles.card]}>
      <View style={styles.header}>
        <Text variant="label">This week</Text>
        <Text variant="labelStrong">{countLabel}</Text>
      </View>
      <View style={styles.row}>
        {days.map((cell) => (
          <View key={cell.date} style={styles.day} accessible accessibilityLabel={cell.label}>
            <View style={dayCircleStyle(cell)}>
              {cell.practiced ? (
                <Icon
                  name="check"
                  color={colors.text}
                  size={size.iconCheck}
                  strokeWidth={strokeWidth.check}
                />
              ) : null}
            </View>
            <Text variant={dayLetterVariant(cell)}>{cell.letter}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.group,
    marginHorizontal: spacing.screenSide,
    paddingVertical: spacing.card,
    paddingHorizontal: spacing.md,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  day: { alignItems: "center", gap: spacing.stack },
});
