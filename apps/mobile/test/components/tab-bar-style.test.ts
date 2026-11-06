// apps/mobile/test/components/tab-bar-style.test.ts
//
// Tests for the tab bar style.
//
// Tested:
// - tabBarStyle floats the bar from tokens at tabBarLayout's bottom
// - tabPillStyle sizes the pill and draws the jump only when asked
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/tab-bar-style.test.ts
//
// SEE: apps/mobile/src/components/tab-bar-style.ts

import { describe, expect, it } from "@jest/globals";

import { tabBarStyle, tabPillStyle } from "@/components/tab-bar-style";
import { borderWidth, colors, radius, shadow, spacing } from "@/constants/theme";

describe("tabBarStyle", () => {
  it("floats the bar 40 from each side with the translucent surface, the border and the bar shadow", () => {
    expect(tabBarStyle(0)).toEqual({
      position: "absolute",
      left: spacing.tabBarSide,
      right: spacing.tabBarSide,
      bottom: 30,
      padding: spacing.stack,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceFloating,
      borderWidth: borderWidth.thin,
      borderColor: colors.border,
      ...shadow.tabBar,
    });
  });

  it("puts the bar on the bottom inset when it is larger than 30", () => {
    expect(tabBarStyle(34).bottom).toBe(34);
  });
});

describe("tabPillStyle", () => {
  it("sizes the pill to its tab with the accent fill, border and glow", () => {
    expect(tabPillStyle(100, null)).toEqual({
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      width: 100,
      borderRadius: radius.pill,
      backgroundColor: colors.accentLine,
      borderWidth: borderWidth.thin,
      borderColor: colors.accentPressed,
      ...shadow.pillGlow,
    });
    expect(tabPillStyle(100, null).transform).toBeUndefined();
  });

  it("draws the pill at the given offset when it jumps", () => {
    expect(tabPillStyle(100, 200).transform).toEqual([{ translateX: 200 }]);
  });

  it("gives the pill no width before the row is measured", () => {
    expect(tabPillStyle(0, null).width).toBe(0);
  });
});
