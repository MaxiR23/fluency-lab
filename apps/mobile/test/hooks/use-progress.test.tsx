// apps/mobile/test/hooks/use-progress.test.tsx
//
// Tests for the Progress hook.
//
// Tested:
// - The month and the three first pages (in the device zone) read on focus
// - History is the first section, and select switches it
// - A failed read leaves the hook failed and retry reads all four again
// - The next page of the selected section loads from its next offset and is appended
// - No read on the last page, and no automatic read after a next-page failure
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/hooks/use-progress.test.tsx
//
// SEE: apps/mobile/src/hooks/use-progress.ts

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useIsFocused } from "expo-router";

import { useProgress } from "@/hooks/use-progress";
import { fakeData, historyItemWith, newWordWith, resetFakeData } from "../helpers/fake-data";

jest.mock("expo-router", () => ({ useIsFocused: jest.fn(() => true) }));
jest.mock("@/utils/time-zone", () => ({ deviceTimeZone: jest.fn(() => "America/Lima") }));
jest.mock("@/data", () => ({
  data: jest.requireActual<typeof import("../helpers/fake-data")>("../helpers/fake-data").fakeData,
}));

async function ready() {
  const hook = await renderHook(() => useProgress());
  await waitFor(() => expect(hook.result.current.state.kind).toBe("ready"));
  return hook;
}

function firstHistoryPage() {
  fakeData.listHistory.mockResolvedValueOnce({
    ok: true,
    value: { items: [historyItemWith({}, { id: "session-1" })], nextOffset: 20 },
  });
}

describe("useProgress", () => {
  beforeEach(() => {
    resetFakeData();
    jest.mocked(useIsFocused).mockReturnValue(true);
  });

  it("reads the month and the three first pages in the device zone on focus", async () => {
    await ready();

    expect(fakeData.getMonthProgress).toHaveBeenCalledWith("America/Lima");
    expect(fakeData.listHistory).toHaveBeenCalledWith("America/Lima", 0);
    expect(fakeData.listMistakes).toHaveBeenCalledWith(0);
    expect(fakeData.listWords).toHaveBeenCalledWith("America/Lima", 0);
    expect(fakeData.listNotes).toHaveBeenCalledWith("America/Lima", 0);
  });

  it("starts on History and switches section on select", async () => {
    const { result } = await ready();
    expect(result.current.section).toBe("history");

    await act(async () => result.current.select("words"));

    expect(result.current.section).toBe("words");
  });

  it("is failed when a read fails and reads all four again on retry", async () => {
    fakeData.listMistakes.mockResolvedValueOnce({ ok: false, failure: "network" });
    const { result } = await renderHook(() => useProgress());
    await waitFor(() =>
      expect(result.current.state).toEqual({ kind: "failed", failure: "network" }),
    );

    await act(async () => result.current.retry());

    expect(result.current.state.kind).toBe("ready");
    expect(fakeData.getMonthProgress).toHaveBeenCalledTimes(2);
    expect(fakeData.listHistory).toHaveBeenCalledTimes(2);
    expect(fakeData.listMistakes).toHaveBeenCalledTimes(2);
    expect(fakeData.listWords).toHaveBeenCalledTimes(2);
  });

  it("loads the next page of the selected section from its next offset and appends it", async () => {
    firstHistoryPage();
    fakeData.listHistory.mockResolvedValueOnce({
      ok: true,
      value: { items: [historyItemWith({}, { id: "session-2" })], nextOffset: null },
    });
    const { result } = await ready();

    await act(async () => result.current.loadMore());

    expect(fakeData.listHistory).toHaveBeenLastCalledWith("America/Lima", 20);
    const state = result.current.state;
    if (state.kind !== "ready") throw new Error("expected a ready state");
    expect(state.history.items.map((item) => item.session.id)).toEqual(["session-1", "session-2"]);
    expect(state.history.nextOffset).toBeNull();
  });

  it("loads the next page of the words section when it is selected", async () => {
    fakeData.listWords.mockResolvedValueOnce({
      ok: true,
      value: { items: [newWordWith({ word: "catchy" })], nextOffset: 20 },
    });
    const { result } = await ready();
    await act(async () => result.current.select("words"));

    await act(async () => result.current.loadMore());

    expect(fakeData.listWords).toHaveBeenLastCalledWith("America/Lima", 20);
  });

  it("loads the next page of the notes section when it is selected", async () => {
    fakeData.listNotes.mockResolvedValueOnce({
      ok: true,
      value: {
        items: [{ id: "n1", kind: "table", title: "T", topic: "P", day: "2026-11-05" }],
        nextOffset: 20,
        today: "2026-11-05",
      },
    });
    const { result } = await ready();
    await act(async () => result.current.select("notes"));

    await act(async () => result.current.loadMore());

    expect(fakeData.listNotes).toHaveBeenLastCalledWith("America/Lima", 20);
  });

  it("fails when the notes read fails", async () => {
    fakeData.listNotes.mockResolvedValueOnce({ ok: false, failure: "network" });
    const hook = await renderHook(() => useProgress());
    await waitFor(() => expect(hook.result.current.state.kind).toBe("failed"));
    expect(hook.result.current.state).toEqual({ kind: "failed", failure: "network" });
  });

  it("does not read when the section is on its last page", async () => {
    const { result } = await ready();

    await act(async () => result.current.loadMore());

    expect(fakeData.listHistory).toHaveBeenCalledTimes(1);
  });

  it("does not read again automatically after a next-page failure, and reads on retryMore", async () => {
    firstHistoryPage();
    fakeData.listHistory.mockResolvedValueOnce({ ok: false, failure: "network" });
    const { result } = await ready();
    await act(async () => result.current.loadMore());
    expect(fakeData.listHistory).toHaveBeenCalledTimes(2);

    await act(async () => result.current.loadMore());
    expect(fakeData.listHistory).toHaveBeenCalledTimes(2);

    await act(async () => result.current.retryMore());
    expect(fakeData.listHistory).toHaveBeenCalledTimes(3);
    expect(fakeData.listHistory).toHaveBeenLastCalledWith("America/Lima", 20);
  });
});
