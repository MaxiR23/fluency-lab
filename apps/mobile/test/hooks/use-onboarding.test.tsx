// apps/mobile/test/hooks/use-onboarding.test.tsx
//
// Tests for the onboarding provider and its hook.
//
// Tested:
// - The profile read when a user signs in: completed, pending, each failure
// - No read while signed out, a read again on retry, a reset on sign out
// - finish: the update, the gate after it and the failures it returns
// - The hook throws outside the provider
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/hooks/use-onboarding.test.tsx
//
// SEE: apps/mobile/src/hooks/use-onboarding.tsx

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { OnboardingProvider, useOnboarding } from "@/hooks/use-onboarding";
import { SessionProvider } from "@/hooks/use-session";
import { emitSession, fakeSession, resetFakeAuth } from "../helpers/fake-auth";
import { completedProfile, fakeData, profileWith, resetFakeData } from "../helpers/fake-data";

jest.mock("@/auth", () => ({
  auth: jest.requireActual<typeof import("../helpers/fake-auth")>("../helpers/fake-auth").fakeAuth,
  apple:
    jest.requireActual<typeof import("../helpers/fake-auth")>("../helpers/fake-auth").fakeApple,
}));
jest.mock("@/data", () => ({
  data: jest.requireActual<typeof import("../helpers/fake-data")>("../helpers/fake-data").fakeData,
}));

function wrapper({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <OnboardingProvider>{children}</OnboardingProvider>
    </SessionProvider>
  );
}

async function signedIn() {
  const hook = await renderHook(() => useOnboarding(), { wrapper });
  await act(async () => emitSession(fakeSession()));
  return hook;
}

describe("OnboardingProvider", () => {
  beforeEach(() => {
    resetFakeAuth();
    resetFakeData();
  });

  it("reads the profile when a user signs in and marks a completed one", async () => {
    const { result } = await signedIn();
    expect(fakeData.getProfile).toHaveBeenCalledTimes(1);
    expect(result.current.gate).toEqual({ status: "completed", userId: "user-1" });
    expect(result.current.userId).toBe("user-1");
  });

  it("marks a fresh profile as pending", async () => {
    fakeData.getProfile.mockResolvedValue({ ok: true, value: profileWith({}) });
    const { result } = await signedIn();
    expect(result.current.gate).toEqual({ status: "pending", userId: "user-1" });
  });

  it.each(["unauthorized", "not_found"] as const)(
    "marks the gate failed with %s",
    async (failure) => {
      fakeData.getProfile.mockResolvedValue({ ok: false, failure });
      const { result } = await signedIn();
      expect(result.current.gate).toEqual({ status: "failed", userId: "user-1", failure });
    },
  );

  it("marks the gate failed with network", async () => {
    fakeData.getProfile.mockResolvedValue({ ok: false, failure: "network" });
    const { result } = await signedIn();
    expect(result.current.gate).toEqual({
      status: "failed",
      userId: "user-1",
      failure: "network",
    });
  });

  it("does not read the profile while signed out", async () => {
    const { result } = await renderHook(() => useOnboarding(), { wrapper });
    await act(async () => emitSession(null));
    expect(fakeData.getProfile).not.toHaveBeenCalled();
    expect(result.current.gate).toEqual({ status: "signed_out" });
    expect(result.current.userId).toBeNull();
  });

  it("reads again on retry and moves to pending", async () => {
    fakeData.getProfile.mockResolvedValueOnce({ ok: false, failure: "network" });
    fakeData.getProfile.mockResolvedValueOnce({ ok: true, value: profileWith({}) });
    const { result } = await signedIn();
    expect(result.current.gate.status).toBe("failed");
    await act(async () => result.current.retry());
    expect(fakeData.getProfile).toHaveBeenCalledTimes(2);
    expect(result.current.gate).toEqual({ status: "pending", userId: "user-1" });
  });

  it("resets to signed out when the user signs out", async () => {
    const { result } = await signedIn();
    await act(async () => emitSession(null));
    expect(result.current.gate).toEqual({ status: "signed_out" });
  });

  it("throws outside the provider", async () => {
    const quiet = jest.spyOn(globalThis.console, "error").mockImplementation(() => undefined);
    await expect(renderHook(() => useOnboarding())).rejects.toThrow(
      "useOnboarding must be used inside OnboardingProvider",
    );
    quiet.mockRestore();
  });
});

describe("OnboardingProvider.finish", () => {
  const update = { onboardingCompleted: true } as const;

  beforeEach(() => {
    resetFakeAuth();
    resetFakeData();
    fakeData.getProfile.mockResolvedValue({ ok: true, value: profileWith({}) });
  });

  it("marks the gate completed when the update succeeds", async () => {
    fakeData.updateProfile.mockResolvedValue({ ok: true, value: completedProfile() });
    const { result } = await signedIn();
    let outcome;
    await act(async () => {
      outcome = await result.current.finish(update);
    });
    expect(fakeData.updateProfile).toHaveBeenCalledWith(update);
    expect(outcome).toEqual({ ok: true, value: completedProfile() });
    expect(result.current.gate).toEqual({ status: "completed", userId: "user-1" });
  });

  it("returns invalid_input and keeps the gate pending", async () => {
    fakeData.updateProfile.mockResolvedValue({ ok: false, failure: "invalid_input" });
    const { result } = await signedIn();
    let outcome;
    await act(async () => {
      outcome = await result.current.finish(update);
    });
    expect(outcome).toEqual({ ok: false, failure: "invalid_input" });
    expect(result.current.gate).toEqual({ status: "pending", userId: "user-1" });
  });

  it("returns network and keeps the gate pending", async () => {
    fakeData.updateProfile.mockResolvedValue({ ok: false, failure: "network" });
    const { result } = await signedIn();
    let outcome;
    await act(async () => {
      outcome = await result.current.finish(update);
    });
    expect(outcome).toEqual({ ok: false, failure: "network" });
    expect(result.current.gate).toEqual({ status: "pending", userId: "user-1" });
  });
});
