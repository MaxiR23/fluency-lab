// apps/mobile/test/hooks/use-sign-out.test.tsx
//
// Tests for the useSignOut hook.
//
// Tested:
// - It signs out through the auth port and leaves no failure
// - A failed sign out keeps the failure view for the screen to draw
// - It is running while the port runs
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/hooks/use-sign-out.test.tsx
//
// SEE: apps/mobile/src/hooks/use-sign-out.ts

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";

import { useSignOut } from "@/hooks/use-sign-out";
import { authFailureView } from "@/utils/auth-message";
import { fakeAuth, resetFakeAuth } from "../helpers/fake-auth";

jest.mock("@/auth", () => {
  const fake = jest.requireActual<typeof import("../helpers/fake-auth")>("../helpers/fake-auth");
  return { auth: fake.fakeAuth, apple: fake.fakeApple };
});

describe("useSignOut", () => {
  beforeEach(() => {
    resetFakeAuth();
  });

  it("signs out and leaves no failure", async () => {
    fakeAuth.signOut.mockResolvedValue({ ok: true, value: null });
    const { result } = await renderHook(() => useSignOut());
    await act(async () => {
      await result.current.signOut();
    });
    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(result.current.failure).toBeUndefined();
    expect(result.current.running).toBe(false);
  });

  it("keeps the failure view of a failed sign out", async () => {
    const failed = { ok: false, failure: "network" } as const;
    fakeAuth.signOut.mockResolvedValue(failed);
    const { result } = await renderHook(() => useSignOut());
    await act(async () => {
      await result.current.signOut();
    });
    expect(result.current.failure).toEqual(authFailureView(failed));
    expect(result.current.running).toBe(false);
  });

  it("is running while the port runs and clears an earlier failure on a new try", async () => {
    fakeAuth.signOut.mockResolvedValueOnce({ ok: false, failure: "network" });
    const { result } = await renderHook(() => useSignOut());
    await act(async () => {
      await result.current.signOut();
    });
    let finish!: () => void;
    fakeAuth.signOut.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = () => resolve({ ok: true, value: null });
      }),
    );
    let pending!: Promise<void>;
    await act(async () => {
      pending = result.current.signOut();
    });
    expect(result.current.running).toBe(true);
    expect(result.current.failure).toBeUndefined();
    await act(async () => {
      finish();
      await pending;
    });
    expect(result.current.running).toBe(false);
  });
});
