import type { ViewStyle } from "react-native";

import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

export function replyPreviewStyle(): { card: ViewStyle; texts: ViewStyle; cancel: ViewStyle } {
  return {
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.cluster,
      marginHorizontal: spacing.md,
      paddingVertical: spacing.cluster,
      paddingRight: spacing.sm,
      paddingLeft: spacing.card,
      borderRadius: radius.control,
      borderWidth: borderWidth.thin,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    texts: { flex: 1, minWidth: 0, gap: spacing.tight },
    cancel: {
      width: size.touch,
      height: size.touch,
      alignItems: "center",
      justifyContent: "center",
    },
  };
}
