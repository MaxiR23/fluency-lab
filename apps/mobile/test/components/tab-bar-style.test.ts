// apps/mobile/test/components/tab-bar-style.test.ts
//
// Tests for the tab bar style.
//
// Tested:
// - tabBarStyle pads the bottom with the larger of the inset and the design's 28
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/tab-bar-style.test.ts
//
// SEE: apps/mobile/src/components/tab-bar-style.ts

import { describe, expect, it } from "@jest/globals";

import { tabBarStyle } from "@/components/tab-bar-style";
import { borderWidth, colors, spacing } from "@/constants/theme";

describe("tabBarStyle", () => {
  it("pads the bottom by 28 with no inset", () => {
    expect(tabBarStyle(0).paddingBottom).toBe(spacing.tabBarBottom);
  });

  it("pads the bottom by the inset when it is larger than 28", () => {
    expect(tabBarStyle(34).paddingBottom).toBe(34);
  });

  it("pads the bottom by 28 when the inset is 28", () => {
    expect(tabBarStyle(28).paddingBottom).toBe(28);
  });

  it("takes the top, the sides and the border from tokens", () => {
    expect(tabBarStyle(0)).toMatchObject({
      paddingTop: spacing.cluster,
      paddingHorizontal: spacing.group,
      backgroundColor: colors.background,
      borderTopWidth: borderWidth.thin,
      borderTopColor: colors.border,
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
    });
  });
});
