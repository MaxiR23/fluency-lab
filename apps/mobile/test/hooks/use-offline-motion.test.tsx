// apps/mobile/test/hooks/use-offline-motion.test.tsx
//
// Tests for the hook that reads the system reduce motion setting for the can't-connect screens.
//
// Tested:
// - useOfflineMotion gives the offline motion when reduce motion is off, and none when it is on
//
// What is covered:
// - Normal case and the reduce motion case
//
// Run with: pnpm exec jest apps/mobile/test/hooks/use-offline-motion.test.tsx
//
// SEE: apps/mobile/src/hooks/use-offline-motion.ts

import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { renderHook } from "@testing-library/react-native";
import * as Reanimated from "react-native-reanimated";

import { useOfflineMotion } from "@/hooks/use-offline-motion";
import { offlineMotion } from "@/utils/offline-motion";

jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual<typeof Reanimated>("react-native-reanimated");
  return {
    ...actual,
    __esModule: true,
    default: actual.default,
    useReducedMotion: jest.fn(() => false),
  };
});

describe("useOfflineMotion", () => {
  afterEach(() => {
    jest.mocked(Reanimated.useReducedMotion).mockReturnValue(false);
  });

  it("returns the offline motion when reduce motion is off", async () => {
    const { result } = await renderHook(() => useOfflineMotion());

    expect(result.current).toEqual(offlineMotion(false));
  });

  it("returns null when reduce motion is on", async () => {
    jest.mocked(Reanimated.useReducedMotion).mockReturnValue(true);
    const { result } = await renderHook(() => useOfflineMotion());

    expect(result.current).toBeNull();
  });
});
