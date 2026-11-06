// apps/api/test/month.test.ts
//
// Tests for the month spend math.
//
// Tested:
// - currentMonthStart gives the first day of the local month
// - monthSpend sums the cost of the sessions created in that month
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec vitest run apps/api/test/month.test.ts
//
// SEE: apps/api/src/month.ts

import { describe, expect, it } from "vitest";
import { MONTH_LOOKBACK_MS, currentMonthStart, monthSpend } from "../src/month";

const BUENOS_AIRES = "America/Argentina/Buenos_Aires";

describe("currentMonthStart", () => {
  it("gives the first day of the month in the zone", () => {
    expect(currentMonthStart(new Date("2026-11-15T12:00:00Z"), "UTC")).toBe("2026-11-01");
  });

  it("uses the zone's month when UTC is already the next month", () => {
    const instant = new Date("2026-12-01T01:00:00Z");
    expect(currentMonthStart(instant, "UTC")).toBe("2026-12-01");
    expect(currentMonthStart(instant, BUENOS_AIRES)).toBe("2026-11-01");
  });
});

describe("MONTH_LOOKBACK_MS", () => {
  it("is 32 days", () => {
    expect(MONTH_LOOKBACK_MS).toBe(32 * 24 * 60 * 60 * 1000);
  });
});

describe("monthSpend", () => {
  it("sums this month's sessions", () => {
    const rows = [
      { createdAt: "2026-11-03T10:00:00Z", costUsd: 0.25 },
      { createdAt: "2026-11-10T10:00:00Z", costUsd: 0.5 },
    ];
    expect(monthSpend(rows, "UTC", "2026-11-01")).toBe(0.75);
  });

  it("spends 0 with no sessions", () => {
    expect(monthSpend([], "UTC", "2026-11-01")).toBe(0);
  });

  it("leaves out 23:30 local on the last day of the previous month", () => {
    const rows = [{ createdAt: "2026-11-01T02:30:00Z", costUsd: 1 }];
    expect(monthSpend(rows, BUENOS_AIRES, "2026-11-01")).toBe(0);
  });

  it("keeps 00:00 local on the first", () => {
    const rows = [{ createdAt: "2026-11-01T03:00:00Z", costUsd: 1 }];
    expect(monthSpend(rows, BUENOS_AIRES, "2026-11-01")).toBe(1);
  });

  it("adds 0.1 and 0.2 as 0.3", () => {
    const rows = [
      { createdAt: "2026-11-03T10:00:00Z", costUsd: 0.1 },
      { createdAt: "2026-11-04T10:00:00Z", costUsd: 0.2 },
    ];
    expect(monthSpend(rows, "UTC", "2026-11-01")).toBe(0.3);
  });
});
