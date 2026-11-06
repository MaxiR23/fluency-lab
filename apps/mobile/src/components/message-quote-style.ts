import type { ViewStyle } from "react-native";

import { colors, radius, spacing } from "@/constants/theme";

export function messageQuoteStyle(): { quote: ViewStyle } {
  return {
    quote: {
      gap: spacing.tight,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.cluster,
      borderRadius: radius.badge,
      backgroundColor: colors.quoteSurface,
    },
  };
}
