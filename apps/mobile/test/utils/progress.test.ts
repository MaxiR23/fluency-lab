// apps/mobile/test/utils/progress.test.ts
//
// Tests for the Progress pure functions.
//
// Tested:
// - progressFromReads and progressReducer: the first reads, the next pages, stale pages and failures
// - nextPageOffset: when a next page may be read
// - monthTiles, historyLine, timesLabel, progressRows, emptyText and progressSections
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/progress.test.ts
//
// SEE: apps/mobile/src/utils/progress.ts

import { describe, expect, it } from "@jest/globals";
import type {
  HistoryPage,
  MistakePage,
  MonthProgress,
  NotePage,
  WordPage,
} from "@fluency-lab/shared";

import type { DataOutcome } from "@/data/data-port";
import {
  emptyText,
  historyLine,
  initialProgress,
  monthTiles,
  nextPageOffset,
  progressFromReads,
  progressReducer,
  progressRows,
  progressSections,
  timesLabel,
  type ProgressState,
} from "@/utils/progress";
import { historyItemWith, mistakeGroupWith, newWordWith } from "../helpers/fake-data";

const month: MonthProgress = {
  monthStart: "2026-11-01",
  sessions: 12,
  corrections: 31,
  newWords: 48,
};
const zeros: MonthProgress = { monthStart: "2026-11-01", sessions: 0, corrections: 0, newWords: 0 };

function ok<T>(value: T): DataOutcome<T> {
  return { ok: true, value };
}

const historyPage = (page: HistoryPage = { items: [], nextOffset: null }) => ok(page);
const mistakePage = (page: MistakePage = { items: [], nextOffset: null }) => ok(page);
const wordPage = (page: WordPage = { items: [], nextOffset: null }) => ok(page);
const noteItem = (id: string, day = "2026-11-05", kind: "table" | "summary" = "table") => ({
  id,
  kind,
  title: `Note ${id}`,
  topic: "Going to, will",
  day,
});
const notePage = (page: NotePage = { items: [], nextOffset: null, today: "2026-11-07" }) =>
  ok(page);

function ready(
  overrides: {
    history?: HistoryPage;
    mistakes?: MistakePage;
    words?: WordPage;
    notes?: NotePage;
  } = {},
): ProgressState {
  return progressFromReads(
    ok(month),
    historyPage(overrides.history),
    mistakePage(overrides.mistakes),
    wordPage(overrides.words),
    notePage(overrides.notes),
  );
}

function readyOnly(state: ProgressState) {
  if (state.kind !== "ready") throw new Error("expected a ready state");
  return state;
}

describe("progressFromReads", () => {
  it("is ready with the month and the three first pages", () => {
    const state = readyOnly(
      ready({
        history: { items: [historyItemWith()], nextOffset: 20 },
        mistakes: { items: [mistakeGroupWith()], nextOffset: null },
        words: { items: [newWordWith()], nextOffset: null },
      }),
    );
    expect(state.month).toEqual(month);
    expect(state.history).toEqual({
      items: [historyItemWith()],
      nextOffset: 20,
      loadingMore: false,
      moreFailure: null,
    });
    expect(state.mistakes.items).toHaveLength(1);
    expect(state.words.items).toHaveLength(1);
  });

  it("is failed with the first failure when any of the four reads fails", () => {
    const failed: DataOutcome<never> = { ok: false, failure: "network" };
    expect(progressFromReads(failed, historyPage(), mistakePage(), wordPage(), notePage())).toEqual(
      {
        kind: "failed",
        failure: "network",
      },
    );
    expect(progressFromReads(ok(month), failed, mistakePage(), wordPage(), notePage())).toEqual({
      kind: "failed",
      failure: "network",
    });
    expect(progressFromReads(ok(month), historyPage(), failed, wordPage(), notePage())).toEqual({
      kind: "failed",
      failure: "network",
    });
    expect(progressFromReads(ok(month), historyPage(), mistakePage(), failed, notePage())).toEqual({
      kind: "failed",
      failure: "network",
    });
    expect(
      progressFromReads(
        { ok: false, failure: "unauthorized" },
        historyPage(),
        mistakePage(),
        { ok: false, failure: "unavailable" },
        notePage(),
      ),
    ).toEqual({ kind: "failed", failure: "unauthorized" });
  });

  it("is ready, not failed, when every page is empty and the month is zeros", () => {
    const state = progressFromReads(
      ok(zeros),
      historyPage(),
      mistakePage(),
      wordPage(),
      notePage(),
    );
    expect(state.kind).toBe("ready");
  });
});

describe("progressReducer", () => {
  it("goes back to loading on load_started", () => {
    expect(progressReducer(ready(), { type: "load_started" })).toEqual(initialProgress);
  });

  it("takes the reads on loaded", () => {
    const state = progressReducer(initialProgress, {
      type: "loaded",
      month: ok(month),
      history: historyPage(),
      mistakes: mistakePage(),
      words: wordPage(),
      notes: notePage(),
    });
    expect(state.kind).toBe("ready");
  });

  it("marks the section as loading more on more_started", () => {
    const state = readyOnly(
      progressReducer(ready({ history: { items: [], nextOffset: 20 } }), {
        type: "more_started",
        section: "history",
      }),
    );
    expect(state.history.loadingMore).toBe(true);
    expect(state.mistakes.loadingMore).toBe(false);
  });

  it("appends the next page and takes its next offset", () => {
    const first = historyItemWith({}, { id: "session-1" });
    const second = historyItemWith({}, { id: "session-2" });
    const state = readyOnly(
      progressReducer(ready({ history: { items: [first], nextOffset: 20 } }), {
        type: "more_loaded",
        section: "history",
        offset: 20,
        outcome: ok({ items: [second], nextOffset: 40 }),
      }),
    );
    expect(state.history.items).toEqual([first, second]);
    expect(state.history.nextOffset).toBe(40);
    expect(state.history.loadingMore).toBe(false);
  });

  it("drops a page whose offset no longer matches the list", () => {
    const start = ready({ history: { items: [historyItemWith()], nextOffset: 20 } });
    const state = progressReducer(start, {
      type: "more_loaded",
      section: "history",
      offset: 40,
      outcome: ok({ items: [historyItemWith({}, { id: "session-9" })], nextOffset: null }),
    });
    expect(state).toEqual(start);
  });

  it("skips items already in the list when appending, by session id", () => {
    const first = historyItemWith({}, { id: "session-1" });
    const state = readyOnly(
      progressReducer(ready({ history: { items: [first], nextOffset: 20 } }), {
        type: "more_loaded",
        section: "history",
        offset: 20,
        outcome: ok({ items: [first, historyItemWith({}, { id: "session-2" })], nextOffset: null }),
      }),
    );
    expect(state.history.items.map((item) => item.session.id)).toEqual(["session-1", "session-2"]);
  });

  it("skips mistakes already in the list, by lower-case rule or null for Other", () => {
    const articles = mistakeGroupWith({ rule: "Articles" });
    const other = mistakeGroupWith({ rule: null });
    const state = readyOnly(
      progressReducer(ready({ mistakes: { items: [articles, other], nextOffset: 20 } }), {
        type: "more_loaded",
        section: "mistakes",
        offset: 20,
        outcome: ok({
          items: [
            mistakeGroupWith({ rule: "articles" }),
            mistakeGroupWith({ rule: null }),
            mistakeGroupWith({ rule: "Spelling" }),
          ],
          nextOffset: null,
        }),
      }),
    );
    expect(state.mistakes.items.map((group) => group.rule)).toEqual(["Articles", null, "Spelling"]);
  });

  it("skips words already in the list, by lower-case word", () => {
    const state = readyOnly(
      progressReducer(
        ready({ words: { items: [newWordWith({ word: "Catchy" })], nextOffset: 20 } }),
        {
          type: "more_loaded",
          section: "words",
          offset: 20,
          outcome: ok({
            items: [newWordWith({ word: "catchy" }), newWordWith({ word: "eager" })],
            nextOffset: null,
          }),
        },
      ),
    );
    expect(state.words.items.map((item) => item.word)).toEqual(["Catchy", "eager"]);
  });

  it("keeps the items and stores the failure when the next page fails", () => {
    const item = historyItemWith();
    const state = readyOnly(
      progressReducer(ready({ history: { items: [item], nextOffset: 20 } }), {
        type: "more_loaded",
        section: "history",
        offset: 20,
        outcome: { ok: false, failure: "network" },
      }),
    );
    expect(state.history.items).toEqual([item]);
    expect(state.history.nextOffset).toBe(20);
    expect(state.history.loadingMore).toBe(false);
    expect(state.history.moreFailure).toBe("network");
  });

  it("ignores more events while not ready", () => {
    expect(progressReducer(initialProgress, { type: "more_started", section: "words" })).toEqual(
      initialProgress,
    );
    expect(
      progressReducer(initialProgress, {
        type: "more_loaded",
        section: "words",
        offset: 20,
        outcome: ok({ items: [], nextOffset: null }),
      }),
    ).toEqual(initialProgress);
  });
});

describe("nextPageOffset", () => {
  const more = ready({ history: { items: [historyItemWith()], nextOffset: 20 } });

  it("gives the next offset of the section", () => {
    expect(nextPageOffset(more, "history", "auto")).toBe(20);
  });

  it("gives null on the last page and while not ready", () => {
    expect(nextPageOffset(more, "words", "auto")).toBeNull();
    expect(nextPageOffset(initialProgress, "history", "auto")).toBeNull();
  });

  it("gives null while a page is loading", () => {
    const loading = progressReducer(more, { type: "more_started", section: "history" });
    expect(nextPageOffset(loading, "history", "auto")).toBeNull();
    expect(nextPageOffset(loading, "history", "retry")).toBeNull();
  });

  it("gives null after a failure in auto mode and the offset in retry mode", () => {
    const failed = progressReducer(more, {
      type: "more_loaded",
      section: "history",
      offset: 20,
      outcome: { ok: false, failure: "network" },
    });
    expect(nextPageOffset(failed, "history", "auto")).toBeNull();
    expect(nextPageOffset(failed, "history", "retry")).toBe(20);
  });
});

describe("monthTiles", () => {
  it("labels Sessions, Corrections and New words in that order", () => {
    expect(monthTiles(month)).toEqual([
      { label: "Sessions", value: "12" },
      { label: "Corrections", value: "31" },
      { label: "New words", value: "48" },
    ]);
  });

  it("draws zeros as 0", () => {
    expect(monthTiles(zeros).map((tile) => tile.value)).toEqual(["0", "0", "0"]);
  });
});

describe("historyLine", () => {
  it("writes 14 messages · 3 corrections", () => {
    expect(historyLine(14, 3)).toBe("14 messages · 3 corrections");
  });

  it("writes 1 message · 1 correction", () => {
    expect(historyLine(1, 1)).toBe("1 message · 1 correction");
  });

  it("writes 0 corrections", () => {
    expect(historyLine(8, 0)).toBe("8 messages · 0 corrections");
  });
});

describe("timesLabel", () => {
  it("writes 5 times", () => {
    expect(timesLabel(5)).toBe("5 times");
  });

  it("writes 1 time", () => {
    expect(timesLabel(1)).toBe("1 time");
  });
});

describe("progressRows", () => {
  it("maps history to SessionCard rows: id, title, topic icon (chat for none), Nov 5 date and the line", () => {
    const state = ready({
      history: {
        items: [
          historyItemWith(
            { day: "2026-11-05", messageCount: 14, correctionCount: 3 },
            { id: "s-1" },
          ),
          historyItemWith({}, { id: "s-2", topicId: "music" }),
        ],
        nextOffset: null,
      },
    });
    const rows = progressRows(state, "history");
    expect(rows[0]).toEqual({
      kind: "history",
      key: "s-1",
      id: "s-1",
      title: "Tell me about yourself",
      date: "Nov 5",
      line: "14 messages · 3 corrections",
      icon: "chat",
    });
    expect(rows[1]).toMatchObject({ icon: "note" });
  });

  it("maps mistakes to cards with the rule, Other for a null rule, the times label and the example", () => {
    const state = ready({
      mistakes: {
        items: [
          mistakeGroupWith({
            rule: "Articles",
            times: 5,
            latest: { original: "a apple", corrected: "an apple" },
          }),
          mistakeGroupWith({ rule: null, times: 1 }),
        ],
        nextOffset: null,
      },
    });
    const rows = progressRows(state, "mistakes");
    expect(rows[0]).toMatchObject({
      kind: "mistake",
      rule: "Articles",
      times: "5 times",
      original: "a apple",
      corrected: "an apple",
    });
    expect(rows[1]).toMatchObject({ rule: "Other", times: "1 time" });
  });

  it("keeps the Other group key apart from a rule named None", () => {
    const state = ready({
      mistakes: {
        items: [mistakeGroupWith({ rule: "None" }), mistakeGroupWith({ rule: null })],
        nextOffset: null,
      },
    });
    const keys = progressRows(state, "mistakes").map((row) => row.key);
    expect(new Set(keys).size).toBe(2);
    expect(keys[1]).toBe("other");
    expect(keys[0]).toBe("rule:none");
  });

  it("maps words to cards with the word, the quoted sentence with its white space collapsed and the date", () => {
    const state = ready({
      words: {
        items: [
          newWordWith({
            word: "catchy",
            sentence: "  That song\n is   catchy. ",
            day: "2026-11-09",
          }),
        ],
        nextOffset: null,
      },
    });
    expect(progressRows(state, "words")).toEqual([
      {
        kind: "word",
        key: "catchy",
        word: "catchy",
        sentence: '"That song is catchy."',
        date: "Nov 9",
      },
    ]);
  });

  it("returns no rows for an empty section and while not ready", () => {
    expect(progressRows(ready(), "history")).toEqual([]);
    expect(progressRows(ready(), "mistakes")).toEqual([]);
    expect(progressRows(ready(), "words")).toEqual([]);
    expect(progressRows(ready(), "notes")).toEqual([]);
    expect(progressRows(initialProgress, "history")).toEqual([]);
  });
});

describe("emptyText", () => {
  it("shows No notes yet. on an empty Notes section", () => {
    expect(emptyText("notes")).toBe("No notes yet.");
  });

  it("says No finished chats yet., No mistakes yet. and No new words yet.", () => {
    expect(emptyText("history")).toBe("No finished chats yet.");
    expect(emptyText("mistakes")).toBe("No mistakes yet.");
    expect(emptyText("words")).toBe("No new words yet.");
  });
});

describe("progressSections", () => {
  it("lists History, Mistakes, Words and Notes in the design's order", () => {
    expect(progressSections).toEqual([
      { id: "history", label: "History" },
      { id: "mistakes", label: "Mistakes" },
      { id: "words", label: "Words" },
      { id: "notes", label: "Notes" },
    ]);
  });

  it("adds Notes as the fourth section", () => {
    expect(progressSections.map((section) => section.id)).toEqual([
      "history",
      "mistakes",
      "words",
      "notes",
    ]);
    expect(progressSections[3]?.label).toBe("Notes");
  });
});

describe("the Notes section", () => {
  it("fails Progress when the notes read fails", () => {
    expect(
      progressFromReads(ok(month), historyPage(), mistakePage(), wordPage(), {
        ok: false,
        failure: "unavailable",
      }),
    ).toEqual({ kind: "failed", failure: "unavailable" });
  });

  it("lists notes newest first as the API sends them", () => {
    const state = ready({
      notes: {
        items: [noteItem("b", "2026-11-07"), noteItem("a", "2026-11-05")],
        nextOffset: null,
        today: "2026-11-07",
      },
    });
    expect(progressRows(state, "notes").map((row) => row.key)).toEqual(["b", "a"]);
  });

  it("draws a note row with its kind and topic, icon and date", () => {
    const state = ready({
      notes: {
        items: [noteItem("a", "2026-11-05"), noteItem("b", "2026-11-04", "summary")],
        nextOffset: null,
        today: "2026-11-07",
      },
    });
    const rows = progressRows(state, "notes");
    expect(rows[0]).toEqual({
      kind: "note",
      key: "a",
      id: "a",
      title: "Note a",
      subtitle: "Table · Going to, will",
      date: "Nov 5",
      icon: "table",
    });
    expect(rows[1]).toMatchObject({ subtitle: "Summary · Going to, will", icon: "list" });
  });

  it("reads Today for a note of today", () => {
    const state = ready({
      notes: { items: [noteItem("a", "2026-11-07")], nextOffset: null, today: "2026-11-07" },
    });
    expect(progressRows(state, "notes")[0]).toMatchObject({ date: "Today" });
  });

  it("appends the next notes page, skips ids already listed and takes the newest today", () => {
    const state = readyOnly(
      progressReducer(
        ready({ notes: { items: [noteItem("a")], nextOffset: 20, today: "2026-11-07" } }),
        {
          type: "more_loaded",
          section: "notes",
          offset: 20,
          outcome: ok({
            items: [noteItem("a"), noteItem("b")],
            nextOffset: null,
            today: "2026-11-08",
          }),
        },
      ),
    );
    expect(state.notes.items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(state.notes.nextOffset).toBeNull();
    expect(state.notes.today).toBe("2026-11-08");
  });

  it("drops a stale notes page", () => {
    const start = ready({
      notes: { items: [noteItem("a")], nextOffset: 20, today: "2026-11-07" },
    });
    const state = progressReducer(start, {
      type: "more_loaded",
      section: "notes",
      offset: 40,
      outcome: ok({ items: [noteItem("z")], nextOffset: null, today: "2026-11-07" }),
    });
    expect(state).toEqual(start);
  });

  it("keeps the notes and stores the failure when the next page fails", () => {
    const start = ready({
      notes: { items: [noteItem("a")], nextOffset: 20, today: "2026-11-07" },
    });
    const state = readyOnly(
      progressReducer(start, {
        type: "more_loaded",
        section: "notes",
        offset: 20,
        outcome: { ok: false, failure: "network" },
      }),
    );
    expect(state.notes.items).toHaveLength(1);
    expect(state.notes.moreFailure).toBe("network");
    expect(state.notes.today).toBe("2026-11-07");
  });

  it("gives the next notes offset", () => {
    const start = ready({
      notes: { items: [noteItem("a")], nextOffset: 20, today: "2026-11-07" },
    });
    expect(nextPageOffset(start, "notes", "auto")).toBe(20);
    const loading = progressReducer(start, { type: "more_started", section: "notes" });
    expect(nextPageOffset(loading, "notes", "retry")).toBeNull();
  });
});
