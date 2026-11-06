// apps/mobile/test/hooks/use-chat.test.tsx
//
// Tests for the Chat hook.
//
// Tested:
// - The key and the profile read from their ports
// - The expected empty (no key) and each failure
// - A read again on retry and on regaining focus, and a read that ends after unmount
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/hooks/use-chat.test.tsx
//
// SEE: apps/mobile/src/hooks/use-chat.ts

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useIsFocused } from "expo-router";

import { useChat } from "@/hooks/use-chat";
import { dataFailureMessage, keyReadFailureMessage } from "@/utils/data-message";
import { fakeData, profileWith, resetFakeData } from "../helpers/fake-data";
import { fakeKeys, resetFakeKeys } from "../helpers/fake-keys";

jest.mock("expo-router", () => ({ useIsFocused: jest.fn(() => true) }));
jest.mock("@/data", () => ({
  data: jest.requireActual<typeof import("../helpers/fake-data")>("../helpers/fake-data").fakeData,
}));
jest.mock("@/keys", () => ({
  keys: jest.requireActual<typeof import("../helpers/fake-keys")>("../helpers/fake-keys").fakeKeys,
}));

describe("useChat", () => {
  beforeEach(() => {
    resetFakeData();
    resetFakeKeys();
    jest.mocked(useIsFocused).mockReturnValue(true);
  });

  it("is ready with the provider read from the profile when a key is saved", async () => {
    fakeKeys.hasApiKey.mockResolvedValue({ ok: true, value: true });
    fakeData.getProfile.mockResolvedValue({
      ok: true,
      value: profileWith({ provider: "claude" }),
    });
    const { result } = await renderHook(() => useChat());
    await waitFor(() => expect(result.current.view).toEqual({ kind: "ready", provider: "claude" }));
  });

  it("is no_key when no key is saved", async () => {
    const { result } = await renderHook(() => useChat());
    await waitFor(() => expect(result.current.view).toEqual({ kind: "no_key" }));
  });

  it("fails with the key message and cause when the key cannot be read", async () => {
    const cause = { name: "Error", detail: null };
    fakeKeys.hasApiKey.mockResolvedValue({ ok: false, failure: "not_read", cause });
    const { result } = await renderHook(() => useChat());
    await waitFor(() =>
      expect(result.current.view).toEqual({
        kind: "failed",
        message: keyReadFailureMessage,
        cause,
      }),
    );
  });

  it("fails with the session-ended message when the profile read is unauthorized", async () => {
    fakeKeys.hasApiKey.mockResolvedValue({ ok: true, value: true });
    fakeData.getProfile.mockResolvedValue({ ok: false, failure: "unauthorized" });
    const { result } = await renderHook(() => useChat());
    await waitFor(() =>
      expect(result.current.view).toEqual({
        kind: "failed",
        message: dataFailureMessage("unauthorized"),
      }),
    );
  });

  it("fails with the network message when the profile cannot reach the server", async () => {
    fakeKeys.hasApiKey.mockResolvedValue({ ok: true, value: true });
    fakeData.getProfile.mockResolvedValue({ ok: false, failure: "network" });
    const { result } = await renderHook(() => useChat());
    await waitFor(() =>
      expect(result.current.view).toEqual({
        kind: "failed",
        message: dataFailureMessage("network"),
      }),
    );
  });

  it("fails with the generic message when the profile body has the wrong shape", async () => {
    fakeKeys.hasApiKey.mockResolvedValue({ ok: true, value: true });
    fakeData.getProfile.mockResolvedValue({ ok: false, failure: "bad_response" });
    const { result } = await renderHook(() => useChat());
    await waitFor(() =>
      expect(result.current.view).toEqual({
        kind: "failed",
        message: dataFailureMessage("bad_response"),
      }),
    );
  });

  it("reads again on retry and on regaining focus", async () => {
    fakeKeys.hasApiKey.mockResolvedValueOnce({ ok: false, failure: "not_read" });
    const { result, rerender } = await renderHook(() => useChat());
    await waitFor(() => expect(result.current.view.kind).toBe("failed"));
    fakeKeys.hasApiKey.mockResolvedValue({ ok: true, value: false });
    await act(async () => result.current.retry());
    expect(result.current.view).toEqual({ kind: "no_key" });
    expect(fakeKeys.hasApiKey).toHaveBeenCalledTimes(2);

    jest.mocked(useIsFocused).mockReturnValue(false);
    await rerender({});
    fakeKeys.hasApiKey.mockResolvedValue({ ok: true, value: true });
    jest.mocked(useIsFocused).mockReturnValue(true);
    await rerender({});
    await waitFor(() => expect(result.current.view).toEqual({ kind: "ready", provider: null }));
    expect(fakeKeys.hasApiKey).toHaveBeenCalledTimes(3);
  });

  it("drops a read that ends after unmount", async () => {
    let finish!: (value: Awaited<ReturnType<typeof fakeKeys.hasApiKey>>) => void;
    fakeKeys.hasApiKey.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result, unmount } = await renderHook(() => useChat());
    await unmount();
    await act(async () => finish({ ok: true, value: false }));
    expect(result.current.view).toEqual({ kind: "loading" });
  });
});
