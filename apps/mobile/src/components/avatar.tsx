import { StyleSheet, View } from "react-native";

import { Icon } from "@/components/icon";
import { Text } from "@/components/text";
import { borderWidth, colors, radius, size } from "@/constants/theme";

export function Avatar({ initial }: { initial: string | null }) {
  return (
    <View
      style={styles.avatar}
      testID="avatar"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {initial === null ? (
        <Icon name="person" color={colors.accent} size={size.iconBadge} />
      ) : (
        <Text variant="avatar">{initial}</Text>
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
});
