// apps/mobile/test/app/note.test.tsx
//
// Tests for the Note screen.
//
// Tested:
// - Loading, a table (header row, rows, Remember), a summary, and the tag with the chat the note came from
// - The failed state with Try again, for not found and for a server error
// - Delete asks first, deletes on Delete and goes back, keeps the note on Cancel, and shows a failed delete
// - Practice this starts a practice of five on the note
// - The rows are drawn in place with reduce motion
// - No expected empty state: a note always has rows or points, the schema requires at least one
//
// What is covered:
// - Normal case, error states, edges
//
// Run with: pnpm exec jest apps/mobile/test/app/note.test.tsx
//
// SEE: apps/mobile/src/app/note.tsx

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { Alert, type AlertButton } from "react-native";
import * as Reanimated from "react-native-reanimated";

import { dataFailureMessage } from "@/utils/data-message";
import { offlineCardBody, retryingLabel } from "@/utils/load-failure";
import { fakeSession, resetFakeAuth } from "../helpers/fake-auth";
import { fakeData, noteWith, resetFakeData } from "../helpers/fake-data";
import { resetFakeKeys } from "../helpers/fake-keys";
import { renderAppAt } from "../helpers/render-app";

jest.mock("expo-font", () => ({ useFonts: jest.fn(() => [true, null]) }));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hide: jest.fn(),
}));
jest.mock("@/data", () => ({
  data: jest.requireActual<typeof import("../helpers/fake-data")>("../helpers/fake-data").fakeData,
}));
jest.mock("@/ai", () => ({
  ai: jest.requireActual<typeof import("../helpers/fake-ai")>("../helpers/fake-ai").fakeAi,
}));
jest.mock("@/keys", () => ({
  keys: jest.requireActual<typeof import("../helpers/fake-keys")>("../helpers/fake-keys").fakeKeys,
}));
jest.mock("@/auth", () => {
  const fake = jest.requireActual<typeof import("../helpers/fake-auth")>("../helpers/fake-auth");
  return { auth: fake.fakeAuth, apple: fake.fakeApple };
});

jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual<typeof Reanimated>("react-native-reanimated");
  return {
    ...actual,
    __esModule: true,
    default: actual.default,
    useReducedMotion: jest.fn(() => false),
  };
});

const open = { pathname: "/note", params: { id: "note-1" } } as const;

const summary = noteWith({
  kind: "summary",
  title: "Present perfect",
  topic: "Have + past participle",
  content: {
    points: ["Use it for experiences up to now.", "Use it for recent news."],
    remember: "Think of now.",
  },
});

function alertButtons(): AlertButton[] {
  return jest.mocked(Alert.alert).mock.calls.at(-1)?.[2] ?? [];
}

describe("Note", () => {
  beforeEach(() => {
    resetFakeAuth();
    resetFakeData();
    resetFakeKeys();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.mocked(Reanimated.useReducedMotion).mockReturnValue(false);
  });

  it("shows a spinner while the note loads", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof fakeData.getNote>>) => void;
    fakeData.getNote.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    await renderAppAt(open, fakeSession());
    expect(screen.getByTestId("note-loading")).toBeTruthy();
    await act(async () => resolve({ ok: true, value: noteWith() }));
    expect(screen.queryByTestId("note-loading")).toBeNull();
  });

  it("draws a table with its header row, its rows and the Remember box", async () => {
    await renderAppAt(open, fakeSession());
    expect(await screen.findByRole("header", { name: "Future forms" })).toBeTruthy();
    for (const label of ["Form", "When", "Example"]) expect(screen.getByText(label)).toBeTruthy();
    for (const cell of [
      "going to",
      "plans already made",
      "I'm going to study tonight.",
      "will",
      "decisions made now",
      "I'll help you with that.",
    ]) {
      expect(screen.getByText(cell)).toBeTruthy();
    }
    expect(screen.getByText("Remember")).toBeTruthy();
    expect(screen.getByText("Plans use going to; instant decisions use will.")).toBeTruthy();
    expect(screen.getByRole("header", { name: "Note" })).toBeTruthy();
  });

  it("draws a summary's points and the Remember box", async () => {
    fakeData.getNote.mockResolvedValue({ ok: true, value: summary });
    await renderAppAt(open, fakeSession());
    expect(await screen.findByText("Use it for experiences up to now.")).toBeTruthy();
    expect(screen.getByText("Use it for recent news.")).toBeTruthy();
    expect(screen.getByText("Remember")).toBeTruthy();
    expect(screen.getByText("Think of now.")).toBeTruthy();
    expect(screen.queryByTestId("table-header")).toBeNull();
  });

  it("tags a note with its chat", async () => {
    await renderAppAt(open, fakeSession());
    expect(await screen.findByText("Grammar · from Free chat")).toBeTruthy();
  });

  it("tags a note with no chat as Grammar", async () => {
    fakeData.getNote.mockResolvedValue({
      ok: true,
      value: noteWith({ sessionId: null, sessionTitle: null }),
    });
    await renderAppAt(open, fakeSession());
    expect(await screen.findByText("Grammar")).toBeTruthy();
  });

  it("asks before deleting, deletes on Delete and goes back", async () => {
    await renderAppAt(open, fakeSession());
    await screen.findByRole("header", { name: "Future forms" });
    await fireEvent.press(screen.getByRole("button", { name: "Delete note" }));

    expect(Alert.alert).toHaveBeenCalledWith(
      "Delete this note?",
      "This can't be undone.",
      expect.any(Array),
    );
    expect(fakeData.deleteNote).not.toHaveBeenCalled();
    await act(async () =>
      alertButtons()
        .find((button) => button.text === "Delete")
        ?.onPress?.(),
    );
    expect(fakeData.deleteNote).toHaveBeenCalledWith("note-1");
    expect(screen).toHavePathname("/");
  });

  it("does not delete on Cancel", async () => {
    await renderAppAt(open, fakeSession());
    await screen.findByRole("header", { name: "Future forms" });
    await fireEvent.press(screen.getByRole("button", { name: "Delete note" }));
    const cancel = alertButtons().find((button) => button.text === "Cancel");
    expect(cancel?.style).toBe("cancel");
    expect(fakeData.deleteNote).not.toHaveBeenCalled();
    expect(screen).toHavePathname("/note");
  });

  it("shows the delete failure and lets the trash be pressed again", async () => {
    fakeData.deleteNote.mockResolvedValueOnce({ ok: false, failure: "network" });
    await renderAppAt(open, fakeSession());
    await screen.findByRole("header", { name: "Future forms" });
    await fireEvent.press(screen.getByRole("button", { name: "Delete note" }));
    await act(async () =>
      alertButtons()
        .find((button) => button.text === "Delete")
        ?.onPress?.(),
    );
    expect(screen.getByText(dataFailureMessage("network"))).toBeTruthy();
    expect(screen.getByRole("header", { name: "Future forms" })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Delete note" }));
    expect(Alert.alert).toHaveBeenCalledTimes(2);
  });

  it("shows the not found text with Try again", async () => {
    fakeData.getNote.mockResolvedValueOnce({ ok: false, failure: "not_found" });
    await renderAppAt(open, fakeSession());
    expect(await screen.findByText(dataFailureMessage("not_found"))).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("header", { name: "Future forms" })).toBeTruthy();
    expect(fakeData.getNote).toHaveBeenCalledTimes(2);
  });

  it("shows the server error text", async () => {
    fakeData.getNote.mockResolvedValue({ ok: false, failure: "unavailable" });
    await renderAppAt(open, fakeSession());
    expect(await screen.findByText(dataFailureMessage("unavailable"))).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("draws the can't-connect card under the header when the read fails on the network", async () => {
    fakeData.getNote.mockResolvedValueOnce({ ok: false, failure: "network" });
    await renderAppAt(open, fakeSession());
    expect(await screen.findByRole("header", { name: "Can't load this note" })).toBeTruthy();
    expect(screen.getByText("Note")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    expect(screen.getByText(offlineCardBody)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByText(dataFailureMessage("network"))).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete note" })).toBeNull();
  });

  it("shows Trying again\u2026 while Try again reads, then draws the note when the server is back", async () => {
    let finish!: (value: Awaited<ReturnType<typeof fakeData.getNote>>) => void;
    fakeData.getNote.mockResolvedValueOnce({ ok: false, failure: "network" }).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await renderAppAt(open, fakeSession());
    await fireEvent.press(await screen.findByRole("button", { name: "Try again" }));
    expect(
      screen.getByRole("button", { name: "Try again", busy: true, disabled: true }),
    ).toBeTruthy();
    expect(screen.getByText(retryingLabel)).toBeTruthy();
    await act(async () => finish({ ok: true, value: noteWith({ title: "Future forms" }) }));
    expect(await screen.findByRole("header", { name: "Future forms" })).toBeTruthy();
    expect(screen.queryByText(retryingLabel)).toBeNull();
  });

  it("starts a practice of five on the note", async () => {
    await renderAppAt(open, fakeSession());
    await screen.findByRole("header", { name: "Future forms" });
    await fireEvent.press(screen.getByRole("button", { name: "Practice this · 5 exercises" }));

    expect(screen).toHavePathname("/practice-run");
    expect(screen).toHaveSearchParams({ focus: "note", note: "note-1", target: "5" });
  });

  it("slides the rows in, one after the other, when motion is on", async () => {
    await renderAppAt(open, fakeSession());
    await screen.findByRole("header", { name: "Future forms" });
    expect(screen.getByTestId("table-row-0").props.entering.getDelay()).toBe(100);
    expect(screen.getByTestId("table-row-1").props.entering.getDelay()).toBe(250);
  });

  it("draws the rows in place with reduce motion", async () => {
    jest.mocked(Reanimated.useReducedMotion).mockReturnValue(true);
    await renderAppAt(open, fakeSession());
    await screen.findByRole("header", { name: "Future forms" });
    expect(screen.getByTestId("table-row-0").props.entering).toBeUndefined();
    expect(screen.getByText("going to")).toBeTruthy();
  });
});
