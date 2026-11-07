// apps/mobile/test/components/message-bubble-style.test.ts
//
// Tests for messageBubbleStyle.
//
// Tested:
// - The row and bubble style per role
// - A quoted bubble: the design's 8, 8, 12, 8 padding, the gap and the inset body
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/message-bubble-style.test.ts
//
// SEE: apps/mobile/src/components/message-bubble-style.ts

import { describe, expect, it } from "@jest/globals";

import { messageBubbleStyle } from "@/components/message-bubble-style";
import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

const common = {
  paddingVertical: spacing.group,
  paddingHorizontal: spacing.card,
  borderRadius: radius.message,
  borderWidth: borderWidth.thin,
};

describe("messageBubbleStyle", () => {
  it("puts the tutor bubble on the left on surface with the bottom-left tail", () => {
    expect(messageBubbleStyle("tutor")).toEqual({
      row: { alignSelf: "flex-start", maxWidth: size.messageMaxWidth },
      bubble: {
        ...common,
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderBottomLeftRadius: radius.messageTail,
      },
    });
  });

  it("puts the user bubble on the right on accent-deep with the bottom-right tail", () => {
    expect(messageBubbleStyle("user")).toEqual({
      row: { alignSelf: "flex-end", maxWidth: size.messageMaxWidth, gap: spacing.sm },
      bubble: {
        ...common,
        backgroundColor: colors.accentDeep,
        borderColor: colors.accentLine,
        borderBottomRightRadius: radius.messageTail,
      },
    });
  });

  it("caps both rows at 82%", () => {
    expect(messageBubbleStyle("tutor").row.maxWidth).toBe("82%");
    expect(messageBubbleStyle("user").row.maxWidth).toBe("82%");
  });

  it("a quoted bubble has the design's 8, 8, 12, 8 padding and an 8 gap", () => {
    const { bubble } = messageBubbleStyle("user", { quoted: true });
    expect(bubble.paddingTop).toBe(spacing.sm);
    expect(bubble.paddingHorizontal).toBe(spacing.sm);
    expect(bubble.paddingBottom).toBe(spacing.group);
    expect(bubble.gap).toBe(spacing.sm);
    expect(bubble.paddingVertical).toBeUndefined();
    expect(bubble.backgroundColor).toBe(colors.accentDeep);
    expect(bubble.borderRadius).toBe(radius.message);
  });

  it("the body of a quoted bubble is inset 6 so the text lines up with a plain bubble", () => {
    expect(messageBubbleStyle("user", { quoted: true }).body).toEqual({
      paddingHorizontal: spacing.stack,
    });
    expect(spacing.stack).toBe(6);
  });

  it("leaves the bubble as it was when quoted is false", () => {
    expect(messageBubbleStyle("user", { quoted: false })).toEqual(messageBubbleStyle("user"));
  });

  it("a tutor bubble with a note is 86% wide with a 10 gap between its text and the card", () => {
    const style = messageBubbleStyle("tutor", { note: true });
    expect(style.row).toEqual({ alignSelf: "flex-start", maxWidth: size.messageNoteMaxWidth });
    expect(style.row.maxWidth).toBe("86%");
    expect(style.bubble).toEqual({
      ...common,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderBottomLeftRadius: radius.messageTail,
      gap: spacing.cluster,
    });
  });

  it("plain bubbles keep their exact style objects", () => {
    expect(messageBubbleStyle("tutor", { note: false })).toEqual(messageBubbleStyle("tutor"));
    expect(messageBubbleStyle("tutor").bubble).not.toHaveProperty("gap");
  });
});
