// apps/mobile/test/hooks/use-note-motion.test.tsx
//
// Tests for the hook that reads the system reduce motion setting for the note screen.
//
// Tested:
// - useNoteMotion gives the row motion when reduce motion is off, and none when it is on
//
// What is covered:
// - Normal case and the reduce motion case
//
// Run with: pnpm exec jest apps/mobile/test/hooks/use-note-motion.test.tsx
//
// SEE: apps/mobile/src/hooks/use-note-motion.ts

import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { renderHook } from "@testing-library/react-native";
import * as Reanimated from "react-native-reanimated";

import { useNoteMotion } from "@/hooks/use-note-motion";
import { noteMotion } from "@/utils/note-motion";

jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual<typeof Reanimated>("react-native-reanimated");
  return {
    ...actual,
    __esModule: true,
    default: actual.default,
    useReducedMotion: jest.fn(() => false),
  };
});

describe("useNoteMotion", () => {
  afterEach(() => {
    jest.mocked(Reanimated.useReducedMotion).mockReturnValue(false);
  });

  it("gives the row motion when reduce motion is off", async () => {
    const { result } = await renderHook(() => useNoteMotion());

    expect(result.current).toEqual(noteMotion(false));
  });

  it("gives none when reduce motion is on", async () => {
    jest.mocked(Reanimated.useReducedMotion).mockReturnValue(true);
    const { result } = await renderHook(() => useNoteMotion());

    expect(result.current).toBeNull();
  });
});
