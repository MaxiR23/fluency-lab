// apps/mobile/test/hooks/use-haptics.test.tsx
//
// Tests for the haptics provider and its hook.
//
// Tested:
// - The stored setting is read once on mount
// - play calls the port only when the setting is on, not while loading or after a failed read
// - setEnabled saves first and updates the setting only when the save succeeds
// - The hook throws outside the provider
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/hooks/use-haptics.test.tsx
//
// SEE: apps/mobile/src/hooks/use-haptics.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { HapticsProvider, useHaptics } from "@/hooks/use-haptics";
import { fakeHaptics, fakeHapticsSetting } from "../helpers/fake-haptics";

function wrapper({ children }: { children: ReactNode }) {
  return <HapticsProvider>{children}</HapticsProvider>;
}

async function mounted() {
  const hook = await renderHook(() => useHaptics(), { wrapper });
  await act(async () => undefined);
  return hook;
}

describe("HapticsProvider", () => {
  it("reads the stored setting once on mount", async () => {
    const { result } = await mounted();
    expect(fakeHapticsSetting.read).toHaveBeenCalledTimes(1);
    expect(result.current.setting).toEqual({ kind: "ready", on: true, saveFailed: false });
  });

  it("plays when on", async () => {
    const { result } = await mounted();
    result.current.play("tab");
    result.current.play("send");
    expect(fakeHaptics.play.mock.calls).toEqual([["tab"], ["send"]]);
  });

  it("does not play when off", async () => {
    fakeHapticsSetting.read.mockResolvedValue({ ok: true, value: false });
    const { result } = await mounted();
    result.current.play("tab");
    expect(fakeHaptics.play).not.toHaveBeenCalled();
  });

  it("does not play while the setting loads", async () => {
    fakeHapticsSetting.read.mockReturnValue(new Promise(() => {}));
    const { result } = await renderHook(() => useHaptics(), { wrapper });
    expect(result.current.setting).toEqual({ kind: "loading" });
    result.current.play("tab");
    expect(fakeHaptics.play).not.toHaveBeenCalled();
  });

  it("does not play after a failed read", async () => {
    fakeHapticsSetting.read.mockResolvedValue({ ok: false, failure: "not_read" });
    const { result } = await mounted();
    result.current.play("send");
    expect(result.current.setting).toEqual({ kind: "failed" });
    expect(fakeHaptics.play).not.toHaveBeenCalled();
  });

  it("saves off and stops playing", async () => {
    const { result } = await mounted();
    let outcome: Awaited<ReturnType<typeof result.current.setEnabled>> | undefined;
    await act(async () => {
      outcome = await result.current.setEnabled(false);
    });
    expect(outcome).toEqual({ ok: true, value: null });
    expect(fakeHapticsSetting.save).toHaveBeenCalledWith(false);
    expect(result.current.setting).toEqual({ kind: "ready", on: false, saveFailed: false });
    result.current.play("tab");
    expect(fakeHaptics.play).not.toHaveBeenCalled();
  });

  it("keeps playing when saving off fails", async () => {
    fakeHapticsSetting.save.mockResolvedValue({ ok: false, failure: "not_saved" });
    const { result } = await mounted();
    await act(async () => {
      await result.current.setEnabled(false);
    });
    expect(result.current.setting).toEqual({ kind: "ready", on: true, saveFailed: true });
    result.current.play("tab");
    expect(fakeHaptics.play).toHaveBeenCalledWith("tab");
  });

  it("ignores a failed buzz", async () => {
    fakeHaptics.play.mockResolvedValue({ ok: false, failure: "not_played" });
    const { result } = await mounted();
    expect(() => result.current.play("tab")).not.toThrow();
  });
});

describe("useHaptics", () => {
  it("throws outside the provider", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(renderHook(() => useHaptics())).rejects.toThrow(
      "useHaptics must be used inside HapticsProvider",
    );
    error.mockRestore();
  });
});
