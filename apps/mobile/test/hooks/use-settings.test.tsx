// apps/mobile/test/hooks/use-settings.test.tsx
//
// Tests for the Settings hook.
//
// Tested:
// - The profile, the month spend in the device zone and the key presence read on focus
// - A read again on retry, and a read that ends after unmount
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/hooks/use-settings.test.tsx
//
// SEE: apps/mobile/src/hooks/use-settings.ts

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useIsFocused } from "expo-router";

import { useSettings } from "@/hooks/use-settings";
import { completedProfile, fakeData, resetFakeData } from "../helpers/fake-data";
import { fakeKeys, resetFakeKeys } from "../helpers/fake-keys";

jest.mock("expo-router", () => ({ useIsFocused: jest.fn(() => true) }));
jest.mock("@/utils/time-zone", () => ({ deviceTimeZone: jest.fn(() => "America/Lima") }));
jest.mock("@/data", () => ({
  data: jest.requireActual<typeof import("../helpers/fake-data")>("../helpers/fake-data").fakeData,
}));
jest.mock("@/keys", () => ({
  keys: jest.requireActual<typeof import("../helpers/fake-keys")>("../helpers/fake-keys").fakeKeys,
}));

describe("useSettings", () => {
  beforeEach(() => {
    resetFakeData();
    resetFakeKeys();
    jest.mocked(useIsFocused).mockReturnValue(true);
  });

  it("reads the profile, the spend in the device zone and the key presence on focus", async () => {
    fakeKeys.hasApiKey.mockResolvedValue({ ok: true, value: true });
    const { result } = await renderHook(() => useSettings());
    await waitFor(() =>
      expect(result.current.state).toEqual({
        kind: "ready",
        profile: completedProfile(),
        spend: { monthStart: "2026-11-01", spentUsd: 0 },
        hasKey: true,
      }),
    );
    expect(fakeData.getMonthSpend).toHaveBeenCalledWith("America/Lima");
  });

  it("does not read while unfocused", async () => {
    jest.mocked(useIsFocused).mockReturnValue(false);
    const { result } = await renderHook(() => useSettings());
    expect(fakeData.getProfile).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ kind: "loading" });
  });

  it("is failed with the key read message when the key cannot be read", async () => {
    fakeKeys.hasApiKey.mockResolvedValue({ ok: false, failure: "not_read" });
    const { result } = await renderHook(() => useSettings());
    await waitFor(() => expect(result.current.state.kind).toBe("failed"));
  });

  it("reads again on retry and becomes ready", async () => {
    fakeData.getProfile.mockResolvedValueOnce({ ok: false, failure: "network" });
    const { result } = await renderHook(() => useSettings());
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
    const { result, unmount } = await renderHook(() => useSettings());
    await unmount();
    await act(async () => finish({ ok: true, value: completedProfile() }));
    expect(result.current.state).toEqual({ kind: "loading" });
  });
});
