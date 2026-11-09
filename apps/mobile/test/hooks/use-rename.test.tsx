// apps/mobile/test/hooks/use-rename.test.tsx
//
// Tests for the rename hook.
//
// Tested:
// - Save sends the trimmed title as the user's and hands the saved session to onSaved
// - A failed save (unavailable, not_found, network) keeps the sheet open with the typed title
// - An unchanged title is not saved, and Cancel closes without saving
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/hooks/use-rename.test.tsx
//
// SEE: apps/mobile/src/hooks/use-rename.ts

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";

import { useRename } from "@/hooks/use-rename";
import { dataFailureMessage } from "@/utils/data-message";
import { renameSheetView } from "@/utils/rename-sheet";
import { fakeData, resetFakeData } from "../helpers/fake-data";

jest.mock("@/data", () => ({
  data: jest.requireActual<typeof import("../helpers/fake-data")>("../helpers/fake-data").fakeData,
}));

async function opened(onSaved = jest.fn()) {
  const hook = await renderHook(() => useRename(onSaved));
  await act(async () => hook.result.current.open("session-1", "Free chat"));
  return { ...hook, onSaved };
}

describe("useRename", () => {
  beforeEach(() => {
    resetFakeData();
  });

  it("saves the trimmed title as the user's and hands back the session", async () => {
    const { result, onSaved } = await opened();
    await act(async () => result.current.change("  Weekend plans  "));
    await act(async () => result.current.save());

    expect(fakeData.setSessionTitle).toHaveBeenCalledWith("session-1", {
      title: "Weekend plans",
      source: "user",
    });
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Weekend plans", titleSource: "user" }),
    );
    expect(renameSheetView(result.current.sheet)).toBeNull();
  });

  it("keeps the sheet open with the failure when the save fails", async () => {
    fakeData.setSessionTitle.mockResolvedValue({ ok: false, failure: "unavailable" });
    const { result, onSaved } = await opened();
    await act(async () => result.current.change("Weekend plans"));
    await act(async () => result.current.save());

    const view = renameSheetView(result.current.sheet);
    expect(view?.failure).toBe(dataFailureMessage("unavailable"));
    expect(view?.value).toBe("Weekend plans");
    expect(view?.saving).toBe(false);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("keeps the sheet open with not_found when the chat is gone", async () => {
    fakeData.setSessionTitle.mockResolvedValue({ ok: false, failure: "not_found" });
    const { result } = await opened();
    await act(async () => result.current.change("Weekend plans"));
    await act(async () => result.current.save());
    expect(renameSheetView(result.current.sheet)?.failure).toBe(dataFailureMessage("not_found"));
  });

  it("keeps the sheet open with the network failure", async () => {
    fakeData.setSessionTitle.mockResolvedValue({ ok: false, failure: "network" });
    const { result } = await opened();
    await act(async () => result.current.change("Weekend plans"));
    await act(async () => result.current.save());
    expect(renameSheetView(result.current.sheet)?.failure).toBe(dataFailureMessage("network"));
  });

  it("does not save an unchanged title", async () => {
    const { result } = await opened();
    await act(async () => result.current.save());
    expect(fakeData.setSessionTitle).not.toHaveBeenCalled();
    expect(renameSheetView(result.current.sheet)).not.toBeNull();
  });

  it("closes without saving on cancel", async () => {
    const { result } = await opened();
    await act(async () => result.current.change("Weekend plans"));
    await act(async () => result.current.cancel());
    expect(fakeData.setSessionTitle).not.toHaveBeenCalled();
    expect(renameSheetView(result.current.sheet)).toBeNull();
  });
});
