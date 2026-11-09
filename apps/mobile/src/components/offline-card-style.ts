import type { TextStyle, ViewStyle } from "react-native";

import { borderWidth, colors, radius, spacing } from "@/constants/theme";

export function offlineCardStyle(): {
  card: ViewStyle;
  slot: ViewStyle;
  texts: ViewStyle;
  centered: TextStyle;
} {
  return {
    card: {
      alignItems: "center",
      gap: spacing.card,
      paddingVertical: spacing.panel,
      paddingHorizontal: spacing.screenSide,
      borderRadius: radius.hero,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: borderWidth.thin,
    },
    // INFO: offline-inline.html's card sits 8 under the header with 20 at the sides.
    slot: { paddingHorizontal: spacing.screenSide, paddingTop: spacing.sm },
    texts: { gap: spacing.stack, alignItems: "center" },
    centered: { textAlign: "center" },
  };
}
