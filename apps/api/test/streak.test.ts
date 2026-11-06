// apps/api/test/streak.test.ts
//
// Tests for the day streak of the profile stats.
//
// Tested:
// - dayStreak counts the consecutive days with a session ending today, or ending yesterday when today has none yet
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec vitest run apps/api/test/streak.test.ts
//
// SEE: apps/api/src/streak.ts

import { describe, expect, it } from "vitest";
import { dayStreak } from "../src/streak";

const today = "2026-11-06";

describe("dayStreak", () => {
  it("returns 0 for a user with no sessions", () => {
    expect(dayStreak([], today)).toBe(0);
  });

  it("returns 1 when the only session is today", () => {
    expect(dayStreak(["2026-11-06"], today)).toBe(1);
  });

  it("returns 1 when the only session is yesterday", () => {
    expect(dayStreak(["2026-11-05"], today)).toBe(1);
  });

  it("counts yesterday and the day before when today has none yet", () => {
    expect(dayStreak(["2026-11-05", "2026-11-04"], today)).toBe(2);
  });

  it("counts several consecutive days ending today", () => {
    expect(dayStreak(["2026-11-06", "2026-11-05", "2026-11-04"], today)).toBe(3);
  });

  it("stops at the first day without a session", () => {
    expect(dayStreak(["2026-11-06", "2026-11-05", "2026-11-03"], today)).toBe(2);
  });

  it("returns 0 when the last session was two days ago", () => {
    expect(dayStreak(["2026-11-04", "2026-11-03"], today)).toBe(0);
  });

  it("does not depend on the order of the days", () => {
    expect(dayStreak(["2026-11-04", "2026-11-06", "2026-11-05"], today)).toBe(3);
  });

  it("counts a repeated day once", () => {
    expect(dayStreak(["2026-11-06", "2026-11-06", "2026-11-05"], today)).toBe(2);
  });

  it("walks back across a month boundary", () => {
    expect(dayStreak(["2026-11-01", "2026-10-31"], "2026-11-01")).toBe(2);
  });

  it("ignores a day after today", () => {
    expect(dayStreak(["2026-11-07"], today)).toBe(0);
  });
});
