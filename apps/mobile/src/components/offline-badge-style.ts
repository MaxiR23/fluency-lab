import type { ViewStyle } from "react-native";

import { borderWidth, colors, radius, shadow, size, strokeWidth } from "@/constants/theme";

export type OfflineBadgeLook = "large" | "small";

export function offlineBadgeStyle(look: OfflineBadgeLook): {
  box: ViewStyle | null;
  ring: ViewStyle;
  badge: ViewStyle;
  icon: { size: number; strokeWidth: number };
} {
  const large = look === "large";
  const diameter = large ? size.cloudBadge : size.cloudBadgeSmall;
  return {
    box: large
      ? {
          width: size.cloudRing,
          height: size.cloudRing,
          alignItems: "center",
          justifyContent: "center",
        }
      : null,
    ring: {
      position: "absolute",
      width: size.cloudRing,
      height: size.cloudRing,
      borderRadius: radius.pill,
      borderWidth: borderWidth.thin,
      borderColor: colors.accentPressed,
    },
    badge: {
      width: diameter,
      height: diameter,
      borderRadius: radius.pill,
      backgroundColor: colors.accentDeep,
      borderColor: colors.accentLine,
      borderWidth: borderWidth.thin,
      alignItems: "center",
      justifyContent: "center",
      ...(large ? shadow.cloudGlow : {}),
    },
    icon: {
      size: large ? size.iconCloud : size.iconCloudSmall,
      strokeWidth: strokeWidth.cloud,
    },
  };
}
