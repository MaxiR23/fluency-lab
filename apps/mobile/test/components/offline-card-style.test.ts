// apps/mobile/test/components/offline-card-style.test.ts
//
// Tests for offlineCardStyle, the layout of the inline can't-connect card.
//
// Tested:
// - The card of offline-inline.html and its title and copy
//
// What is covered:
// - Normal case
//
// Run with: pnpm exec jest apps/mobile/test/components/offline-card-style.test.ts
//
// SEE: apps/mobile/src/components/offline-card-style.ts

import { describe, expect, it } from "@jest/globals";

import { offlineCardStyle } from "@/components/offline-card-style";
import { borderWidth, colors, radius, spacing } from "@/constants/theme";

describe("offlineCardStyle", () => {
  it("draws the card of offline-inline.html: surface, border, radius 22, 28 by 20 padding, 14 gap, centered", () => {
    expect(offlineCardStyle().card).toEqual({
      alignItems: "center",
      gap: spacing.card,
      paddingVertical: spacing.panel,
      paddingHorizontal: spacing.screenSide,
      borderRadius: radius.hero,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: borderWidth.thin,
    });
  });

  it("places the card 8 under the header with 20 at the sides", () => {
    expect(offlineCardStyle().slot).toEqual({
      paddingHorizontal: spacing.screenSide,
      paddingTop: spacing.sm,
    });
  });

  it("stacks the title and copy 6 apart, centered", () => {
    expect(offlineCardStyle().texts).toEqual({ gap: spacing.stack, alignItems: "center" });
    expect(offlineCardStyle().centered).toEqual({ textAlign: "center" });
  });
});
