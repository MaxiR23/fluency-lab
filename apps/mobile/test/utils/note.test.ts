// apps/mobile/test/utils/note.test.ts
//
// Tests for the pure functions of the note screen, the chat card and the Progress note rows.
//
// Tested:
// - notePreview, noteSubtitle, noteIcon, noteTag and noteDate
// - noteParams reads the note id from the route params
// - noteReducer: load, ready, failed, delete started, failed and done
// - deleteNotePrompt asks before deleting
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/note.test.ts
//
// SEE: apps/mobile/src/utils/note.ts

import { describe, expect, it, jest } from "@jest/globals";
import type { StudyNote } from "@fluency-lab/shared";

import {
  deleteNotePrompt,
  initialNote,
  noteDate,
  noteIcon,
  noteParams,
  notePreview,
  noteReducer,
  noteTable,
  noteSubtitle,
  noteTag,
  type NoteState,
} from "@/utils/note";

const base = {
  id: "n1",
  sessionId: "s1",
  sessionTitle: "Free chat" as string | null,
  title: "Future forms",
  topic: "Going to, will",
  createdAt: "2026-11-05T10:00:00Z",
};

function tableOf(rows: number): StudyNote {
  return {
    ...base,
    kind: "table",
    content: {
      columns: ["Form", "When", "Example"],
      rows: Array.from({ length: rows }, (_, i) => [`form${i}`, `when${i}`, `example${i}`]),
      remember: "r",
    },
  };
}

function summaryOf(points: number): StudyNote {
  return {
    ...base,
    kind: "summary",
    content: { points: Array.from({ length: points }, (_, i) => `point${i}`), remember: "r" },
  };
}

describe("notePreview", () => {
  it("previews the first three rows with their first cell as the lead", () => {
    expect(notePreview(tableOf(5))).toEqual([
      { lead: "form0", text: "when0" },
      { lead: "form1", text: "when1" },
      { lead: "form2", text: "when2" },
    ]);
  });

  it("previews the first three points with no lead", () => {
    expect(notePreview(summaryOf(4))).toEqual([
      { lead: null, text: "point0" },
      { lead: null, text: "point1" },
      { lead: null, text: "point2" },
    ]);
  });

  it("previews all rows of a note with fewer than three", () => {
    expect(notePreview(tableOf(1))).toEqual([{ lead: "form0", text: "when0" }]);
    expect(notePreview(summaryOf(2))).toHaveLength(2);
  });

  it("keeps exactly three at the edge", () => {
    expect(notePreview(tableOf(3))).toHaveLength(3);
    expect(notePreview(tableOf(4))).toHaveLength(3);
  });
});

describe("noteSubtitle, noteIcon and noteTag", () => {
  it("joins the kind and the topic", () => {
    expect(noteSubtitle("table", "Going to, will")).toBe("Table · Going to, will");
    expect(noteSubtitle("summary", "Present perfect")).toBe("Summary · Present perfect");
  });

  it("draws a table icon for a table and a list icon for a summary", () => {
    expect(noteIcon("table")).toBe("table");
    expect(noteIcon("summary")).toBe("list");
  });

  it("names the chat a note came from", () => {
    expect(noteTag(tableOf(1))).toBe("Grammar · from Free chat");
  });

  it("reads Grammar alone with no session", () => {
    expect(noteTag({ sessionTitle: null })).toBe("Grammar");
  });
});

describe("noteDate", () => {
  it("reads Today on the page's today", () => {
    expect(noteDate("2026-11-07", "2026-11-07")).toBe("Today");
  });

  it("reads a short date on another day", () => {
    expect(noteDate("2026-11-06", "2026-11-07")).toBe("Nov 6");
    expect(noteDate("2026-11-08", "2026-11-07")).toBe("Nov 8");
  });
});

describe("noteParams", () => {
  it("reads the note id from the route params", () => {
    expect(noteParams({ id: "n1" })).toBe("n1");
  });

  it("reads the first of an array", () => {
    expect(noteParams({ id: ["n1", "n2"] })).toBe("n1");
  });

  it("returns null when there is no id", () => {
    expect(noteParams({})).toBeNull();
    expect(noteParams({ id: [] })).toBeNull();
  });
});

describe("noteReducer", () => {
  const ready: NoteState = {
    kind: "ready",
    note: tableOf(1),
    deleting: false,
    deleteFailure: null,
  };

  it("starts failed with not_found without an id and loading with one", () => {
    expect(initialNote(null)).toEqual({ kind: "failed", failure: "not_found" });
    expect(initialNote("n1")).toEqual({ kind: "loading" });
  });

  it("becomes ready when the note loads", () => {
    expect(
      noteReducer({ kind: "loading" }, { type: "loaded", note: { ok: true, value: tableOf(1) } }),
    ).toEqual(ready);
  });

  it("fails with the failure of the read", () => {
    expect(
      noteReducer(
        { kind: "loading" },
        { type: "loaded", note: { ok: false, failure: "not_found" } },
      ),
    ).toEqual({ kind: "failed", failure: "not_found" });
  });

  it("goes back to loading", () => {
    expect(
      noteReducer({ kind: "failed", failure: "unavailable" }, { type: "load_started" }),
    ).toEqual({
      kind: "loading",
    });
  });

  it("starts deleting only from ready and idle", () => {
    const started = noteReducer(ready, { type: "delete_started" });
    expect(started).toMatchObject({ kind: "ready", deleting: true, deleteFailure: null });
    expect(noteReducer(started, { type: "delete_started" })).toBe(started);
    const loading: NoteState = { kind: "loading" };
    expect(noteReducer(loading, { type: "delete_started" })).toBe(loading);
  });

  it("keeps the note with the failure when the delete fails", () => {
    const deleting = noteReducer(ready, { type: "delete_started" });
    expect(noteReducer(deleting, { type: "delete_failed", failure: "network" })).toEqual({
      ...ready,
      deleting: false,
      deleteFailure: "network",
    });
  });

  it("clears the failure when the delete starts again", () => {
    const failed = noteReducer(noteReducer(ready, { type: "delete_started" }), {
      type: "delete_failed",
      failure: "network",
    });
    expect(noteReducer(failed, { type: "delete_started" })).toMatchObject({
      deleting: true,
      deleteFailure: null,
    });
  });

  it("is deleted when the delete is done", () => {
    const deleting = noteReducer(ready, { type: "delete_started" });
    expect(noteReducer(deleting, { type: "delete_done" })).toEqual({ kind: "deleted" });
  });
});

describe("deleteNotePrompt", () => {
  it("asks before deleting with Cancel and Delete", () => {
    const onDelete = jest.fn();
    const prompt = deleteNotePrompt(onDelete);
    expect(prompt.title).toBe("Delete this note?");
    expect(prompt.message).toBe("This can't be undone.");
    expect(prompt.buttons.map((button) => [button.text, button.style])).toEqual([
      ["Cancel", "cancel"],
      ["Delete", "destructive"],
    ]);
    expect(onDelete).not.toHaveBeenCalled();
    prompt.buttons[1]?.onPress?.();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

describe("noteTable", () => {
  it("gives a table note its columns and rows unchanged", () => {
    const note: StudyNote = {
      ...base,
      kind: "table",
      content: {
        columns: ["Form", "Use", "Example"],
        rows: [
          ["going to", "plans", "I am going to eat"],
          ["will", "offers", "I will help"],
        ],
        remember: "r",
      },
    };
    expect(noteTable(note)).toEqual({
      columns: ["Form", "Use", "Example"],
      rows: [
        ["going to", "plans", "I am going to eat"],
        ["will", "offers", "I will help"],
      ],
    });
  });

  it("gives a summary no header and one single-cell row per point, in order", () => {
    const note: StudyNote = {
      ...base,
      kind: "summary",
      content: { points: ["one", "two", "three"], remember: "r" },
    };
    expect(noteTable(note)).toEqual({ columns: null, rows: [["one"], ["two"], ["three"]] });
  });

  it("handles a summary with one point and a table with one row", () => {
    const summary: StudyNote = {
      ...base,
      kind: "summary",
      content: { points: ["only"], remember: "r" },
    };
    expect(noteTable(summary)).toEqual({ columns: null, rows: [["only"]] });
    const table: StudyNote = {
      ...base,
      kind: "table",
      content: { columns: ["A", "B", "C"], rows: [["x", "y", "z"]], remember: "r" },
    };
    expect(noteTable(table)).toEqual({ columns: ["A", "B", "C"], rows: [["x", "y", "z"]] });
  });
});

describe("noteReducer Try again", () => {
  const network = { kind: "failed", failure: "network" } as const;

  it("keeps a network failure on screen as retrying when Try again starts", () => {
    expect(noteReducer(network, { type: "load_started" })).toEqual({
      kind: "failed",
      failure: "network",
      retrying: true,
    });
  });

  it("goes back to loading when Try again starts after a failure that is not the network", () => {
    expect(
      noteReducer({ kind: "failed", failure: "unavailable" }, { type: "load_started" }),
    ).toEqual({ kind: "loading" });
  });

  it("draws the data when the retried read succeeds", () => {
    const retrying = noteReducer(network, { type: "load_started" });
    expect(
      noteReducer(retrying, { type: "loaded", note: { ok: true, value: tableOf(1) } }).kind,
    ).toBe("ready");
  });

  it("draws a fresh failure, not retrying, when the retried read fails again", () => {
    const retrying = noteReducer(network, { type: "load_started" });
    const again = noteReducer(retrying, {
      type: "loaded",
      note: { ok: false, failure: "network" },
    });
    expect(again).toEqual({ kind: "failed", failure: "network" });
    expect(again).not.toHaveProperty("retrying");
  });
});
