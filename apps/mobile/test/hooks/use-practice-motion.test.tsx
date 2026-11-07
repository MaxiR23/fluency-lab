// apps/mobile/test/hooks/use-practice-motion.test.tsx
//
// Tests for the hook that reads the system reduce motion setting for the practice screens.
//
// Tested:
// - usePracticeMotion gives the four animated configs when reduce motion is off
// - usePracticeMotion gives null configs when reduce motion is on
//
// What is covered:
// - Normal case and the reduce motion case
//
// Run with: pnpm exec jest apps/mobile/test/hooks/use-practice-motion.test.tsx
//
// SEE: apps/mobile/src/hooks/use-practice-motion.ts

import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { renderHook } from "@testing-library/react-native";
import * as Reanimated from "react-native-reanimated";

import { usePracticeMotion } from "@/hooks/use-practice-motion";
import { exerciseMotion, focusMotion, homeMotion, resultMotion } from "@/utils/practice-motion";

jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual<typeof Reanimated>("react-native-reanimated");
  return {
    ...actual,
    __esModule: true,
    default: actual.default,
    useReducedMotion: jest.fn(() => false),
  };
});

describe("usePracticeMotion", () => {
  afterEach(() => {
    jest.mocked(Reanimated.useReducedMotion).mockReturnValue(false);
  });

  it("gives the animated configs when reduce motion is off", async () => {
    const { result } = await renderHook(() => usePracticeMotion());
    expect(result.current).toEqual({
      home: homeMotion(false),
      focus: focusMotion(false),
      exercise: exerciseMotion(false),
      result: resultMotion(false),
    });
  });

  it("returns null configs with reduce motion", async () => {
    jest.mocked(Reanimated.useReducedMotion).mockReturnValue(true);
    const { result } = await renderHook(() => usePracticeMotion());
    expect(result.current).toEqual({ home: null, focus: null, exercise: null, result: null });
  });
});
