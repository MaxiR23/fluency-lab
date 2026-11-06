// apps/api/test/week.test.ts
//
// Tests for the time zone math of the week strip.
//
// Tested:
// - isTimeZone validates an IANA zone name
// - localDate gives the calendar date of an instant in a zone
// - currentWeek gives the Monday and the day of today in a zone
// - sessionDays buckets session start times into the days of a week
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec vitest run apps/api/test/week.test.ts
//
// SEE: apps/api/src/week.ts

import { describe, expect, it } from "vitest";
import { currentWeek, isTimeZone, localDate, sessionDays } from "../src/week";

const BUENOS_AIRES = "America/Argentina/Buenos_Aires";

describe("isTimeZone", () => {
  it("accepts an IANA zone and UTC", () => {
    expect(isTimeZone(BUENOS_AIRES)).toBe(true);
    expect(isTimeZone("UTC")).toBe(true);
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

describe("sessionDays", () => {
  it("returns each day of the week with a session once, in order", () => {
    const starts = [
      "2026-11-02T09:00:00+00:00",
      "2026-11-04T09:00:00+00:00",
      "2026-11-04T18:00:00+00:00",
    ];
    expect(sessionDays(starts, "UTC", "2026-11-02")).toEqual(["2026-11-02", "2026-11-04"]);
  });

  it("returns no days for no sessions", () => {
    expect(sessionDays([], "UTC", "2026-11-02")).toEqual([]);
  });

  it("counts a session at local midnight on Monday and not one a second before", () => {
    expect(sessionDays(["2026-11-02T00:00:00+00:00"], "UTC", "2026-11-02")).toEqual(["2026-11-02"]);
    expect(sessionDays(["2026-11-01T23:59:59+00:00"], "UTC", "2026-11-02")).toEqual([]);
  });

  it("counts a session at 23:59:59 on Sunday", () => {
    expect(sessionDays(["2026-11-08T23:59:59+00:00"], "UTC", "2026-11-02")).toEqual(["2026-11-08"]);
  });

  it("buckets by the zone's date", () => {
    expect(sessionDays(["2026-11-05T02:00:00+00:00"], BUENOS_AIRES, "2026-11-02")).toEqual([
      "2026-11-04",
    ]);
  });
});
