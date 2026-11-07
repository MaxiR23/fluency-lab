import type { ViewStyle } from "react-native";

import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

export type MessageRole = "tutor" | "user";

// INFO: body is only present for a quoted bubble: the quote sits inside the 8 point padding of
// chat-reply-sent.html, so the text gets a 6 point inset to keep its left edge where a plain
// bubble puts it.
export function messageBubbleStyle(
  role: MessageRole,
  options: { quoted?: boolean; note?: boolean } = {},
): { row: ViewStyle; bubble: ViewStyle; body?: ViewStyle } {
  const quoted = options.quoted === true;
  const padding: ViewStyle = quoted
    ? {
        paddingTop: spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingBottom: spacing.group,
        gap: spacing.sm,
      }
    : { paddingVertical: spacing.group, paddingHorizontal: spacing.card };
  const common: ViewStyle = {
    ...padding,
    borderRadius: radius.message,
    borderWidth: borderWidth.thin,
  };
  const body = quoted ? { body: { paddingHorizontal: spacing.stack } } : {};
  if (role === "tutor") {
    // INFO: a tutor bubble with a note card is wider and spaces the card from the text
    // (note-in-chat.html); plain bubbles keep their exact style.
    const note = options.note === true;
    return {
      ...body,
      row: {
        alignSelf: "flex-start",
        maxWidth: note ? size.messageNoteMaxWidth : size.messageMaxWidth,
      },
      bubble: {
        ...common,
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderBottomLeftRadius: radius.messageTail,
        ...(note ? { gap: spacing.cluster } : {}),
      },
    };
  }
  return {
    ...body,
    row: { alignSelf: "flex-end", maxWidth: size.messageMaxWidth, gap: spacing.sm },
    bubble: {
      ...common,
      backgroundColor: colors.accentDeep,
      borderColor: colors.accentLine,
      borderBottomRightRadius: radius.messageTail,
    },
  };
}
