import { Pressable, StyleSheet, View } from "react-native";

import { actionCardStyle } from "@/components/action-card-style";
import { Icon, type IconName } from "@/components/icon";
import { Text } from "@/components/text";
import { colors, size, spacing, strokeWidth } from "@/constants/theme";

// INFO: with `selected` the card is a radio row (practice-focus.html) and has no action label;
// without it, it is the button Home draws for Continue.
export function ActionCard({
  title,
  meta,
  icon,
  action,
  selected,
  onPress,
}: {
  title: string;
  meta: string;
  icon: IconName;
  action?: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const isRadio = selected !== undefined;
  return (
    <Pressable
      accessibilityRole={isRadio ? "radio" : "button"}
      accessibilityLabel={title}
      accessibilityState={isRadio ? { selected } : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        actionCardStyle({ selected: selected === true, pressed }).card,
        styles.card,
      ]}
    >
      <View
        style={actionCardStyle({ selected: selected === true, pressed: false }).iconBox}
        testID="action-card-icon-box"
      >
        <Icon name={icon} color={colors.accent} size={size.iconBadge} />
      </View>
      <View style={styles.texts}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption">{meta}</Text>
      </View>
      {action === undefined ? null : <Text variant="footerLink">{action}</Text>}
      {isRadio ? (
        <View
          style={actionCardStyle({ selected, pressed: false }).radio}
          testID="action-card-radio"
        >
          {selected ? (
            <Icon
              name="check"
              color={colors.text}
              size={size.iconTiny}
              strokeWidth={strokeWidth.badge}
            />
          ) : null}
        </View>
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
  texts: { flex: 1, gap: spacing.hair },
});
