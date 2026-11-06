// apps/mobile/test/utils/chat-keyboard.test.ts
//
// Tests for the chat keyboard layout.
//
// Tested:
// - chatKeyboardLayout: footer bottom padding and the offsets of the sticky view and the list
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/chat-keyboard.test.ts
//
// SEE: apps/mobile/src/utils/chat-keyboard.ts

import { describe, expect, it } from "@jest/globals";

import { spacing } from "@/constants/theme";
import { chatKeyboardLayout } from "@/utils/chat-keyboard";

describe("chatKeyboardLayout", () => {
  it("keeps the design's bottom padding with no inset", () => {
    expect(chatKeyboardLayout(0)).toEqual({ composerBottom: 36, stickyOffset: 18, listOffset: 24 });
  });

  it("keeps the design's bottom padding on an iPhone home indicator", () => {
    expect(chatKeyboardLayout(34)).toEqual({
      composerBottom: 36,
      stickyOffset: 18,
      listOffset: 24,
    });
  });

  it("keeps the design's bottom padding exactly at it", () => {
    expect(chatKeyboardLayout(36).composerBottom).toBe(36);
  });

  it("follows an inset one over the design's padding", () => {
    expect(chatKeyboardLayout(37)).toEqual({
      composerBottom: 37,
      stickyOffset: 19,
      listOffset: 25,
    });
  });

  it("clears a tall Android navigation bar", () => {
    expect(chatKeyboardLayout(48)).toEqual({
      composerBottom: 48,
      stickyOffset: 30,
      listOffset: 36,
    });
  });

  it("lifts the list 6 less than the footer", () => {
    const layout = chatKeyboardLayout(34);
    expect(layout.listOffset - layout.stickyOffset).toBe(
      spacing.screenSide + spacing.group - (spacing.md + spacing.cluster),
    );
  });
});
