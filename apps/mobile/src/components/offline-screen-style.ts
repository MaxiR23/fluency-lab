import type { TextStyle, ViewStyle } from "react-native";

import { size, spacing } from "@/constants/theme";

export function offlineScreenStyle(): {
  body: ViewStyle;
  texts: ViewStyle;
  centered: TextStyle;
  footer: ViewStyle;
  signOut: ViewStyle;
} {
  return {
    body: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.pageGap,
      paddingHorizontal: spacing.xl,
    },
    texts: { gap: spacing.sm },
    centered: { textAlign: "center" },
    footer: {
      gap: spacing.stack,
      paddingTop: spacing.group,
      paddingHorizontal: spacing.screenSide,
      paddingBottom: spacing.composerBottom,
    },
    signOut: { minHeight: size.touch, alignItems: "center", justifyContent: "center" },
  };
}
