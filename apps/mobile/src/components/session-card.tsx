import { Pressable, StyleSheet, View } from "react-native";

import { Icon, type IconName } from "@/components/icon";
import { selectableStyle } from "@/components/selectable-style";
import { Tag } from "@/components/tag";
import { Text } from "@/components/text";
import { colors, radius, size, spacing, strokeWidth } from "@/constants/theme";

export function SessionCard({
  title,
  time,
  detail,
  icon,
  tag,
  chevron = false,
  titleAlign = "baseline",
  timePlacement = "title",
  iconSize = size.iconBadge,
  onPress,
}: {
  title: string;
  time: string | null;
  detail: string | null;
  icon: IconName;
  // INFO: the chat's type, drawn before the detail (chats-open-titles.html); History and Notes pass none.
  tag?: string;
  chevron?: boolean;
  titleAlign?: "baseline" | "start";
  // INFO: "end" puts the time after the texts, as the Notes rows of progress-notes.html do.
  timePlacement?: "title" | "end";
  iconSize?: number;
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
        <Icon name={icon} color={colors.accent} size={iconSize} />
      </View>
      <View style={[styles.texts, tag === undefined ? null : styles.textsTagged]}>
        <View style={[styles.titleRow, titleAlign === "start" && styles.titleRowStart]}>
          <Text variant="bodyStrong" numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          {time === null || timePlacement === "end" ? null : (
            <Text variant="why" style={styles.time}>
              {time}
            </Text>
          )}
        </View>
        {tag === undefined ? (
          detail === null ? null : (
            <Text variant="caption" numberOfLines={1}>
              {detail}
            </Text>
          )
        ) : (
          <View style={styles.tagRow}>
            <Tag variant="type" label={tag} />
            {detail === null ? null : (
              <Text variant="caption" numberOfLines={1} style={styles.title}>
                {detail}
              </Text>
            )}
          </View>
        )}
      </View>
      {time === null || timePlacement === "title" ? null : (
        <Text variant="why" style={styles.time}>
          {time}
        </Text>
      )}
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
  textsTagged: { gap: spacing.xs },
  tagRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minWidth: 0 },
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
