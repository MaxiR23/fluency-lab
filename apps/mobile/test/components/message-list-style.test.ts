// apps/mobile/test/components/message-list-style.test.ts
//
// Tests for the content style of the message list.
//
// Tested:
// - The chat layout keeps today's values
// - The thread layout is gap 12, 16 all round, grows and sits at the bottom
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/message-list-style.test.ts
//
// SEE: apps/mobile/src/components/message-list-style.ts

import { describe, expect, it } from "@jest/globals";

import { messageListContentStyle } from "@/components/message-list-style";
import { spacing } from "@/constants/theme";

describe("messageListContentStyle", () => {
  it("keeps the chat layout: gap 14, 20 above and below, 16 on the sides", () => {
    expect(messageListContentStyle("chat")).toEqual({
      gap: spacing.card,
      paddingVertical: spacing.screenSide,
      paddingHorizontal: spacing.md,
    });
    expect([spacing.card, spacing.screenSide, spacing.md]).toEqual([14, 20, 16]);
  });

  it("draws the thread layout: gap 12, 16 all round, growing, at the bottom", () => {
    expect(messageListContentStyle("thread")).toEqual({
      gap: spacing.group,
      padding: spacing.md,
      flexGrow: 1,
      justifyContent: "flex-end",
    });
    expect(spacing.group).toBe(12);
  });
});
