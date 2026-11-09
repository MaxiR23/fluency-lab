// apps/mobile/test/hooks/use-open-chats.test.tsx
//
// Tests for the Open chats hook.
//
// Tested:
// - The open sessions read from the data port, the expected empty and the failure
// - A read again on retry and on regaining focus, and a read that ends after unmount
// - A renamed session replaces its row in the list
// - End and Delete through the port, removing the row (also on not_found) or keeping it on failure
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/hooks/use-open-chats.test.tsx
//
// SEE: apps/mobile/src/hooks/use-open-chats.ts

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useIsFocused } from "expo-router";

import { useOpenChats } from "@/hooks/use-open-chats";
import { activeSessionWith, fakeData, resetFakeData } from "../helpers/fake-data";

jest.mock("expo-router", () => ({ useIsFocused: jest.fn(() => true) }));
jest.mock("@/data", () => ({
  data: jest.requireActual<typeof import("../helpers/fake-data")>("../helpers/fake-data").fakeData,
}));

const first = activeSessionWith({ id: "s1" });
const second = activeSessionWith({ id: "s2" });
const session = first.session;

describe("useOpenChats", () => {
  beforeEach(() => {
    resetFakeData();
    jest.mocked(useIsFocused).mockReturnValue(true);
    fakeData.listOpenSessions.mockResolvedValue({ ok: true, value: [first, second] });
  });

  it("is ready with the open sessions from the data port", async () => {
    const { result } = await renderHook(() => useOpenChats());
    await waitFor(() =>
      expect(result.current.state).toEqual({
        kind: "ready",
        sessions: [first, second],
        loadedAt: expect.any(Number),
        actionFailure: null,
      }),
    );
  });

  it("is empty when the port returns no open session", async () => {
    fakeData.listOpenSessions.mockResolvedValue({ ok: true, value: [] });
    const { result } = await renderHook(() => useOpenChats());
    await waitFor(() => expect(result.current.state).toEqual({ kind: "empty" }));
  });

  it("fails with the read failure", async () => {
    fakeData.listOpenSessions.mockResolvedValue({ ok: false, failure: "unavailable" });
    const { result } = await renderHook(() => useOpenChats());
    await waitFor(() =>
      expect(result.current.state).toEqual({ kind: "failed", failure: "unavailable" }),
    );
  });

  it("reads again on retry and becomes ready", async () => {
    fakeData.listOpenSessions.mockResolvedValueOnce({ ok: false, failure: "network" });
    const { result } = await renderHook(() => useOpenChats());
    await waitFor(() => expect(result.current.state.kind).toBe("failed"));
    await act(async () => result.current.retry());
    expect(result.current.state.kind).toBe("ready");
    expect(fakeData.listOpenSessions).toHaveBeenCalledTimes(2);
  });

  it("reads again with a fresh load time when it regains focus, and not while unfocused", async () => {
    jest.mocked(useIsFocused).mockReturnValue(false);
    const { result, rerender } = await renderHook(() => useOpenChats());
    expect(fakeData.listOpenSessions).not.toHaveBeenCalled();
    jest.mocked(useIsFocused).mockReturnValue(true);
    await rerender({});
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    const firstLoad = result.current.state.kind === "ready" ? result.current.state.loadedAt : 0;
    fakeData.listOpenSessions.mockResolvedValue({ ok: true, value: [second] });
    jest.mocked(useIsFocused).mockReturnValue(false);
    await rerender({});
    jest.mocked(useIsFocused).mockReturnValue(true);
    jest.spyOn(Date, "now").mockReturnValue(firstLoad + 1000);
    await rerender({});
    await waitFor(() =>
      expect(result.current.state).toEqual({
        kind: "ready",
        sessions: [second],
        loadedAt: firstLoad + 1000,
        actionFailure: null,
      }),
    );
    expect(fakeData.listOpenSessions).toHaveBeenCalledTimes(2);
    jest.restoreAllMocks();
  });

  it("drops a read that ends after unmount", async () => {
    let finish!: (value: Awaited<ReturnType<typeof fakeData.listOpenSessions>>) => void;
    fakeData.listOpenSessions.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result, unmount } = await renderHook(() => useOpenChats());
    await unmount();
    await act(async () => finish({ ok: true, value: [first] }));
    expect(result.current.state).toEqual({ kind: "loading" });
  });

  it("ends a session through the port and removes its row", async () => {
    fakeData.endSession.mockResolvedValue({ ok: true, value: { ...session, status: "ended" } });
    const { result } = await renderHook(() => useOpenChats());
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    await act(async () => result.current.end("s1"));
    expect(fakeData.endSession).toHaveBeenCalledWith("s1");
    expect(result.current.state).toMatchObject({ kind: "ready", sessions: [second] });
  });

  it("deletes a session through the port and removes its row", async () => {
    fakeData.deleteSession.mockResolvedValue({ ok: true, value: session });
    const { result } = await renderHook(() => useOpenChats());
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    await act(async () => result.current.remove("s2"));
    expect(fakeData.deleteSession).toHaveBeenCalledWith("s2");
    expect(result.current.state).toMatchObject({ kind: "ready", sessions: [first] });
  });

  it("removes the row when End answers not_found", async () => {
    fakeData.endSession.mockResolvedValue({ ok: false, failure: "not_found" });
    const { result } = await renderHook(() => useOpenChats());
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    await act(async () => result.current.end("s1"));
    expect(result.current.state).toMatchObject({ kind: "ready", sessions: [second] });
  });

  it("keeps the row and records network when Delete cannot reach the server", async () => {
    fakeData.deleteSession.mockResolvedValue({ ok: false, failure: "network" });
    const { result } = await renderHook(() => useOpenChats());
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    await act(async () => result.current.remove("s1"));
    expect(result.current.state).toMatchObject({
      kind: "ready",
      sessions: [first, second],
      actionFailure: "network",
    });
  });

  it("replaces a renamed session in the list", async () => {
    const { result } = await renderHook(() => useOpenChats());
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    await act(async () =>
      result.current.titled({ ...session, title: "Weekend plans", titleSource: "user" }),
    );
    expect(result.current.state).toMatchObject({ kind: "ready" });
    if (result.current.state.kind !== "ready") throw new Error("expected ready");
    expect(result.current.state.sessions.map((open) => open.session.title)).toEqual([
      "Weekend plans",
      second.session.title,
    ]);
  });
});
