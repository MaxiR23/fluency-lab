import { type ColorValue, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { size, strokeWidth } from "@/constants/theme";

export type IconName = "chat" | "home" | "progress" | "settings";

const paths: Record<IconName, string> = {
  chat: "M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12z",
  home: "M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z",
  progress: "M5 20V11M12 20V4M19 20v-6",
  settings: "M4 7h10M18 7h2M4 17h2M10 17h10M16 4v6M8 14v6",
};

export function Icon({ name, color }: { name: IconName; color: ColorValue }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size.icon} height={size.icon} viewBox="0 0 24 24" fill="none">
        <Path
          d={paths[name]}
          stroke={color}
          strokeWidth={strokeWidth.icon}
          strokeLinecap="round"
          strokeLinejoin="round"
          testID={`icon-${name}`}
        />
      </Svg>
    </View>
  );
}
