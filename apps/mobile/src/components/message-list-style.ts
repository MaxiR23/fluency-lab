import type { ViewStyle } from "react-native";

import { spacing } from "@/constants/theme";

export type MessageListLayout = "chat" | "thread";

// INFO: the thread (correction-thread.html) packs the list at the bottom with a 12 gap and 16 all
// round; the chat keeps its 14 gap and 20 above and below.
export function messageListContentStyle(layout: MessageListLayout): ViewStyle {
  if (layout === "thread") {
    return {
      gap: spacing.group,
      padding: spacing.md,
      flexGrow: 1,
      justifyContent: "flex-end",
    };
  }
  return {
    gap: spacing.card,
    paddingVertical: spacing.screenSide,
    paddingHorizontal: spacing.md,
  };
}
