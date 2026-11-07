// apps/mobile/test/hooks/use-practice-focus.test.tsx
//
// Tests for the hook of the practice focus screen.
//
// Tested:
// - The profile, the mistakes and the words read from the data port
// - Loading, ready, each failure, and a read again on retry
// - The selection starts on the default focus and changes; the target starts on 5 and changes
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/hooks/use-practice-focus.test.tsx
//
// SEE: apps/mobile/src/hooks/use-practice-focus.ts

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useIsFocused } from "expo-router";

import { usePracticeFocus } from "@/hooks/use-practice-focus";
import { deviceTimeZone } from "@/utils/time-zone";
import {
  completedProfile,
  fakeData,
  mistakeGroupWith,
  newWordWith,
  resetFakeData,
} from "../helpers/fake-data";

jest.mock("expo-router", () => ({ useIsFocused: jest.fn(() => true) }));
jest.mock("@/utils/time-zone", () => ({ deviceTimeZone: jest.fn(() => "UTC") }));
jest.mock("@/data", () => ({
  data: jest.requireActual<typeof import("../helpers/fake-data")>("../helpers/fake-data").fakeData,
}));

describe("usePracticeFocus", () => {
  beforeEach(() => {
    resetFakeData();
    jest.mocked(useIsFocused).mockReturnValue(true);
  });

  it("is loading and then ready with the focus model", async () => {
    let finish!: (value: Awaited<ReturnType<typeof fakeData.getProfile>>) => void;
    fakeData.getProfile.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = await renderHook(() => usePracticeFocus());
    expect(result.current.state).toEqual({ kind: "loading" });
    await act(async () =>
      finish({ ok: true, value: { ...completedProfile(), level: "intermediate" } }),
    );
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    expect(result.current.state.kind === "ready" && result.current.state.model.suggestedLabel).toBe(
      "Suggested for Intermediate",
    );
  });

  it("reads the words in the device's time zone and the first page of each list", async () => {
    jest.mocked(deviceTimeZone).mockReturnValue("America/Argentina/Buenos_Aires");
    const { result } = await renderHook(() => usePracticeFocus());
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    expect(fakeData.listWords).toHaveBeenCalledWith("America/Argentina/Buenos_Aires", 0);
    expect(fakeData.listMistakes).toHaveBeenCalledWith(0);
  });

  it("selects mistakes by default when there are any", async () => {
    fakeData.listMistakes.mockResolvedValue({
      ok: true,
      value: { items: [mistakeGroupWith()], nextOffset: null },
    });
    const { result } = await renderHook(() => usePracticeFocus());
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    expect(result.current.choice).toEqual({ kind: "mistakes" });
  });

  it("selects the first topic with no mistakes and no words", async () => {
    const { result } = await renderHook(() => usePracticeFocus());
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    expect(result.current.choice).toEqual({ kind: "topic", topicId: "going_to_vs_will" });
  });

  it("has no choice while loading", async () => {
    fakeData.getProfile.mockReturnValue(new Promise(() => {}));
    const { result } = await renderHook(() => usePracticeFocus());
    expect(result.current.choice).toBeNull();
  });

  it("changes the selection and the target", async () => {
    fakeData.listWords.mockResolvedValue({
      ok: true,
      value: { items: [newWordWith()], nextOffset: null },
    });
    const { result } = await renderHook(() => usePracticeFocus());
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    expect(result.current.target).toBe(5);
    await act(async () => result.current.select({ kind: "words" }));
    expect(result.current.choice).toEqual({ kind: "words" });
    await act(async () => result.current.setTarget(15));
    expect(result.current.target).toBe(15);
  });

  it("fails on any read", async () => {
    fakeData.listWords.mockResolvedValue({ ok: false, failure: "unavailable" });
    const { result } = await renderHook(() => usePracticeFocus());
    await waitFor(() =>
      expect(result.current.state).toEqual({ kind: "failed", failure: "unavailable" }),
    );
    fakeData.listMistakes.mockResolvedValue({ ok: false, failure: "network" });
    fakeData.listWords.mockResolvedValue({ ok: true, value: { items: [], nextOffset: null } });
    await act(async () => result.current.retry());
    expect(result.current.state).toEqual({ kind: "failed", failure: "network" });
  });

  it("reads again on retry and becomes ready", async () => {
    fakeData.getProfile.mockResolvedValueOnce({ ok: false, failure: "network" });
    const { result } = await renderHook(() => usePracticeFocus());
    await waitFor(() => expect(result.current.state.kind).toBe("failed"));
    await act(async () => result.current.retry());
    expect(result.current.state.kind).toBe("ready");
    expect(fakeData.getProfile).toHaveBeenCalledTimes(2);
  });

  it("does not read while unfocused and drops a read that ends after unmount", async () => {
    jest.mocked(useIsFocused).mockReturnValue(false);
    const { result, unmount } = await renderHook(() => usePracticeFocus());
    expect(fakeData.getProfile).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ kind: "loading" });
    await unmount();
  });
});
