// apps/mobile/test/components/chat-footer-style.test.ts
//
// Tests for the chat footer style.
//
// Tested:
// - chatFooterStyle pads the bottom with the larger of the inset and the design's 36
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/chat-footer-style.test.ts
//
// SEE: apps/mobile/src/components/chat-footer-style.ts

import { describe, expect, it } from "@jest/globals";

import { chatFooterStyle } from "@/components/chat-footer-style";
import { colors, spacing } from "@/constants/theme";

describe("chatFooterStyle", () => {
  it("pads the bottom by 36 with no inset", () => {
    expect(chatFooterStyle(0).paddingBottom).toBe(spacing.composerBottom);
  });

  it("pads the bottom by the inset when it is larger than 36", () => {
    expect(chatFooterStyle(48).paddingBottom).toBe(48);
  });

  it("pads the bottom by 36 when the inset is 36", () => {
    expect(chatFooterStyle(36).paddingBottom).toBe(36);
  });

  it("is opaque, on the screen background", () => {
    expect(chatFooterStyle(0).backgroundColor).toBe(colors.background);
  });
});
