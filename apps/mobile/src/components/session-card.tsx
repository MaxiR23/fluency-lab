import { Pressable, StyleSheet, View } from "react-native";

import { Icon, type IconName } from "@/components/icon";
import { selectableStyle } from "@/components/selectable-style";
import { Text } from "@/components/text";
import { colors, radius, size, spacing, strokeWidth } from "@/constants/theme";

export function SessionCard({
  title,
  time,
  detail,
  icon,
  chevron = false,
  titleAlign = "baseline",
  onPress,
}: {
  title: string;
  time: string | null;
  detail: string | null;
  icon: IconName;
  chevron?: boolean;
  titleAlign?: "baseline" | "start";
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [selectableStyle({ selected: false, pressed }), styles.card]}
    >
      <View style={styles.iconBox}>
        <Icon name={icon} color={colors.accent} size={size.iconBadge} />
      </View>
      <View style={styles.texts}>
        <View style={[styles.titleRow, titleAlign === "start" && styles.titleRowStart]}>
          <Text variant="bodyStrong" numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          {time === null ? null : (
            <Text variant="why" style={styles.time}>
              {time}
            </Text>
          )}
        </View>
        {detail === null ? null : (
          <Text variant="caption" numberOfLines={1}>
            {detail}
          </Text>
        )}
      </View>
      {chevron ? (
        <Icon
          name="chevron"
          color={colors.textPlaceholder}
          size={size.iconCard}
          strokeWidth={strokeWidth.action}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.card,
    paddingHorizontal: spacing.md,
    gap: spacing.card,
  },
  iconBox: {
    width: size.badge,
    height: size.badge,
    borderRadius: radius.badge,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  texts: { flex: 1, gap: spacing.hair },
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  titleRowStart: { alignItems: "flex-start" },
  title: { flexShrink: 1 },
  time: { flexShrink: 0 },
});
