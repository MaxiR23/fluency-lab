// apps/api/test/week.test.ts
//
// Tests for the time zone math of the week strip.
//
// Tested:
// - isTimeZone validates an IANA zone name
// - localDate gives the calendar date of an instant in a zone
// - currentWeek gives the Monday and the day of today in a zone
// - weekDays buckets session starts and finished runs into the days of a week and marks the perfect days
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec vitest run apps/api/test/week.test.ts
//
// SEE: apps/api/src/week.ts

import { describe, expect, it } from "vitest";
import { currentWeek, isTimeZone, localDate, weekDays } from "../src/week";

const BUENOS_AIRES = "America/Argentina/Buenos_Aires";

describe("isTimeZone", () => {
  it("accepts an IANA zone and UTC", () => {
    expect(isTimeZone(BUENOS_AIRES)).toBe(true);
    expect(isTimeZone("UTC")).toBe(true);
  });

  it("rejects raw offsets and UTC or GMT offset forms", () => {
    expect(isTimeZone("-03:00")).toBe(false);
    expect(isTimeZone("+05:30")).toBe(false);
    expect(isTimeZone("UTC+3")).toBe(false);
    expect(isTimeZone("GMT-3")).toBe(false);
  });

  it("keeps Etc zone names", () => {
    expect(isTimeZone("Etc/GMT-3")).toBe(true);
  });

  it("rejects an unknown zone and an empty string", () => {
    expect(isTimeZone("Mars/Olympus")).toBe(false);
    expect(isTimeZone("")).toBe(false);
  });
});

describe("localDate", () => {
  it("gives the calendar date in the zone", () => {
    const instant = new Date("2026-11-05T02:00:00Z");
    expect(localDate(instant, BUENOS_AIRES)).toBe("2026-11-04");
    expect(localDate(instant, "UTC")).toBe("2026-11-05");
    expect(localDate(instant, "Asia/Tokyo")).toBe("2026-11-05");
  });
});

describe("currentWeek", () => {
  it("starts the week on Monday", () => {
    expect(currentWeek(new Date("2026-11-05T12:00:00Z"), "UTC")).toEqual({
      weekStart: "2026-11-02",
      today: "2026-11-05",
    });
  });

  it("is its own week start on a Monday", () => {
    expect(currentWeek(new Date("2026-11-02T12:00:00Z"), "UTC")).toEqual({
      weekStart: "2026-11-02",
      today: "2026-11-02",
    });
  });

  it("keeps Sunday in the week that started six days before", () => {
    expect(currentWeek(new Date("2026-11-08T12:00:00Z"), "UTC")).toEqual({
      weekStart: "2026-11-02",
      today: "2026-11-08",
    });
  });

  it("uses the zone's day, not UTC's", () => {
    const instant = new Date("2026-11-09T01:00:00Z");
    expect(currentWeek(instant, "UTC").weekStart).toBe("2026-11-09");
    expect(currentWeek(instant, BUENOS_AIRES)).toEqual({
      weekStart: "2026-11-02",
      today: "2026-11-08",
    });
  });

  it("crosses a year end", () => {
    expect(currentWeek(new Date("2026-01-01T12:00:00Z"), "UTC").weekStart).toBe("2025-12-29");
  });
});

describe("weekDays", () => {
  it("returns each day of the week with a session once, in order", () => {
    const starts = [
      "2026-11-02T09:00:00+00:00",
      "2026-11-04T09:00:00+00:00",
      "2026-11-04T18:00:00+00:00",
    ];
    expect(weekDays(starts, [], "UTC", "2026-11-02")).toEqual({
      days: ["2026-11-02", "2026-11-04"],
      perfectDays: [],
    });
  });

  it("returns no days for no sessions", () => {
    expect(weekDays([], [], "UTC", "2026-11-02").days).toEqual([]);
  });

  it("counts a session at local midnight on Monday and not one a second before", () => {
    expect(weekDays(["2026-11-02T00:00:00+00:00"], [], "UTC", "2026-11-02").days).toEqual([
      "2026-11-02",
    ]);
    expect(weekDays(["2026-11-01T23:59:59+00:00"], [], "UTC", "2026-11-02").days).toEqual([]);
  });

  it("counts a session at 23:59:59 on Sunday", () => {
    expect(weekDays(["2026-11-08T23:59:59+00:00"], [], "UTC", "2026-11-02").days).toEqual([
      "2026-11-08",
    ]);
  });

  it("buckets by the zone's date", () => {
    expect(weekDays(["2026-11-05T02:00:00+00:00"], [], BUENOS_AIRES, "2026-11-02").days).toEqual([
      "2026-11-04",
    ]);
  });

  it("counts a day with a chat only and has no perfect day", () => {
    expect(weekDays(["2026-11-03T10:00:00+00:00"], [], "UTC", "2026-11-02")).toEqual({
      days: ["2026-11-03"],
      perfectDays: [],
    });
  });

  it("counts a day with a finished run and no chat", () => {
    const runs = [{ finishedAt: "2026-11-03T10:00:00+00:00", missed: true }];
    expect(weekDays([], runs, "UTC", "2026-11-02").days).toEqual(["2026-11-03"]);
  });

  it("does not count a run that is not finished", () => {
    const runs = [{ finishedAt: null, missed: false }];
    expect(weekDays([], runs, "UTC", "2026-11-02")).toEqual({ days: [], perfectDays: [] });
  });

  it("marks the day of a finished run with no miss as perfect", () => {
    const runs = [{ finishedAt: "2026-11-03T10:00:00+00:00", missed: false }];
    expect(weekDays([], runs, "UTC", "2026-11-02")).toEqual({
      days: ["2026-11-03"],
      perfectDays: ["2026-11-03"],
    });
  });

  it("counts but does not mark perfect the day of a run with a miss", () => {
    const runs = [{ finishedAt: "2026-11-03T10:00:00+00:00", missed: true }];
    expect(weekDays([], runs, "UTC", "2026-11-02")).toEqual({
      days: ["2026-11-03"],
      perfectDays: [],
    });
  });

  it("marks a day perfect when it has a perfect and an imperfect run", () => {
    const runs = [
      { finishedAt: "2026-11-03T09:00:00+00:00", missed: true },
      { finishedAt: "2026-11-03T18:00:00+00:00", missed: false },
    ];
    expect(weekDays([], runs, "UTC", "2026-11-02")).toEqual({
      days: ["2026-11-03"],
      perfectDays: ["2026-11-03"],
    });
  });

  it("buckets a run finished just after midnight in the zone into the new day", () => {
    const after = [{ finishedAt: "2026-11-05T03:05:00Z", missed: false }];
    const before = [{ finishedAt: "2026-11-05T02:55:00Z", missed: false }];
    expect(weekDays([], after, BUENOS_AIRES, "2026-11-02").perfectDays).toEqual(["2026-11-05"]);
    expect(weekDays([], before, BUENOS_AIRES, "2026-11-02").perfectDays).toEqual(["2026-11-04"]);
  });

  it("merges a chat and a run on the same day into one day", () => {
    const runs = [{ finishedAt: "2026-11-03T18:00:00+00:00", missed: false }];
    expect(weekDays(["2026-11-03T09:00:00+00:00"], runs, "UTC", "2026-11-02")).toEqual({
      days: ["2026-11-03"],
      perfectDays: ["2026-11-03"],
    });
  });

  it("ignores a run finished outside the week", () => {
    const runs = [
      { finishedAt: "2026-11-01T10:00:00+00:00", missed: false },
      { finishedAt: "2026-11-09T10:00:00+00:00", missed: false },
    ];
    expect(weekDays([], runs, "UTC", "2026-11-02")).toEqual({ days: [], perfectDays: [] });
  });

  it("returns no days and no perfect days for no sessions and no runs", () => {
    expect(weekDays([], [], "UTC", "2026-11-02")).toEqual({ days: [], perfectDays: [] });
  });
});
