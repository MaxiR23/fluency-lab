import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Icon, type IconName } from "@/components/icon";
import { selectableStyle } from "@/components/selectable-style";
import { Text } from "@/components/text";
import type { TextVariant } from "@/components/text-style";
import { colors, radius, size, spacing, strokeWidth } from "@/constants/theme";

// INFO: the card of an icon box, a title and a line of text, with an optional node at the top
// right. The suggestion cards and the Home tiles (Free chat, Pick a topic) share it.
export function IconCard({
  icon,
  title,
  text,
  topRight,
  textVariant = "why",
  accessibilityLabel,
  onPress,
  style,
}: {
  icon: IconName;
  title: string;
  text: string;
  topRight?: ReactNode;
  textVariant?: TextVariant;
  accessibilityLabel: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [selectableStyle({ selected: false, pressed }), styles.card, style]}
    >
      <View style={styles.top}>
        <View style={styles.iconBox}>
          <Icon
            name={icon}
            color={colors.accent}
            size={size.iconCard}
            strokeWidth={strokeWidth.icon}
          />
        </View>
        {topRight}
      </View>
      <Text variant="cardTitle">{title}</Text>
      <Text variant={textVariant}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.cluster, padding: spacing.card },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  iconBox: {
    width: size.badgeSmall,
    height: size.badgeSmall,
    borderRadius: radius.badgeSmall,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
