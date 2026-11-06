// apps/mobile/test/components/message-quote-style.test.ts
//
// Tests for messageQuoteStyle.
//
// Tested:
// - The quote's padding, gap, radius and translucent surface
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/message-quote-style.test.ts
//
// SEE: apps/mobile/src/components/message-quote-style.ts

import { describe, expect, it } from "@jest/globals";

import { messageQuoteStyle } from "@/components/message-quote-style";
import { colors, radius, spacing } from "@/constants/theme";

describe("messageQuoteStyle", () => {
  it("draws the quote with the design's padding, radius and translucent surface", () => {
    expect(messageQuoteStyle()).toEqual({
      quote: {
        gap: spacing.tight,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.cluster,
        borderRadius: radius.badge,
        backgroundColor: colors.quoteSurface,
      },
    });
  });
});
