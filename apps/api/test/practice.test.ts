// apps/api/test/practice.test.ts
//
// Tests for the choice of today's practice run.
//
// Tested:
// - todayRun picks the newest run created today in the learner's time zone
// - PRACTICE_LOOKBACK_MS covers a local day
// - recentPromptsSince goes back the given days from a time
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec vitest run apps/api/test/practice.test.ts
//
// SEE: apps/api/src/practice.ts

import { describe, expect, it } from "vitest";
import type { PracticeRunWithItems } from "@fluency-lab/shared";
import { PRACTICE_LOOKBACK_MS, recentPromptsSince, todayRun } from "../src/practice";

const BUENOS_AIRES = "America/Argentina/Buenos_Aires";

function runAt(id: string, createdAt: string): PracticeRunWithItems {
  return {
    run: {
      id,
      focus: "mistakes",
      topicId: null,
      noteId: null,
      target: 5,
      costUsd: 0,
      createdAt,
      finishedAt: null,
    },
    items: [],
  };
}

describe("todayRun", () => {
  it("picks the newest run created today", () => {
    const runs = [
      runAt("a", "2026-11-07T10:00:00+00:00"),
      runAt("c", "2026-11-07T18:00:00+00:00"),
      runAt("b", "2026-11-07T12:00:00+00:00"),
    ];
    expect(todayRun(runs, "UTC", "2026-11-07")?.run.id).toBe("c");
  });

  it("returns null with no runs", () => {
    expect(todayRun([], "UTC", "2026-11-07")).toBeNull();
  });

  it("skips a run from yesterday in the zone", () => {
    const runs = [runAt("a", "2026-11-06T10:00:00+00:00")];
    expect(todayRun(runs, "UTC", "2026-11-07")).toBeNull();
  });

  it("counts a run at 23:59 local as today and 00:00 the next day as tomorrow", () => {
    const late = runAt("late", "2026-11-08T02:59:00+00:00");
    const next = runAt("next", "2026-11-08T03:00:00+00:00");
    expect(todayRun([late], BUENOS_AIRES, "2026-11-07")?.run.id).toBe("late");
    expect(todayRun([next], BUENOS_AIRES, "2026-11-07")).toBeNull();
  });

  it("uses the device zone, not UTC", () => {
    const runs = [runAt("a", "2026-11-08T01:00:00+00:00")];
    expect(todayRun(runs, "UTC", "2026-11-07")).toBeNull();
    expect(todayRun(runs, BUENOS_AIRES, "2026-11-07")?.run.id).toBe("a");
  });
});

describe("PRACTICE_LOOKBACK_MS", () => {
  it("is two days", () => {
    expect(PRACTICE_LOOKBACK_MS).toBe(2 * 24 * 60 * 60 * 1000);
  });
});

describe("recentPromptsSince", () => {
  it("reads seven days back from now", () => {
    expect(recentPromptsSince(new Date("2026-11-05T12:00:00.000Z"), 7)).toBe(
      "2026-10-29T12:00:00.000Z",
    );
  });

  it("reads one day back", () => {
    expect(recentPromptsSince(new Date("2026-11-05T12:00:00.000Z"), 1)).toBe(
      "2026-11-04T12:00:00.000Z",
    );
  });
});
