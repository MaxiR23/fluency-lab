// apps/mobile/test/utils/note-transitions.test.ts
//
// Tests for the note transitions built from the motion config.
//
// Tested:
// - rowTransition slides a row in from the left with its delay, or builds none
// - savedTransition pops the Saved to Notes line, or builds none
//
// What is covered:
// - Normal case, reduce motion, edges (live frames do not advance under jest)
//
// Run with: pnpm exec jest apps/mobile/test/utils/note-transitions.test.ts
//
// SEE: apps/mobile/src/utils/note-transitions.ts

import { describe, expect, it } from "@jest/globals";
import { FadeInLeft, Keyframe } from "react-native-reanimated";

import { chatMotion } from "@/utils/chat-motion";
import { noteMotion, rowMotion } from "@/utils/note-motion";
import { rowTransition, savedTransition } from "@/utils/note-transitions";

describe("rowTransition", () => {
  it("slides a row in from the left with its delay and duration", () => {
    const built = rowTransition(rowMotion(noteMotion(false), 2));
    expect(built).toBeInstanceOf(FadeInLeft);
    expect(built?.getDelay()).toBe(400);
    expect(built?.getDuration()).toBe(840);
  });

  it("builds none with reduce motion on", () => {
    expect(rowTransition(rowMotion(noteMotion(true), 0))).toBeUndefined();
  });
});

describe("savedTransition", () => {
  it("builds the pop of the saved line", () => {
    expect(savedTransition(chatMotion(false).saved)).toBeInstanceOf(Keyframe);
  });

  it("builds none with reduce motion on", () => {
    expect(savedTransition(chatMotion(true).saved)).toBeUndefined();
  });
});
