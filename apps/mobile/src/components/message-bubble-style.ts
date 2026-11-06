import type { ViewStyle } from "react-native";

import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

export type MessageRole = "tutor" | "user";

export function messageBubbleStyle(role: MessageRole): { row: ViewStyle; bubble: ViewStyle } {
  const common: ViewStyle = {
    paddingVertical: spacing.group,
    paddingHorizontal: spacing.card,
    borderRadius: radius.message,
    borderWidth: borderWidth.thin,
  };
  if (role === "tutor") {
    return {
      row: { alignSelf: "flex-start", maxWidth: size.messageMaxWidth },
      bubble: {
        ...common,
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderBottomLeftRadius: radius.messageTail,
      },
    };
  }
  return {
    row: { alignSelf: "flex-end", maxWidth: size.messageMaxWidth, gap: spacing.sm },
    bubble: {
      ...common,
      backgroundColor: colors.accentDeep,
      borderColor: colors.accentLine,
      borderBottomRightRadius: radius.messageTail,
    },
  };
}
