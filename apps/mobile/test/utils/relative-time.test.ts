// apps/mobile/test/utils/relative-time.test.ts
//
// Tests for the relative time copy.
//
// Tested:
// - relativeTime buckets and its unparsable date
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/relative-time.test.ts
//
// SEE: apps/mobile/src/utils/relative-time.ts

import { describe, expect, it } from "@jest/globals";

import { relativeTime } from "@/utils/relative-time";

const now = Date.parse("2026-11-05T12:00:00Z");

function ago(seconds: number): string {
  return new Date(now - seconds * 1000).toISOString();
}

describe("relativeTime", () => {
  it("says Just now under a minute", () => {
    expect(relativeTime(ago(59), now)).toBe("Just now");
  });

  it("says Just now for a future date", () => {
    expect(relativeTime(ago(-300), now)).toBe("Just now");
  });

  it("says 1 min ago at exactly 60 seconds", () => {
    expect(relativeTime(ago(60), now)).toBe("1 min ago");
  });

  it("says 59 min ago one second before an hour", () => {
    expect(relativeTime(ago(3599), now)).toBe("59 min ago");
  });

  it("says 1 h ago at exactly one hour", () => {
    expect(relativeTime(ago(3600), now)).toBe("1 h ago");
  });

  it("says Yesterday at exactly 24 hours", () => {
    expect(relativeTime(ago(24 * 3600), now)).toBe("Yesterday");
  });

  it("says 2 days ago at exactly 48 hours", () => {
    expect(relativeTime(ago(48 * 3600), now)).toBe("2 days ago");
  });

  it("returns null for an unparsable date", () => {
    expect(relativeTime("not a date", now)).toBeNull();
  });
});
