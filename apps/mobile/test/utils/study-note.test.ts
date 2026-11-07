// apps/mobile/test/utils/study-note.test.ts
//
// Tests for the normalization of the tutor's structured study note.
//
// Tested:
// - toStudyNote shapes a table with three columns and a summary with points
// - It reads the kind whatever its case and returns null for an unknown kind
// - It returns null for a table without exactly three columns or with no usable row
// - It keeps at most eight rows and eight points and caps every text at its limit
// - Its output always passes studyNoteCreateSchema with a null session
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/study-note.test.ts
//
// SEE: apps/mobile/src/utils/study-note.ts

import { describe, expect, it } from "@jest/globals";
import { studyNoteCreateSchema, type StudyNotePayload } from "@fluency-lab/shared";

import { toStudyNote } from "@/utils/study-note";

const table: StudyNotePayload = {
  kind: "table",
  title: "Future forms",
  topic: "Going to, will",
  columns: ["Form", "When", "Example"],
  rows: [
    ["going to", "plans", "I'm going to study."],
    ["will", "decisions now", "I'll help you."],
  ],
  points: [],
  remember: "Plans use going to.",
};

const summary: StudyNotePayload = {
  kind: "summary",
  title: "Present perfect",
  topic: "Have + past participle",
  columns: [],
  rows: [],
  points: ["Use it for experience.", "Use it for news."],
  remember: "Think of now.",
};

function accepted(note: ReturnType<typeof toStudyNote>): boolean {
  return note !== null && studyNoteCreateSchema.safeParse({ ...note, sessionId: null }).success;
}

describe("toStudyNote", () => {
  it("shapes a table with three columns and its rows", () => {
    expect(toStudyNote(table)).toEqual({
      kind: "table",
      title: "Future forms",
      topic: "Going to, will",
      content: {
        columns: ["Form", "When", "Example"],
        rows: [
          ["going to", "plans", "I'm going to study."],
          ["will", "decisions now", "I'll help you."],
        ],
        remember: "Plans use going to.",
      },
    });
  });

  it("shapes a summary with its points", () => {
    expect(toStudyNote(summary)).toEqual({
      kind: "summary",
      title: "Present perfect",
      topic: "Have + past participle",
      content: {
        points: ["Use it for experience.", "Use it for news."],
        remember: "Think of now.",
      },
    });
  });

  it("reads the kind whatever its case", () => {
    expect(toStudyNote({ ...table, kind: " Table " })?.kind).toBe("table");
    expect(toStudyNote({ ...summary, kind: "SUMMARY" })?.kind).toBe("summary");
  });

  it("returns null for an unknown kind", () => {
    expect(toStudyNote({ ...table, kind: "poem" })).toBeNull();
    expect(toStudyNote({ ...table, kind: "" })).toBeNull();
  });

  it("returns null for a table without exactly three columns", () => {
    expect(toStudyNote({ ...table, columns: ["a", "b"] })).toBeNull();
    expect(toStudyNote({ ...table, columns: ["a", "b", "c", "d"] })).toBeNull();
    expect(toStudyNote({ ...table, columns: ["a", "b", " "] })).toBeNull();
  });

  it("drops rows that do not have three filled cells and returns null with none left", () => {
    const rows = [
      ["a", "b"],
      ["a", "b", "c", "d"],
      ["a", " ", "c"],
      ["x", "y", "z"],
    ];
    expect(toStudyNote({ ...table, rows })?.content).toMatchObject({ rows: [["x", "y", "z"]] });
    expect(toStudyNote({ ...table, rows: rows.slice(0, 3) })).toBeNull();
    expect(toStudyNote({ ...table, rows: [] })).toBeNull();
  });

  it("keeps the first eight rows and the first eight points", () => {
    const rows = Array.from({ length: 9 }, (_, i) => [`a${i}`, `b${i}`, `c${i}`]);
    const points = Array.from({ length: 9 }, (_, i) => `p${i}`);
    const tableRows = (toStudyNote({ ...table, rows })?.content as { rows: string[][] }).rows;
    expect(tableRows).toHaveLength(8);
    expect(tableRows[7]).toEqual(["a7", "b7", "c7"]);
    const kept = (toStudyNote({ ...summary, points })?.content as { points: string[] }).points;
    expect(kept).toHaveLength(8);
    expect(kept[7]).toBe("p7");
  });

  it("caps the title, topic, labels, cells, points and remember at their limits", () => {
    const long = (n: number) => `${"a".repeat(n + 20)}`;
    const noted = toStudyNote({
      kind: "table",
      title: ` ${long(80)} `,
      topic: long(80),
      columns: [long(40), long(40), long(40)],
      rows: [[long(120), long(120), long(120)]],
      points: [],
      remember: long(300),
    });
    expect(noted?.title).toHaveLength(80);
    expect(noted?.topic).toHaveLength(80);
    const content = noted?.content as { columns: string[]; rows: string[][]; remember: string };
    expect(content.columns.every((label) => label.length === 40)).toBe(true);
    expect(content.rows[0]?.every((cell) => cell.length === 120)).toBe(true);
    expect(content.remember).toHaveLength(300);
    const point = toStudyNote({ ...summary, points: [long(200)] })?.content as { points: string[] };
    expect(point.points[0]).toHaveLength(200);
    expect(accepted(noted)).toBe(true);
  });

  it("trims after the cut", () => {
    const title = `${"a".repeat(79)} bbbb`;
    expect(toStudyNote({ ...table, title })?.title).toBe("a".repeat(79));
  });

  it("returns null with an empty title, topic or remember", () => {
    expect(toStudyNote({ ...table, title: "  " })).toBeNull();
    expect(toStudyNote({ ...table, topic: "" })).toBeNull();
    expect(toStudyNote({ ...table, remember: " " })).toBeNull();
  });

  it("returns null for a summary with no usable point", () => {
    expect(toStudyNote({ ...summary, points: [] })).toBeNull();
    expect(toStudyNote({ ...summary, points: [" ", ""] })).toBeNull();
  });

  it("ignores the table fields of a summary and the points of a table", () => {
    const mixed = toStudyNote({ ...summary, columns: ["a"], rows: [["x"]] });
    expect(mixed?.content).toEqual({ points: summary.points, remember: "Think of now." });
    const other = toStudyNote({ ...table, points: ["stray"] });
    expect(other?.content).not.toHaveProperty("points");
  });

  it("always passes studyNoteCreateSchema with a null session", () => {
    expect(accepted(toStudyNote(table))).toBe(true);
    expect(accepted(toStudyNote(summary))).toBe(true);
    const edge = toStudyNote({
      ...table,
      rows: Array.from({ length: 12 }, (_, i) => [`a${i}`, `b${i}`, `c${i}`]),
    });
    expect(accepted(edge)).toBe(true);
  });
});
