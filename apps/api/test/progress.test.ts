// apps/api/test/progress.test.ts
//
// Tests for the Progress page shaping.
//
// Tested:
// - pageOf keeps one page and gives the next offset only when a row beyond it was read
// - noteItem dates a note in the caller's zone
// - historyItem and wordItem give each row its local day in the caller's zone
// - mistakeGroup keeps a missing rule as null and nests the latest example
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec vitest run apps/api/test/progress.test.ts
//
// SEE: apps/api/src/progress.ts

import type { Session } from "@fluency-lab/shared";
import { describe, expect, it } from "vitest";
import { PAGE_SIZE, historyItem, mistakeGroup, noteItem, pageOf, wordItem } from "../src/progress";

function rows(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}

function sessionAt(createdAt: string): Session {
  return {
    id: "session-1",
    topicId: null,
    title: "Free chat",
    status: "ended",
    summary: null,
    contextSummary: null,
    contextThroughId: null,
    costUsd: 0,
    createdAt,
    updatedAt: createdAt,
  };
}

describe("pageOf", () => {
  it("keeps 20 rows and points to offset 40 when 21 were read at offset 20", () => {
    const page = pageOf(rows(PAGE_SIZE + 1), 20);
    expect(page.items).toEqual(rows(PAGE_SIZE));
    expect(page.nextOffset).toBe(40);
  });

  it("gives no next offset when exactly a page was read", () => {
    const page = pageOf(rows(PAGE_SIZE), 0);
    expect(page.items).toHaveLength(PAGE_SIZE);
    expect(page.nextOffset).toBeNull();
  });

  it("gives no next offset when one row fewer than a page was read", () => {
    const page = pageOf(rows(PAGE_SIZE - 1), 0);
    expect(page.items).toHaveLength(PAGE_SIZE - 1);
    expect(page.nextOffset).toBeNull();
  });

  it("returns an empty page with no next offset for no rows", () => {
    expect(pageOf([], 0)).toEqual({ items: [], nextOffset: null });
  });
});

describe("historyItem", () => {
  const row = {
    session: sessionAt("2026-11-01T02:30:00+00:00"),
    messageCount: 14,
    correctionCount: 3,
  };

  it("dates a session at 02:30 UTC on November 1 as October 31 in Buenos Aires", () => {
    expect(historyItem(row, "America/Argentina/Buenos_Aires")).toEqual({
      session: row.session,
      day: "2026-10-31",
      messageCount: 14,
      correctionCount: 3,
    });
  });

  it("dates it as November 1 in UTC", () => {
    expect(historyItem(row, "UTC").day).toBe("2026-11-01");
  });
});

describe("wordItem", () => {
  it("dates a word by its message's local day", () => {
    const row = { word: "catchy", sentence: "That song.", createdAt: "2026-11-05T01:00:00+00:00" };
    expect(wordItem(row, "America/Argentina/Buenos_Aires")).toEqual({
      word: "catchy",
      sentence: "That song.",
      day: "2026-11-04",
    });
    expect(wordItem(row, "UTC").day).toBe("2026-11-05");
  });
});

describe("noteItem", () => {
  const row = {
    id: "n1",
    kind: "table" as const,
    title: "T",
    topic: "P",
    createdAt: "2026-11-05T01:00:00+00:00",
  };

  it("dates a note in the caller's zone", () => {
    expect(noteItem(row, "America/Argentina/Buenos_Aires")).toEqual({
      id: "n1",
      kind: "table",
      title: "T",
      topic: "P",
      day: "2026-11-04",
    });
  });

  it("dates a note at 23:30 UTC on the next local day in a zone ahead", () => {
    const late = { ...row, createdAt: "2026-11-05T23:30:00+00:00" };
    expect(noteItem(late, "Pacific/Auckland").day).toBe("2026-11-06");
    expect(noteItem(late, "UTC").day).toBe("2026-11-05");
  });
});

describe("mistakeGroup", () => {
  it("nests the latest example under the rule and the times", () => {
    expect(
      mistakeGroup({ rule: "Articles", times: 4, original: "a apple", corrected: "an apple" }),
    ).toEqual({
      rule: "Articles",
      times: 4,
      latest: { original: "a apple", corrected: "an apple" },
    });
  });

  it("maps a group without a rule to rule null", () => {
    expect(mistakeGroup({ rule: null, times: 1, original: "a", corrected: "b" }).rule).toBeNull();
  });
});
