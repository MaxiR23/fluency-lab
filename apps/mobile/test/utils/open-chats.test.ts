// apps/mobile/test/utils/open-chats.test.ts
//
// Tests for the Open chats state, its rows and the delete prompt.
//
// Tested:
// - openChatRow: title, icon, short time and a one-line preview of the last message
// - openChatsFromRead: ready, expected empty and failed
// - openChatsReducer: load, a row removed after End or Delete (also on not_found), the
//   last row removed, and an action failure that keeps the row
// - deletePromptButtons: Cancel and Delete, in that order
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/open-chats.test.ts
//
// SEE: apps/mobile/src/utils/open-chats.ts

import { describe, expect, it, jest } from "@jest/globals";

import type { DataOutcome } from "@/data/data-port";

import {
  deletePromptButtons,
  deletePromptMessage,
  deletePromptTitle,
  initialOpenChats,
  openChatRow,
  openChatsFromRead,
  openChatsReducer,
  type OpenChatsEvent,
  type OpenChatsState,
} from "@/utils/open-chats";
import { activeSessionWith } from "../helpers/fake-data";

const now = Date.parse("2026-11-05T12:00:00Z");
const loadedAt = now;
const first = activeSessionWith({ id: "s1" });
const second = activeSessionWith({ id: "s2" });
const third = activeSessionWith({ id: "s3" });

function ready(
  sessions = [first, second, third],
  actionFailure: "network" | null = null,
): OpenChatsState {
  return { kind: "ready", sessions, loadedAt, actionFailure };
}

describe("openChatRow", () => {
  it("shows the title, the topic icon, the short time of the last message and its text", () => {
    const open = activeSessionWith(
      { id: "s1", title: "Music", topicId: "music" },
      { createdAt: "2026-11-05T10:00:00Z", text: "What do you listen to?" },
    );
    expect(openChatRow(open, now)).toEqual({
      id: "s1",
      title: "Music",
      time: "2h",
      preview: "What do you listen to?",
      icon: "note",
    });
  });

  it("uses the chat icon for a free chat", () => {
    expect(openChatRow(first, now).icon).toBe("chat");
  });

  it("has no preview and takes the time from the session update when there is no message", () => {
    const open = activeSessionWith({ updatedAt: "2026-11-05T09:00:00Z" }, null);
    expect(openChatRow(open, now)).toMatchObject({ preview: null, time: "3h" });
  });

  it("collapses line breaks and repeated spaces into one line", () => {
    const open = activeSessionWith({}, { text: "  Hello\n\nthere   friend \n" });
    expect(openChatRow(open, now).preview).toBe("Hello there friend");
  });

  it("has no preview for a message of only spaces", () => {
    const open = activeSessionWith({}, { text: " \n  " });
    expect(openChatRow(open, now).preview).toBeNull();
  });

  it("has no time when the date cannot be read", () => {
    const open = activeSessionWith({}, { createdAt: "not a date" });
    expect(openChatRow(open, now).time).toBeNull();
  });
});

describe("openChatsFromRead", () => {
  it("is ready with the sessions in the order they came", () => {
    expect(openChatsFromRead({ ok: true, value: [second, first] }, loadedAt)).toEqual(
      ready([second, first]),
    );
  });

  it("is empty for no open sessions", () => {
    expect(openChatsFromRead({ ok: true, value: [] }, loadedAt)).toEqual({ kind: "empty" });
  });

  it("fails with the read failure", () => {
    expect(openChatsFromRead({ ok: false, failure: "unavailable" }, loadedAt)).toEqual({
      kind: "failed",
      failure: "unavailable",
    });
  });
});

describe("openChatsReducer", () => {
  const done = (sessionId: string, outcome: DataOutcome<unknown>): OpenChatsEvent => ({
    type: "action_done",
    sessionId,
    outcome,
  });
  const reduce = (state: OpenChatsState, outcome: DataOutcome<unknown>) =>
    openChatsReducer(state, done("s2", outcome));

  it("goes back to loading on load_started", () => {
    expect(openChatsReducer(ready(), { type: "load_started" })).toEqual(initialOpenChats);
  });

  it("becomes the state of the read on loaded", () => {
    expect(
      openChatsReducer(initialOpenChats, {
        type: "loaded",
        outcome: { ok: true, value: [first] },
        loadedAt,
      }),
    ).toEqual(ready([first]));
  });

  it("removes the ended or deleted session and keeps the others in order", () => {
    expect(reduce(ready(), { ok: true, value: {} })).toEqual(ready([first, third]));
  });

  it("removes the row when the session is already gone (not_found)", () => {
    expect(reduce(ready(), { ok: false, failure: "not_found" })).toEqual(ready([first, third]));
  });

  it("becomes empty when the last row is removed", () => {
    expect(reduce(ready([second]), { ok: true, value: {} })).toEqual({ kind: "empty" });
  });

  it("keeps the row and records the failure when End or Delete fails", () => {
    expect(reduce(ready(), { ok: false, failure: "network" })).toEqual(
      ready([first, second, third], "network"),
    );
  });

  it("clears the action failure after the next successful action and on loaded", () => {
    const failed = ready([first, second, third], "network");
    expect(reduce(failed, { ok: true, value: {} })).toEqual(ready([first, third]));
    expect(
      openChatsReducer(failed, {
        type: "loaded",
        outcome: { ok: true, value: [first, second, third] },
        loadedAt,
      }),
    ).toEqual(ready());
  });

  it("leaves the list unchanged for an id it does not hold", () => {
    expect(openChatsReducer(ready(), done("other", { ok: true, value: {} }))).toEqual(ready());
  });

  it("ignores an action result while loading or failed", () => {
    const failed: OpenChatsState = { kind: "failed", failure: "network" };
    expect(reduce(initialOpenChats, { ok: true, value: {} })).toEqual(initialOpenChats);
    expect(reduce(failed, { ok: true, value: {} })).toEqual(failed);
  });
});

describe("deletePromptButtons", () => {
  it("offers Cancel then Delete, Delete destructive, each calling its callback", () => {
    const onDelete = jest.fn();
    const onCancel = jest.fn();
    const buttons = deletePromptButtons(onDelete, onCancel);

    expect(buttons.map((b) => [b.text, b.style])).toEqual([
      ["Cancel", "cancel"],
      ["Delete", "destructive"],
    ]);
    buttons[0].onPress?.();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
    buttons[1].onPress?.();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("titles the prompt 'Delete this chat?' with 'This can't be undone.'", () => {
    expect(deletePromptTitle).toBe("Delete this chat?");
    expect(deletePromptMessage).toBe("This can't be undone.");
  });
});
