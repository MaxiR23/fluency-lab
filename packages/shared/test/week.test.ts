// packages/shared/test/week.test.ts
//
// Tests for the date arithmetic of the week strip.
//
// Tested:
// - addDays moves a calendar date by whole days
// - weekDates lists the seven dates of a week from its Monday
//
// What is covered:
// - Normal case and edges (month end, year end, leap day). An empty case does
//   not apply: a week always has 7 dates and the input is a validated date.
//
// Run with: pnpm exec vitest run packages/shared/test/week.test.ts
//
// SEE: packages/shared/src/week.ts

import { describe, expect, it } from "vitest";
import { addDays, weekDates } from "../src/week";

describe("addDays", () => {
  it("returns the same date for 0", () => {
    expect(addDays("2026-11-05", 0)).toBe("2026-11-05");
  });

  it("moves back one day", () => {
    expect(addDays("2026-11-01", -1)).toBe("2026-10-31");
  });

  it("moves forward across a month end", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
  });
});

describe("weekDates", () => {
  it("lists the seven dates from Monday", () => {
    expect(weekDates("2026-11-02")).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);
  });

  it("crosses a month end", () => {
    expect(weekDates("2026-10-26")[6]).toBe("2026-11-01");
  });

  it("crosses a year end", () => {
    expect(weekDates("2025-12-29")).toEqual([
      "2025-12-29",
      "2025-12-30",
      "2025-12-31",
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04",
    ]);
  });

  it("counts the leap day", () => {
    expect(weekDates("2028-02-28")[1]).toBe("2028-02-29");
  });
});
