import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, size, strokeWidth } from "@/constants/theme";

export function CheckIcon() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size.icon} height={size.icon} viewBox="0 0 24 24" fill="none">
        <Path
          d="M5 12.5l4.5 4.5L19 7.5"
          stroke={colors.accent}
          strokeWidth={strokeWidth.icon}
          strokeLinecap="round"
          strokeLinejoin="round"
          testID="check-icon"
        />
      </Svg>
    </View>
  );
}
