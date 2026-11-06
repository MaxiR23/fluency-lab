import type { ViewStyle } from "react-native";

import { borderWidth, colors, radius, shadow, spacing } from "@/constants/theme";
import { tabBarLayout } from "@/utils/tab-bar";

export function tabBarStyle(bottomInset: number): ViewStyle {
  return {
    position: "absolute",
    left: spacing.tabBarSide,
    right: spacing.tabBarSide,
    bottom: tabBarLayout(bottomInset).bottom,
    padding: spacing.stack,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceFloating,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    ...shadow.tabBar,
  };
}

// INFO: the row is the bar's content box, so the design's 6 from the edge is the bar's padding
// and the 0s here are positions in the row.
export function tabPillStyle(width: number, jumpTo: number | null): ViewStyle {
  return {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width,
    borderRadius: radius.pill,
    backgroundColor: colors.accentLine,
    borderWidth: borderWidth.thin,
    borderColor: colors.accentPressed,
    ...shadow.pillGlow,
    ...(jumpTo === null ? null : { transform: [{ translateX: jumpTo }] }),
  };
}
