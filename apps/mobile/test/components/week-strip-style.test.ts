// apps/mobile/test/components/week-strip-style.test.ts
//
// Tests for the style functions of the week strip.
//
// Tested:
// - dayCircleStyle for a practiced, an empty, a today and a future day
// - dayLetterVariant for today and the other days
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/week-strip-style.test.ts
//
// SEE: apps/mobile/src/components/week-strip-style.ts

import { describe, expect, it } from "@jest/globals";

import { dayCircleStyle, dayLetterVariant } from "@/components/week-strip-style";
import { borderWidth, colors, radius, shadow, size } from "@/constants/theme";
import type { DayCell } from "@/utils/week-strip";

function cell(overrides: Partial<DayCell>): DayCell {
  return {
    date: "2026-11-03",
    letter: "T",
    label: "Tuesday, not practiced",
    practiced: false,
    perfect: false,
    isToday: false,
    isFuture: false,
    ...overrides,
  };
}

describe("dayCircleStyle", () => {
  it("fills a practiced day with the line color and the pressed border", () => {
    expect(dayCircleStyle(cell({ practiced: true }))).toMatchObject({
      width: size.dayCircle,
      height: size.dayCircle,
      borderRadius: radius.pill,
      borderWidth: borderWidth.thin,
      backgroundColor: colors.accentLine,
      borderColor: colors.accentPressed,
    });
  });

  it("draws a past day without a session on the sunken surface with a solid border", () => {
    const style = dayCircleStyle(cell({}));
    expect(style).toMatchObject({
      backgroundColor: colors.surfaceSunken,
      borderColor: colors.border,
    });
    expect(style.borderStyle).toBeUndefined();
  });

  it("draws today without a session like a past day", () => {
    const style = dayCircleStyle(cell({ isToday: true }));
    expect(style).toMatchObject({
      backgroundColor: colors.surfaceSunken,
      borderColor: colors.border,
    });
    expect(style.borderStyle).toBeUndefined();
  });

  it("draws a future day with a dashed strong border", () => {
    expect(dayCircleStyle(cell({ isFuture: true }))).toMatchObject({
      backgroundColor: colors.surfaceSunken,
      borderColor: colors.borderStrong,
      borderStyle: "dashed",
    });
  });
});

describe("dayLetterVariant", () => {
  it("is dayToday only for today", () => {
    expect(dayLetterVariant(cell({ isToday: true }))).toBe("dayToday");
    expect(dayLetterVariant(cell({}))).toBe("day");
    expect(dayLetterVariant(cell({ isFuture: true }))).toBe("day");
  });

  it("adds the day glow to today's practiced circle only", () => {
    expect(dayCircleStyle(cell({ practiced: true, isToday: true }))).toMatchObject(shadow.dayGlow);
    expect(dayCircleStyle(cell({ practiced: true }))).not.toHaveProperty("shadowRadius");
    expect(dayCircleStyle(cell({ isToday: true }))).not.toHaveProperty("shadowRadius");
  });
});
