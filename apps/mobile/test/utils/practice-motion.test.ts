// apps/mobile/test/utils/practice-motion.test.ts
//
// Tests for the motion configs of the practice screens, converted from the design files.
//
// Tested:
// - ringGeometry gives the circumference and the dash offset of a score ring
// - riseMotion staggers the entrance rises by index
// - homeMotion, focusMotion, exerciseMotion and resultMotion give the token timings, or null with reduce motion
// - shakeSteps and popSteps give the keyframe sequences
//
// What is covered:
// - Normal case, reduce motion, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/practice-motion.test.ts
//
// SEE: apps/mobile/src/utils/practice-motion.ts

import { describe, expect, it } from "@jest/globals";

import { motion, size } from "@/constants/theme";
import {
  exerciseMotion,
  focusMotion,
  homeMotion,
  popSteps,
  resultMotion,
  riseMotion,
  ringGeometry,
  shakeSteps,
} from "@/utils/practice-motion";

describe("ringGeometry", () => {
  it("computes the ring offset for 2 of 5 as 105.6 of 176", () => {
    const { circumference, offset } = ringGeometry(size.ringSmallRadius, 2 / 5);
    expect(circumference).toBeCloseTo(176, 0);
    expect(Math.abs(circumference - 176)).toBeLessThan(0.1);
    expect(Math.abs(offset - 105.6)).toBeLessThan(0.1);
  });

  it("computes the large ring for 4 of 5 as 70.4 of 352", () => {
    const { circumference, offset } = ringGeometry(size.ringLargeRadius, 4 / 5);
    expect(Math.abs(circumference - 352)).toBeLessThan(0.2);
    expect(Math.abs(offset - 70.4)).toBeLessThan(0.1);
  });

  it("draws an empty ring at 0 and a full ring at 1", () => {
    const empty = ringGeometry(28, 0);
    expect(empty.offset).toBe(empty.circumference);
    expect(ringGeometry(28, 1).offset).toBe(0);
  });

  it("clamps a fraction above 1 and below 0", () => {
    expect(ringGeometry(28, 1.5).offset).toBe(0);
    expect(ringGeometry(28, -1).offset).toBe(ringGeometry(28, 0).circumference);
  });
});

describe("riseMotion", () => {
  it("staggers the rises by index", () => {
    const first = riseMotion(motion.home, 0);
    const third = riseMotion(motion.home, 2);
    expect(first).toEqual({
      duration: motion.home.riseDuration,
      offset: motion.home.riseOffset,
      delay: 0,
      curve: motion.rise,
    });
    expect(third.delay).toBe(2 * motion.home.riseStagger);
  });

  it("adds a base delay and takes the curve it is given", () => {
    const rise = riseMotion(motion.result, 1, motion.easeOut);
    expect(rise.delay).toBe(motion.result.riseDelay + motion.result.riseStagger);
    expect(rise.curve).toBe(motion.easeOut);
  });
});

describe("the motion configs", () => {
  it("returns null configs with reduce motion", () => {
    expect(homeMotion(true)).toBeNull();
    expect(focusMotion(true)).toBeNull();
    expect(exerciseMotion(true)).toBeNull();
    expect(resultMotion(true)).toBeNull();
  });

  it("converts the home keyframes to the token timings", () => {
    const home = homeMotion(false);
    expect(home?.ring).toEqual({
      delay: motion.home.ringDelay,
      duration: motion.home.ringDuration,
      curve: motion.ring,
    });
    expect(home?.pop).toEqual({
      delay: motion.home.popDelay,
      up: motion.home.popUp,
      settle: motion.home.popSettle,
      scale: motion.home.popScale,
    });
    expect(home?.glowCycle).toBe(motion.home.glowCycle);
    expect(home?.nudge).toEqual({ cycle: motion.home.nudgeCycle, offset: motion.home.nudgeOffset });
    expect(home?.rise).toBe(motion.home);
  });

  it("converts the focus keyframes to the token timings", () => {
    expect(focusMotion(false)?.rise).toBe(motion.focus);
  });

  it("converts the exercise keyframes to the token timings", () => {
    const exercise = exerciseMotion(false);
    expect(exercise?.fill).toEqual({ duration: motion.exercise.fillDuration, curve: motion.ring });
    expect(exercise?.pick).toEqual({ duration: motion.exercise.pickDuration });
    expect(exercise?.check).toEqual({
      delay: motion.exercise.checkDelay,
      up: motion.exercise.checkUp,
      scale: motion.exercise.checkScale,
      settle: motion.exercise.checkSettle,
    });
    expect(exercise).not.toHaveProperty("slot");
    expect(exercise?.sheet).toEqual({
      delayRight: motion.exercise.sheetDelayRight,
      delayMiss: motion.exercise.sheetDelayMiss,
      duration: motion.exercise.sheetDuration,
      curve: motion.sheet,
    });
    expect(exercise?.wrong).toEqual({ duration: motion.exercise.wrongDuration });
    expect(exercise?.shake).toEqual(shakeSteps(motion.exercise.shake, motion.exercise.shakeStep));
  });

  it("converts the result keyframes to the token timings", () => {
    const result = resultMotion(false);
    expect(result?.ring).toEqual({
      delay: motion.result.ringDelay,
      duration: motion.result.ringDuration,
      curve: motion.ring,
    });
    expect(result?.halo).toEqual({ cycle: motion.result.haloCycle });
    expect(result?.sparks).toHaveLength(3);
    expect(result?.sparks.map((spark) => spark.delay)).toEqual([1800, 2000, 2150]);
    expect(result?.sparks[0]).toEqual({
      delay: motion.result.sparkDelay,
      in: motion.result.sparkIn,
      out: motion.result.sparkOut,
      lift: motion.result.sparkLift,
      scale: motion.result.sparkScale,
    });
  });

  it("builds each config once so an effect keyed on it does not restart", () => {
    expect(homeMotion(false)).toBe(homeMotion(false));
    expect(exerciseMotion(false)).toBe(exerciseMotion(false));
    expect(resultMotion(false)).toBe(resultMotion(false));
    expect(focusMotion(false)).toBe(focusMotion(false));
  });
});

describe("shakeSteps and popSteps", () => {
  it("turns the shake offsets into timed steps", () => {
    expect(shakeSteps([-8, 7, -5, 3, 0], 200)).toEqual([
      { to: -8, duration: 200 },
      { to: 7, duration: 200 },
      { to: -5, duration: 200 },
      { to: 3, duration: 200 },
      { to: 0, duration: 200 },
    ]);
    expect(shakeSteps([], 200)).toEqual([]);
  });

  it("turns the pop into the overshoot and the settle", () => {
    expect(popSteps({ delay: 980, up: 420, settle: 280, scale: 1.2 })).toEqual([
      { to: 1.2, duration: 420 },
      { to: 1, duration: 280 },
    ]);
  });
});
