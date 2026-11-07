// apps/mobile/test/components/score-ring-style.test.ts
//
// Tests for scoreRingStyle.
//
// Tested:
// - The small ring of home.html and the large ring of practice-result.html
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/score-ring-style.test.ts
//
// SEE: apps/mobile/src/components/score-ring-style.ts

import { describe, expect, it } from "@jest/globals";

import { scoreRingStyle } from "@/components/score-ring-style";
import { colors, radius, size, strokeWidth } from "@/constants/theme";

describe("scoreRingStyle", () => {
  it("draws the small ring 64 wide with a radius of 28 and a stroke of 6", () => {
    const style = scoreRingStyle("small");
    expect(style).toMatchObject({
      diameter: size.ringSmall,
      radius: size.ringSmallRadius,
      strokeWidth: strokeWidth.ringSmall,
      track: colors.accentLine,
      progress: colors.accent,
      count: "ringCount",
    });
    expect(style.box).toEqual({ width: size.ringSmall, height: size.ringSmall });
  });

  it("draws the large ring 128 wide with a radius of 56 and a stroke of 10", () => {
    const style = scoreRingStyle("large");
    expect(style).toMatchObject({
      diameter: size.ringLarge,
      radius: size.ringLargeRadius,
      strokeWidth: strokeWidth.ringLarge,
      count: "score",
    });
    expect(style.box).toEqual({
      width: size.ringLarge,
      height: size.ringLarge,
      borderRadius: radius.pill,
    });
  });

  it("puts the sparks at the corners the design names", () => {
    const { sparks } = scoreRingStyle("large");
    expect(sparks).toHaveLength(3);
    expect(sparks[0]).toMatchObject({ width: size.sparkLarge, height: size.sparkLarge });
    expect(sparks[1]).toMatchObject({ width: size.sparkMedium });
    expect(sparks[2]).toMatchObject({ width: size.sparkSmall, top: 0 });
    for (const spark of sparks) {
      expect(spark).toMatchObject({ position: "absolute", backgroundColor: colors.accent });
    }
  });
});
