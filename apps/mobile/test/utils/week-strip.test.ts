// apps/mobile/test/utils/week-strip.test.ts
//
// Tests for the week strip cells.
//
// Tested:
// - weekStrip draws seven days from Monday, with the practiced, today and
//   future flags, the perfect flag, the accessibility labels and the count,
//   with the perfect count when there is one
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/week-strip.test.ts
//
// SEE: apps/mobile/src/utils/week-strip.ts

import { describe, expect, it } from "@jest/globals";

import { weekStrip } from "@/utils/week-strip";

function week(today: string, days: string[], perfectDays: string[] = []) {
  return { weekStart: "2026-11-02", today, days, perfectDays };
}

describe("weekStrip", () => {
  it("draws seven days from Monday with their letters", () => {
    const { days } = weekStrip(week("2026-11-05", []));
    expect(days.map((cell) => cell.letter)).toEqual(["M", "T", "W", "T", "F", "S", "S"]);
    expect(days.map((cell) => cell.date)[0]).toBe("2026-11-02");
    expect(days.map((cell) => cell.date)[6]).toBe("2026-11-08");
  });

  it("checks the days with a session and counts them", () => {
    const result = weekStrip(week("2026-11-05", ["2026-11-02", "2026-11-04", "2026-11-05"]));
    expect(result.days.map((cell) => cell.practiced)).toEqual([
      true,
      false,
      true,
      true,
      false,
      false,
      false,
    ]);
    expect(result.countLabel).toBe("3 of 7 days");
  });

  it("marks today and the days after it", () => {
    const { days } = weekStrip(week("2026-11-05", []));
    expect(days.map((cell) => cell.isToday)).toEqual([
      false,
      false,
      false,
      true,
      false,
      false,
      false,
    ]);
    expect(days.map((cell) => cell.isFuture)).toEqual([
      false,
      false,
      false,
      false,
      true,
      true,
      true,
    ]);
  });

  it("draws an empty week as seven empty days and 0 of 7", () => {
    const result = weekStrip(week("2026-11-05", []));
    expect(result.days.every((cell) => !cell.practiced)).toBe(true);
    expect(result.countLabel).toBe("0 of 7 days");
  });

  it("has no future days on Sunday", () => {
    const { days } = weekStrip(week("2026-11-08", []));
    expect(days.some((cell) => cell.isFuture)).toBe(false);
    expect(days[6].isToday).toBe(true);
  });

  it("has six future days on Monday", () => {
    const { days } = weekStrip(week("2026-11-02", []));
    expect(days.filter((cell) => cell.isFuture)).toHaveLength(6);
  });

  it("ignores a day outside the week", () => {
    const result = weekStrip(week("2026-11-05", ["2026-10-30", "2026-11-09"]));
    expect(result.countLabel).toBe("0 of 7 days");
    expect(result.days.some((cell) => cell.practiced)).toBe(false);
  });

  it("labels each day for accessibility", () => {
    const { days } = weekStrip(week("2026-11-05", ["2026-11-02"]));
    expect(days[0].label).toBe("Monday, practiced");
    expect(days[1].label).toBe("Tuesday, not practiced");
    expect(days[6].label).toBe("Sunday, not practiced");
  });

  it("marks a perfect day and labels it perfect practice", () => {
    const { days } = weekStrip(week("2026-11-05", ["2026-11-02", "2026-11-03"], ["2026-11-03"]));
    expect(days[1].perfect).toBe(true);
    expect(days[1].practiced).toBe(true);
    expect(days[1].label).toBe("Tuesday, perfect practice");
    expect(days[0].perfect).toBe(false);
    expect(days[0].label).toBe("Monday, practiced");
  });

  it("adds the perfect count to the header when there is a perfect day", () => {
    const result = weekStrip(week("2026-11-05", ["2026-11-02", "2026-11-03"], ["2026-11-03"]));
    expect(result.countLabel).toBe("2 of 7 days · 1 perfect");
  });

  it("keeps the plain count when no day is perfect", () => {
    const result = weekStrip(week("2026-11-05", ["2026-11-02", "2026-11-04", "2026-11-05"]));
    expect(result.countLabel).toBe("3 of 7 days");
    expect(result.countLabel).not.toContain("perfect");
  });

  it("ignores a perfect day outside the week", () => {
    const result = weekStrip(week("2026-11-05", ["2026-11-09"], ["2026-11-09"]));
    expect(result.countLabel).toBe("0 of 7 days");
    expect(result.days.some((cell) => cell.perfect)).toBe(false);
  });

  it("does not mark a day perfect that is not a practiced day", () => {
    const result = weekStrip(week("2026-11-05", ["2026-11-02"], ["2026-11-03"]));
    expect(result.days[1].perfect).toBe(false);
    expect(result.days[1].label).toBe("Tuesday, not practiced");
    expect(result.countLabel).toBe("1 of 7 days");
  });
});
