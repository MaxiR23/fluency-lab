import { Pressable, StyleSheet, View } from "react-native";

import { Icon, type IconName } from "@/components/icon";
import { selectableStyle } from "@/components/selectable-style";
import { Text } from "@/components/text";
import { colors, radius, size, spacing } from "@/constants/theme";

export function ActionCard({
  title,
  meta,
  icon,
  action,
  onPress,
}: {
  title: string;
  meta: string;
  icon: IconName;
  action: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [selectableStyle({ selected: false, pressed }), styles.card]}
    >
      <View style={styles.iconBox} testID="action-card-icon-box">
        <Icon name={icon} color={colors.accent} size={size.iconBadge} />
      </View>
      <View style={styles.texts}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption">{meta}</Text>
      </View>
      <Text variant="footerLink">{action}</Text>
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
});
