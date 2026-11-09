// apps/mobile/test/components/offline-screen-style.test.ts
//
// Tests for offlineScreenStyle, the layout of the full can't-connect screen.
//
// Tested:
// - The centered badge and copy, the footer with the buttons and the Sign out row
//
// What is covered:
// - Normal case
//
// Run with: pnpm exec jest apps/mobile/test/components/offline-screen-style.test.ts
//
// SEE: apps/mobile/src/components/offline-screen-style.ts

import { describe, expect, it } from "@jest/globals";

import { offlineScreenStyle } from "@/components/offline-screen-style";
import { size, spacing } from "@/constants/theme";

describe("offlineScreenStyle", () => {
  it("centers the badge and copy with a gap of 20 and 32 at the sides", () => {
    const style = offlineScreenStyle();
    expect(style.body).toEqual({
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.pageGap,
      paddingHorizontal: spacing.xl,
    });
    expect(style.texts).toEqual({ gap: spacing.sm });
    expect(style.centered).toEqual({ textAlign: "center" });
  });

  it("stacks the buttons 6 apart with 12, 20 and 36 around them", () => {
    expect(offlineScreenStyle().footer).toEqual({
      gap: spacing.stack,
      paddingTop: spacing.group,
      paddingHorizontal: spacing.screenSide,
      paddingBottom: spacing.composerBottom,
    });
  });

  it("draws Sign out 44 tall and centered", () => {
    expect(offlineScreenStyle().signOut).toEqual({
      minHeight: size.touch,
      alignItems: "center",
      justifyContent: "center",
    });
  });
});
