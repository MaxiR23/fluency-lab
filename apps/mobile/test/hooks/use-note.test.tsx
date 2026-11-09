// apps/mobile/test/hooks/use-note.test.tsx
//
// Tests for the note hook.
//
// Tested:
// - The note is read once and the state is ready
// - A failed read is a failed state; without an id nothing is read and the state is failed as not_found
// - retry goes back to loading and reads again
// - remove deletes the note and reports it done; a failed delete keeps the note with the failure
//
// What is covered:
// - Normal case, edges (a note always exists or is not_found, so there is no expected empty)
//
// Run with: pnpm exec jest apps/mobile/test/hooks/use-note.test.tsx
//
// SEE: apps/mobile/src/hooks/use-note.ts

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useNote } from "@/hooks/use-note";
import { fakeData, noteWith, resetFakeData } from "../helpers/fake-data";
import { failThenHold } from "../helpers/fail-then-hold";

jest.mock("@/data", () => ({
  data: jest.requireActual<typeof import("../helpers/fake-data")>("../helpers/fake-data").fakeData,
}));

describe("useNote", () => {
  beforeEach(() => {
    resetFakeData();
  });

  it("reads the note once", async () => {
    const note = noteWith({ title: "Present perfect" });
    fakeData.getNote.mockResolvedValue({ ok: true, value: note });
    const { result } = await renderHook(() => useNote("note-1"));
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    expect(result.current.state).toEqual({
      kind: "ready",
      note,
      deleting: false,
      deleteFailure: null,
    });
    expect(fakeData.getNote).toHaveBeenCalledWith("note-1");
    expect(fakeData.getNote).toHaveBeenCalledTimes(1);
  });

  it("is failed with the failure of the read", async () => {
    fakeData.getNote.mockResolvedValue({ ok: false, failure: "not_found" });
    const { result } = await renderHook(() => useNote("note-1"));
    await waitFor(() => expect(result.current.state.kind).toBe("failed"));
    expect(result.current.state).toEqual({ kind: "failed", failure: "not_found" });
  });

  it("fails with not_found without an id and reads nothing", async () => {
    const { result } = await renderHook(() => useNote(null));
    expect(result.current.state).toEqual({ kind: "failed", failure: "not_found" });
    await act(async () => result.current.retry());
    await act(async () => result.current.remove());
    expect(fakeData.getNote).not.toHaveBeenCalled();
    expect(fakeData.deleteNote).not.toHaveBeenCalled();
  });

  it("retries the read", async () => {
    fakeData.getNote.mockResolvedValueOnce({ ok: false, failure: "network" });
    const { result } = await renderHook(() => useNote("note-1"));
    await waitFor(() => expect(result.current.state.kind).toBe("failed"));
    await act(async () => result.current.retry());
    expect(result.current.state.kind).toBe("ready");
    expect(fakeData.getNote).toHaveBeenCalledTimes(2);
  });

  it("deletes and reports done", async () => {
    const { result } = await renderHook(() => useNote("note-1"));
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    await act(async () => result.current.remove());
    expect(fakeData.deleteNote).toHaveBeenCalledWith("note-1");
    expect(result.current.state).toEqual({ kind: "deleted" });
  });

  it("keeps the note with the failure when the delete fails", async () => {
    fakeData.deleteNote.mockResolvedValue({ ok: false, failure: "network" });
    const { result } = await renderHook(() => useNote("note-1"));
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    await act(async () => result.current.remove());
    expect(result.current.state).toMatchObject({
      kind: "ready",
      deleting: false,
      deleteFailure: "network",
    });
  });

  it("keeps the network failure, retrying, while Try again reads again", async () => {
    const reread = failThenHold(fakeData.getNote, { ok: false, failure: "network" });
    const { result } = await renderHook(() => useNote("note-1"));
    await waitFor(() => expect(result.current.state.kind).toBe("failed"));
    let pending: Promise<void> = Promise.resolve();
    await act(async () => {
      pending = result.current.retry();
    });
    expect(result.current.state).toEqual({ kind: "failed", failure: "network", retrying: true });
    reread.release();
    await act(async () => pending);
    expect(result.current.state.kind).toBe("ready");
  });
});
