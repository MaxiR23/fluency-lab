// apps/mobile/test/utils/practice-transitions.test.ts
//
// Tests for the practice transitions built from the motion config.
//
// Tested:
// - sheetTransition gives the slide up of the feedback sheet with the tone's delay, or none
//
// What is covered:
// - Normal case, reduce motion, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/practice-transitions.test.ts
//
// SEE: apps/mobile/src/utils/practice-transitions.ts

import { describe, expect, it } from "@jest/globals";
import { SlideInDown } from "react-native-reanimated";

import { motion } from "@/constants/theme";
import { exerciseMotion } from "@/utils/practice-motion";
import { sheetTransition } from "@/utils/practice-transitions";

describe("sheetTransition", () => {
  it("slides up after the right delay", () => {
    const built = sheetTransition(exerciseMotion(false)?.sheet ?? null, "right");
    expect(built).toBeInstanceOf(SlideInDown);
    expect(built?.getDelay()).toBe(motion.exercise.sheetDelayRight);
    expect(built?.getDuration()).toBe(motion.exercise.sheetDuration);
  });

  it("waits longer after a miss, for the shake", () => {
    const built = sheetTransition(exerciseMotion(false)?.sheet ?? null, "miss");
    expect(built?.getDelay()).toBe(motion.exercise.sheetDelayMiss);
  });

  it("builds none with reduce motion on", () => {
    expect(sheetTransition(exerciseMotion(true)?.sheet ?? null, "right")).toBeUndefined();
  });
});
