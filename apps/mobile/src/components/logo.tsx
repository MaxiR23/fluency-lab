import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Text } from "@/components/text";
import { borderWidth, colors, radius, size, spacing, strokeWidth } from "@/constants/theme";

export function Logo() {
  return (
    <View style={styles.row}>
      <View style={styles.badge} testID="logo-badge">
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Svg width={size.icon} height={size.icon} viewBox="0 0 24 24" fill="none">
            <Path
              d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12z"
              stroke={colors.accent}
              strokeWidth={strokeWidth.icon}
              strokeLinecap="round"
              strokeLinejoin="round"
              testID="logo-icon-path"
            />
          </Svg>
        </View>
      </View>
      <Text variant="brand">Fluency Lab</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.logoGap },
  badge: {
    width: size.badge,
    height: size.badge,
    borderRadius: radius.badge,
    backgroundColor: colors.accentDeep,
    borderColor: colors.accentLine,
    borderWidth: borderWidth.thin,
    alignItems: "center",
    justifyContent: "center",
  },
});
