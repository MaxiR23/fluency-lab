// apps/mobile/test/utils/calendar.test.ts
//
// Tests for the short date helper.
//
// Tested:
// - shortDate writes a YYYY-MM-DD day as "Nov 5"
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/calendar.test.ts
//
// SEE: apps/mobile/src/utils/calendar.ts

import { describe, expect, it } from "@jest/globals";

import { shortDate } from "@/utils/calendar";

describe("shortDate", () => {
  it("writes November 5 as Nov 5", () => {
    expect(shortDate("2026-11-05")).toBe("Nov 5");
  });

  it("drops the leading zero of the day", () => {
    expect(shortDate("2026-11-09")).toBe("Nov 9");
  });

  it("writes January 1 and December 31", () => {
    expect(shortDate("2026-01-01")).toBe("Jan 1");
    expect(shortDate("2026-12-31")).toBe("Dec 31");
  });
});
