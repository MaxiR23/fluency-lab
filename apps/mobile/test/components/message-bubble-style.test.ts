// apps/mobile/test/components/message-bubble-style.test.ts
//
// Tests for messageBubbleStyle.
//
// Tested:
// - The row and bubble style per role
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
});
