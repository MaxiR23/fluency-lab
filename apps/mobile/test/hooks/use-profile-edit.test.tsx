// apps/mobile/test/hooks/use-profile-edit.test.tsx
//
// Tests for the profile edit hook.
//
// Tested:
// - The profile read on mount into a draft, and a read again on retry
// - Save validates, sends only the edited field and goes back when the screen is focused
// - Save stops on errors, keeps a save failure and does not go back when the screen is not focused
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/hooks/use-profile-edit.test.tsx
//
// SEE: apps/mobile/src/hooks/use-profile-edit.ts

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import { useProfileEdit } from "@/hooks/use-profile-edit";
import { dataFailureMessage } from "@/utils/data-message";
import { editDraft } from "@/utils/profile-edit";
import { completedProfile, fakeData, profileWith, resetFakeData } from "../helpers/fake-data";
import { failThenHold } from "../helpers/fail-then-hold";

const mockIsFocused = jest.fn(() => true);

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
  useNavigation: () => ({ isFocused: () => mockIsFocused() }),
}));
jest.mock("@/data", () => ({
  data: jest.requireActual<typeof import("../helpers/fake-data")>("../helpers/fake-data").fakeData,
}));

async function ready(field: Parameters<typeof useProfileEdit>[0]) {
  const hook = await renderHook(() => useProfileEdit(field));
  await waitFor(() => expect(hook.result.current.state.kind).toBe("ready"));
  return hook;
}

describe("useProfileEdit", () => {
  beforeEach(() => {
    resetFakeData();
    jest.mocked(router.back).mockClear();
    mockIsFocused.mockReturnValue(true);
  });

  it("reads the profile on mount into a draft", async () => {
    const { result } = await ready("name");
    expect(result.current.state).toMatchObject({
      kind: "ready",
      draft: editDraft(completedProfile()),
      saving: false,
    });
  });

  it("is failed when the read fails and reads again on retry", async () => {
    fakeData.getProfile.mockResolvedValueOnce({ ok: false, failure: "network" });
    const { result } = await renderHook(() => useProfileEdit("name"));
    await waitFor(() =>
      expect(result.current.state).toEqual({ kind: "failed", failure: "network" }),
    );
    await act(async () => result.current.retry());
    expect(result.current.state.kind).toBe("ready");
  });

  it("saves only the edited field and goes back", async () => {
    fakeData.updateProfile.mockResolvedValue({ ok: true, value: completedProfile() });
    const { result } = await ready("name");
    await act(async () => result.current.change({ type: "name_changed", name: " Ada " }));
    await act(async () => result.current.save());
    expect(fakeData.updateProfile).toHaveBeenCalledWith({ displayName: "Ada" });
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("stops on errors and sends nothing", async () => {
    const { result } = await ready("name");
    await act(async () => result.current.change({ type: "name_changed", name: "  " }));
    await act(async () => result.current.save());
    expect(fakeData.updateProfile).not.toHaveBeenCalled();
    expect(result.current.state).toMatchObject({ errors: { name: "Enter your name." } });
    expect(router.back).not.toHaveBeenCalled();
  });

  it("keeps the save failure and stays", async () => {
    fakeData.updateProfile.mockResolvedValue({ ok: false, failure: "network" });
    const { result } = await ready("provider");
    await act(async () => result.current.save());
    expect(result.current.state).toMatchObject({
      saving: false,
      saveFailure: dataFailureMessage("network"),
    });
    expect(router.back).not.toHaveBeenCalled();
  });

  it("does not go back when the screen is no longer focused", async () => {
    fakeData.updateProfile.mockResolvedValue({ ok: true, value: completedProfile() });
    mockIsFocused.mockReturnValue(false);
    const { result } = await ready("provider");
    await act(async () => result.current.save());
    expect(fakeData.updateProfile).toHaveBeenCalledTimes(1);
    expect(router.back).not.toHaveBeenCalled();
  });

  it("does not save an invalid level", async () => {
    fakeData.getProfile.mockResolvedValue({ ok: true, value: profileWith({}) });
    const { result } = await ready("level");
    await act(async () => result.current.save());
    expect(fakeData.updateProfile).not.toHaveBeenCalled();
  });

  it("keeps the network failure, retrying, while Try again reads again", async () => {
    const reread = failThenHold(fakeData.getProfile, { ok: false, failure: "network" });
    const { result } = await renderHook(() => useProfileEdit("name"));
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
