import { StyleSheet, View } from "react-native";

import { Icon } from "@/components/icon";
import { borderWidth, colors, radius, shadow, size, strokeWidth } from "@/constants/theme";

export function DoneBadge() {
  return (
    <View
      testID="done-badge"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.badge}
    >
      <Icon name="check" color={colors.text} size={size.iconDone} strokeWidth={strokeWidth.done} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: size.doneBadge,
    height: size.doneBadge,
    borderRadius: radius.pill,
    backgroundColor: colors.accentLine,
    borderColor: colors.accentPressed,
    borderWidth: borderWidth.thin,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.doneGlow,
  },
});
