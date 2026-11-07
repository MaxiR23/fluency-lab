// apps/mobile/test/hooks/use-home.test.tsx
//
// Tests for the Home hook.
//
// Tested:
// - The profile, the open sessions, the week, today's practice and the mistakes read from the data port
// - The expected empty (no open session) and each failure
// - A read again on retry and on regaining focus, and a read that ends after unmount
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/hooks/use-home.test.tsx
//
// SEE: apps/mobile/src/hooks/use-home.ts

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useIsFocused } from "expo-router";

import { useHome } from "@/hooks/use-home";
import { todayCard } from "@/utils/today-practice";
import { deviceTimeZone } from "@/utils/time-zone";
import {
  activeSessionWith,
  completedProfile,
  fakeData,
  practiceItemWith,
  practiceTodayWith,
  resetFakeData,
  weekWith,
} from "../helpers/fake-data";

jest.mock("expo-router", () => ({ useIsFocused: jest.fn(() => true) }));
jest.mock("@/utils/time-zone", () => ({ deviceTimeZone: jest.fn(() => "UTC") }));
jest.mock("@/data", () => ({
  data: jest.requireActual<typeof import("../helpers/fake-data")>("../helpers/fake-data").fakeData,
}));

const noToday = todayCard({ today: null, mistakes: { items: [], nextOffset: null }, level: null });

describe("useHome", () => {
  beforeEach(() => {
    resetFakeData();
    jest.mocked(useIsFocused).mockReturnValue(true);
  });

  it("is ready with the profile and the open sessions read from the data port", async () => {
    const active = activeSessionWith({});
    fakeData.listOpenSessions.mockResolvedValue({ ok: true, value: [active] });
    const { result } = await renderHook(() => useHome());
    await waitFor(() =>
      expect(result.current.state).toEqual({
        kind: "ready",
        profile: completedProfile(),
        activeSession: active,
        openCount: 1,
        week: weekWith([]),
        today: noToday,
        loadedAt: expect.any(Number),
      }),
    );
  });

  it("is ready with no Continue when the port returns no open session", async () => {
    const { result } = await renderHook(() => useHome());
    await waitFor(() =>
      expect(result.current.state).toEqual({
        kind: "ready",
        profile: completedProfile(),
        activeSession: null,
        openCount: 0,
        week: weekWith([]),
        today: noToday,
        loadedAt: expect.any(Number),
      }),
    );
  });

  it("counts every open session and keeps the newest as Continue", async () => {
    const newest = activeSessionWith({ id: "session-2" });
    const others = [activeSessionWith({ id: "session-1" }), activeSessionWith({ id: "session-0" })];
    fakeData.listOpenSessions.mockResolvedValue({ ok: true, value: [newest, ...others] });
    const { result } = await renderHook(() => useHome());
    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        kind: "ready",
        activeSession: newest,
        openCount: 3,
      }),
    );
  });

  it("fails with unauthorized when the profile read is unauthorized", async () => {
    fakeData.getProfile.mockResolvedValue({ ok: false, failure: "unauthorized" });
    const { result } = await renderHook(() => useHome());
    await waitFor(() =>
      expect(result.current.state).toEqual({ kind: "failed", failure: "unauthorized" }),
    );
  });

  it("fails with network when the open sessions read cannot reach the server", async () => {
    fakeData.listOpenSessions.mockResolvedValue({ ok: false, failure: "network" });
    const { result } = await renderHook(() => useHome());
    await waitFor(() =>
      expect(result.current.state).toEqual({ kind: "failed", failure: "network" }),
    );
  });

  it("asks for the week in the device's time zone", async () => {
    jest.mocked(deviceTimeZone).mockReturnValue("America/Argentina/Buenos_Aires");
    const { result } = await renderHook(() => useHome());
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    expect(fakeData.getSessionWeek).toHaveBeenCalledWith("America/Argentina/Buenos_Aires");
  });

  it("reads today's practice in the device's time zone and the first page of mistakes", async () => {
    jest.mocked(deviceTimeZone).mockReturnValue("America/Argentina/Buenos_Aires");
    const { result } = await renderHook(() => useHome());
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    expect(fakeData.getTodayPractice).toHaveBeenCalledWith("America/Argentina/Buenos_Aires");
    expect(fakeData.listMistakes).toHaveBeenCalledWith(0);
  });

  it("is ready with today's run in the card", async () => {
    fakeData.getTodayPractice.mockResolvedValue({
      ok: true,
      value: practiceTodayWith([practiceItemWith({ correct: true })]),
    });
    const { result } = await renderHook(() => useHome());
    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        kind: "ready",
        today: { ringLabel: "1/5", action: "Keep going" },
      }),
    );
  });

  it("fails when today's practice cannot be read", async () => {
    fakeData.getTodayPractice.mockResolvedValue({ ok: false, failure: "network" });
    const { result } = await renderHook(() => useHome());
    await waitFor(() =>
      expect(result.current.state).toEqual({ kind: "failed", failure: "network" }),
    );
  });

  it("fails when the mistakes cannot be read", async () => {
    fakeData.listMistakes.mockResolvedValue({ ok: false, failure: "unavailable" });
    const { result } = await renderHook(() => useHome());
    await waitFor(() =>
      expect(result.current.state).toEqual({ kind: "failed", failure: "unavailable" }),
    );
  });

  it("fails when the week read fails", async () => {
    fakeData.getSessionWeek.mockResolvedValue({ ok: false, failure: "unavailable" });
    const { result } = await renderHook(() => useHome());
    await waitFor(() =>
      expect(result.current.state).toEqual({ kind: "failed", failure: "unavailable" }),
    );
  });

  it("fails with bad_response on a malformed body", async () => {
    fakeData.listOpenSessions.mockResolvedValue({ ok: false, failure: "bad_response" });
    const { result } = await renderHook(() => useHome());
    await waitFor(() =>
      expect(result.current.state).toEqual({ kind: "failed", failure: "bad_response" }),
    );
  });

  it("reads again on retry and becomes ready", async () => {
    fakeData.getProfile.mockResolvedValueOnce({ ok: false, failure: "network" });
    const { result } = await renderHook(() => useHome());
    await waitFor(() => expect(result.current.state.kind).toBe("failed"));
    await act(async () => result.current.retry());
    expect(result.current.state.kind).toBe("ready");
    expect(fakeData.getProfile).toHaveBeenCalledTimes(2);
  });

  it("drops a read that ends after unmount", async () => {
    let finish!: (value: Awaited<ReturnType<typeof fakeData.getProfile>>) => void;
    fakeData.getProfile.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result, unmount } = await renderHook(() => useHome());
    await unmount();
    await act(async () => finish({ ok: true, value: completedProfile() }));
    expect(result.current.state).toEqual({ kind: "loading" });
  });

  it("reads again with a fresh load time when it regains focus, and not while unfocused", async () => {
    jest.mocked(useIsFocused).mockReturnValue(false);
    const { result, rerender } = await renderHook(() => useHome());
    expect(fakeData.getProfile).not.toHaveBeenCalled();
    jest.mocked(useIsFocused).mockReturnValue(true);
    await rerender({});
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    const first = result.current.state.kind === "ready" ? result.current.state.loadedAt : 0;
    const active = activeSessionWith({});
    fakeData.listOpenSessions.mockResolvedValue({ ok: true, value: [active] });
    jest.mocked(useIsFocused).mockReturnValue(false);
    await rerender({});
    jest.mocked(useIsFocused).mockReturnValue(true);
    jest.spyOn(Date, "now").mockReturnValue(first + 1000);
    await rerender({});
    await waitFor(() =>
      expect(result.current.state).toEqual({
        kind: "ready",
        profile: completedProfile(),
        activeSession: active,
        openCount: 1,
        week: weekWith([]),
        today: noToday,
        loadedAt: first + 1000,
      }),
    );
    expect(fakeData.getProfile).toHaveBeenCalledTimes(2);
    jest.restoreAllMocks();
  });
});
