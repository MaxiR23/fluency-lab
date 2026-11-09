// apps/mobile/test/utils/rename-sheet.test.ts
//
// Tests for the pure logic of the rename sheet.
//
// Tested:
// - renameSheetReducer: open with the title, type (capped at 60), save, fail and close
// - canSaveTitle: the trimmed title is 1 to 60 characters and differs from the original
// - titleCount and renameSheetView: the count, Save, saving and the failure message
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/rename-sheet.test.ts
//
// SEE: apps/mobile/src/utils/rename-sheet.ts

import { describe, expect, it } from "@jest/globals";

import { dataFailureMessage } from "@/utils/data-message";
import {
  canSaveTitle,
  renameSheetReducer,
  renameSheetView,
  titleCount,
  type RenameSheetEvent,
  type RenameSheetState,
} from "@/utils/rename-sheet";

const closed: RenameSheetState = { kind: "closed" };

function opened(title = "Ramen spots in Tokyo"): RenameSheetState {
  return renameSheetReducer(closed, { type: "opened", sessionId: "s1", title });
}

function apply(state: RenameSheetState, ...events: RenameSheetEvent[]): RenameSheetState {
  return events.reduce(renameSheetReducer, state);
}

describe("renameSheetReducer and renameSheetView", () => {
  it("opens with the current title, its count and Save disabled", () => {
    const view = renameSheetView(opened());
    expect(view).toEqual({
      value: "Ramen spots in Tokyo",
      count: "20/60",
      canSave: false,
      saving: false,
      failure: null,
    });
  });

  it("enables Save once the title changes", () => {
    const view = renameSheetView(apply(opened(), { type: "draft_changed", text: "Tokyo ramen" }));
    expect(view?.canSave).toBe(true);
    expect(view?.value).toBe("Tokyo ramen");
    expect(view?.count).toBe("11/60");
  });

  it("disables Save for an empty or blank title", () => {
    expect(renameSheetView(apply(opened(), { type: "draft_changed", text: "" }))?.canSave).toBe(
      false,
    );
    expect(renameSheetView(apply(opened(), { type: "draft_changed", text: "   " }))?.canSave).toBe(
      false,
    );
  });

  it("disables Save for a title that only adds spaces", () => {
    const view = renameSheetView(
      apply(opened("Ramen"), { type: "draft_changed", text: "  Ramen  " }),
    );
    expect(view?.canSave).toBe(false);
  });

  it("caps the draft at 60 characters", () => {
    const state = apply(opened(), { type: "draft_changed", text: "a".repeat(61) });
    expect(renameSheetView(state)?.value).toBe("a".repeat(60));
  });

  it("counts 60/60 at the limit", () => {
    expect(titleCount("a".repeat(60))).toBe("60/60");
  });

  it("counts 0/60 for an empty title", () => {
    expect(titleCount("")).toBe("0/60");
  });

  it("keeps the typed title and shows the failure after a failed save", () => {
    const state = apply(
      opened(),
      { type: "draft_changed", text: "Tokyo ramen" },
      { type: "save_started" },
      { type: "save_failed", failure: "unavailable" },
    );
    const view = renameSheetView(state);
    expect(view?.value).toBe("Tokyo ramen");
    expect(view?.failure).toBe(dataFailureMessage("unavailable"));
    expect(view?.saving).toBe(false);
    expect(view?.canSave).toBe(true);
  });

  it("clears the failure when the title changes", () => {
    const state = apply(
      opened(),
      { type: "save_started" },
      { type: "save_failed", failure: "network" },
      { type: "draft_changed", text: "Other" },
    );
    expect(renameSheetView(state)?.failure).toBeNull();
  });

  it("closes on closed", () => {
    expect(apply(opened(), { type: "closed" })).toEqual(closed);
    expect(renameSheetView(apply(opened(), { type: "closed" }))).toBeNull();
  });

  it("ignores events while closed", () => {
    expect(apply(closed, { type: "draft_changed", text: "x" })).toBe(closed);
    expect(apply(closed, { type: "save_started" })).toBe(closed);
    expect(apply(closed, { type: "save_failed", failure: "network" })).toBe(closed);
  });

  it("disables Save while saving", () => {
    const state = apply(
      opened(),
      { type: "draft_changed", text: "Tokyo ramen" },
      { type: "save_started" },
    );
    const view = renameSheetView(state);
    expect(view?.saving).toBe(true);
    expect(view?.canSave).toBe(false);
  });
});

describe("canSaveTitle", () => {
  it("accepts a changed title of 1 to 60 characters", () => {
    expect(canSaveTitle("New", "Old")).toBe(true);
    expect(canSaveTitle("a", "Old")).toBe(true);
    expect(canSaveTitle("a".repeat(60), "Old")).toBe(true);
  });

  it("rejects an empty, blank, unchanged or over-long title", () => {
    expect(canSaveTitle("", "Old")).toBe(false);
    expect(canSaveTitle("  ", "Old")).toBe(false);
    expect(canSaveTitle("Old", "Old")).toBe(false);
    expect(canSaveTitle("a".repeat(61), "Old")).toBe(false);
  });
});
