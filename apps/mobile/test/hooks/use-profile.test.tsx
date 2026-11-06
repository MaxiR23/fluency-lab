// apps/mobile/test/hooks/use-profile.test.tsx
//
// Tests for the Profile hook.
//
// Tested:
// - The profile and the stats (in the device zone) read on focus, the email from the session
// - Deleting the account runs the account, the key and the session steps in order
// - A failed step stops there, and a retry resumes at the failed step
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/hooks/use-profile.test.tsx
//
// SEE: apps/mobile/src/hooks/use-profile.ts

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useIsFocused } from "expo-router";
import type { ReactNode } from "react";

import { SessionProvider } from "@/hooks/use-session";
import { useProfile } from "@/hooks/use-profile";
import { dataFailureMessage, keyDeleteFailureMessage } from "@/utils/data-message";
import { emitSession, fakeAuth, fakeSession, resetFakeAuth } from "../helpers/fake-auth";
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
jest.mock("@/auth", () => {
  const fake = jest.requireActual<typeof import("../helpers/fake-auth")>("../helpers/fake-auth");
  return { auth: fake.fakeAuth, apple: fake.fakeApple };
});

function wrapper({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

async function ready() {
  const hook = await renderHook(() => useProfile(), { wrapper });
  await act(async () => emitSession(fakeSession()));
  await waitFor(() => expect(hook.result.current.state.kind).toBe("ready"));
  return hook;
}

describe("useProfile", () => {
  beforeEach(() => {
    resetFakeAuth();
    resetFakeData();
    resetFakeKeys();
    jest.mocked(useIsFocused).mockReturnValue(true);
    fakeAuth.signOut.mockResolvedValue({ ok: true, value: null });
  });

  it("reads the profile and the stats in the device zone on focus", async () => {
    fakeData.getProfileStats.mockResolvedValue({
      ok: true,
      value: { sessions: 12, dayStreak: 3, newWords: 48 },
    });
    const { result } = await ready();
    expect(result.current.state).toEqual({
      kind: "ready",
      profile: completedProfile(),
      stats: { sessions: 12, dayStreak: 3, newWords: 48 },
    });
    expect(fakeData.getProfileStats).toHaveBeenCalledWith("America/Lima");
  });

  it("reads the email from the session", async () => {
    const { result } = await ready();
    expect(result.current.email).toBe("name@email.com");
  });

  it("is failed when a read fails and reads again on retry", async () => {
    fakeData.getProfileStats.mockResolvedValueOnce({ ok: false, failure: "network" });
    const { result } = await renderHook(() => useProfile(), { wrapper });
    await waitFor(() =>
      expect(result.current.state).toEqual({ kind: "failed", failure: "network" }),
    );
    await act(async () => result.current.retry());
    expect(result.current.state.kind).toBe("ready");
  });

  it("deletes the account, then the key, then the session, in that order", async () => {
    const { result } = await ready();
    await act(async () => result.current.deleteAccount());
    const order = [
      fakeData.deleteAccount.mock.invocationCallOrder[0],
      fakeKeys.deleteApiKey.mock.invocationCallOrder[0],
      fakeAuth.signOut.mock.invocationCallOrder[0],
    ];
    expect(order.every((entry) => entry !== undefined)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => (a ?? 0) - (b ?? 0)));
    expect(result.current.deletion).toMatchObject({ step: "session", failure: null });
  });

  it("stops after a failed account deletion and deletes no key", async () => {
    fakeData.deleteAccount.mockResolvedValue({ ok: false, failure: "network" });
    const { result } = await ready();
    await act(async () => result.current.deleteAccount());
    expect(fakeKeys.deleteApiKey).not.toHaveBeenCalled();
    expect(fakeAuth.signOut).not.toHaveBeenCalled();
    expect(result.current.deletion).toEqual({
      step: "account",
      running: false,
      failure: { message: dataFailureMessage("network") },
    });
  });

  it("resumes at the key step on retry without deleting the account again", async () => {
    fakeKeys.deleteApiKey.mockResolvedValueOnce({ ok: false, failure: "not_deleted" });
    const { result } = await ready();
    await act(async () => result.current.deleteAccount());
    expect(result.current.deletion).toMatchObject({
      step: "key",
      running: false,
      failure: { message: keyDeleteFailureMessage },
    });
    await act(async () => result.current.deleteAccount());
    expect(fakeData.deleteAccount).toHaveBeenCalledTimes(1);
    expect(fakeKeys.deleteApiKey).toHaveBeenCalledTimes(2);
    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
  });

  it("keeps the session step when the sign out fails", async () => {
    fakeAuth.signOut.mockResolvedValue({ ok: false, failure: "network" });
    const { result } = await ready();
    await act(async () => result.current.deleteAccount());
    expect(result.current.deletion).toMatchObject({ step: "session", running: false });
    expect(result.current.deletion.failure).not.toBeNull();
  });
});
