import type { ViewStyle } from "react-native";

import { borderWidth, colors, spacing } from "@/constants/theme";

export function tabBarStyle(bottomInset: number): ViewStyle {
  return {
    paddingTop: spacing.cluster,
    paddingHorizontal: spacing.group,
    paddingBottom: Math.max(bottomInset, spacing.tabBarBottom),
    backgroundColor: colors.background,
    borderTopWidth: borderWidth.thin,
    borderTopColor: colors.border,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  };
}
