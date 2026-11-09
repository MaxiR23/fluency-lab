// apps/mobile/test/hooks/use-all-suggestions.test.tsx
//
// Tests for the "See all" suggestions hook.
//
// Tested:
// - The profile read from the data port becomes the list for its level
// - A failed read, a read again on retry and a read that ends after unmount
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/hooks/use-all-suggestions.test.tsx
//
// SEE: apps/mobile/src/hooks/use-all-suggestions.ts

import { allSuggestions } from "@fluency-lab/shared";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useAllSuggestions } from "@/hooks/use-all-suggestions";
import { completedProfile, fakeData, profileWith, resetFakeData } from "../helpers/fake-data";
import { failThenHold } from "../helpers/fail-then-hold";

jest.mock("@/data", () => ({
  data: jest.requireActual<typeof import("../helpers/fake-data")>("../helpers/fake-data").fakeData,
}));

describe("useAllSuggestions", () => {
  beforeEach(() => {
    resetFakeData();
  });

  it("is ready with every suggestion for the level", async () => {
    const profile = profileWith({ level: "beginner", topics: ["music"] });
    fakeData.getProfile.mockResolvedValue({ ok: true, value: profile });
    const { result } = await renderHook(() => useAllSuggestions());
    await waitFor(() =>
      expect(result.current.view).toEqual({ kind: "ready", suggestions: allSuggestions(profile) }),
    );
  });

  it("carries the read's failure", async () => {
    fakeData.getProfile.mockResolvedValue({ ok: false, failure: "network" });
    const { result } = await renderHook(() => useAllSuggestions());
    await waitFor(() =>
      expect(result.current.view).toEqual({ kind: "failed", failure: "network" }),
    );
  });

  it("reads again on retry", async () => {
    fakeData.getProfile.mockResolvedValueOnce({ ok: false, failure: "network" });
    const { result } = await renderHook(() => useAllSuggestions());
    await waitFor(() => expect(result.current.view.kind).toBe("failed"));
    await act(async () => result.current.retry());
    expect(result.current.view.kind).toBe("ready");
    expect(fakeData.getProfile).toHaveBeenCalledTimes(2);
  });

  it("drops a read that ends after unmount", async () => {
    let finish!: (value: Awaited<ReturnType<typeof fakeData.getProfile>>) => void;
    fakeData.getProfile.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result, unmount } = await renderHook(() => useAllSuggestions());
    await unmount();
    await act(async () => finish({ ok: true, value: completedProfile() }));
    expect(result.current.view).toEqual({ kind: "loading" });
  });

  it("keeps the network failure, retrying, while Try again reads again", async () => {
    const reread = failThenHold(fakeData.getProfile, { ok: false, failure: "network" });
    const { result } = await renderHook(() => useAllSuggestions());
    await waitFor(() => expect(result.current.view.kind).toBe("failed"));
    let pending: Promise<void> = Promise.resolve();
    await act(async () => {
      pending = result.current.retry();
    });
    expect(result.current.view).toEqual({ kind: "failed", failure: "network", retrying: true });
    reread.release();
    await act(async () => pending);
    expect(result.current.view.kind).toBe("ready");
  });
});
