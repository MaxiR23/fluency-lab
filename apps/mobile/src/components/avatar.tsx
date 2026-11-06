import { StyleSheet, View } from "react-native";

import { Icon } from "@/components/icon";
import { Text } from "@/components/text";
import { borderWidth, colors, radius, shadow, size } from "@/constants/theme";

export function Avatar({
  initial,
  size: avatarSize = "small",
}: {
  initial: string | null;
  size?: "small" | "large";
}) {
  const large = avatarSize === "large";
  return (
    <View
      style={large ? [styles.avatar, styles.large] : styles.avatar}
      testID="avatar"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {initial === null ? (
        <Icon name="person" color={colors.accent} size={size.iconBadge} />
      ) : (
        <Text variant={large ? "avatarLarge" : "avatar"}>{initial}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: size.avatar,
    height: size.avatar,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.thin,
    alignItems: "center",
    justifyContent: "center",
  },
  large: {
    width: size.avatarLarge,
    height: size.avatarLarge,
    backgroundColor: colors.surfaceSunken,
    ...shadow.avatarGlow,
  },
});
