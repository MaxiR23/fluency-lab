import type { ViewStyle } from "react-native";

import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

// INFO: the study note card of note-in-chat.html: a sunken card with an icon tile, the title and
// topic, then the preview lines; Saved to Notes sits below it in the bubble.
export function noteCardStyle(): {
  card: ViewStyle;
  top: ViewStyle;
  tile: ViewStyle;
  texts: ViewStyle;
  preview: ViewStyle;
  saved: ViewStyle;
} {
  return {
    card: {
      gap: spacing.cluster,
      padding: spacing.group,
      borderRadius: radius.note,
      backgroundColor: colors.surfaceSunken,
      borderColor: colors.border,
      borderWidth: borderWidth.thin,
    },
    top: { flexDirection: "row", alignItems: "center", gap: spacing.cluster },
    tile: {
      width: size.noteIcon,
      height: size.noteIcon,
      borderRadius: radius.noteIcon,
      backgroundColor: colors.accentTag,
      alignItems: "center",
      justifyContent: "center",
    },
    texts: { flex: 1, gap: spacing.tight },
    preview: { gap: spacing.stack },
    saved: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.stack,
      alignSelf: "flex-start",
    },
  };
}
