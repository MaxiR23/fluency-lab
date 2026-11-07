import { motion } from "@/constants/theme";
import type { EnterMotion } from "@/utils/chat-motion";

type Curve = readonly [number, number, number, number];
type RiseGroup = {
  riseDuration: number;
  riseStagger: number;
  riseOffset: number;
  riseDelay?: number;
};

export type RingMotion = { delay: number; duration: number; curve: Curve };
export type PopMotion = { delay: number; up: number; settle: number; scale: number };
export type Step = { to: number; duration: number };

export type HomeMotion = {
  rise: RiseGroup;
  ring: RingMotion;
  pop: PopMotion;
  glowCycle: number;
  nudge: { cycle: number; offset: number };
};
export type FocusMotion = { rise: RiseGroup };
export type ExerciseMotion = {
  fill: { duration: number; curve: Curve };
  pick: { duration: number };
  check: { delay: number; up: number; scale: number; settle: number };
  slot: { delay: number; duration: number; offset: number };
  sheet: { delayRight: number; delayMiss: number; duration: number; curve: Curve };
  shake: Step[];
  wrong: { duration: number };
};
export type SparkMotion = { delay: number; in: number; out: number; lift: number; scale: number };
export type ResultMotion = {
  ring: RingMotion;
  rise: RiseGroup;
  halo: { cycle: number };
  sparks: SparkMotion[];
};

// INFO: a ring is a dashed circle: the dash is the whole circumference and the offset hides
// the part that is not scored. The fraction is clamped to 0..1.
export function ringGeometry(
  radius: number,
  fraction: number,
): { circumference: number; offset: number } {
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, fraction));
  return { circumference, offset: circumference * (1 - clamped) };
}

// INFO: the entrance rises of a screen start one stagger apart, after the group's own delay.
export function riseMotion(
  group: RiseGroup,
  index: number,
  curve: Curve = motion.rise,
): EnterMotion {
  return {
    duration: group.riseDuration,
    offset: group.riseOffset,
    delay: (group.riseDelay ?? 0) + index * group.riseStagger,
    curve,
  };
}

export function shakeSteps(offsets: readonly number[], duration: number): Step[] {
  return offsets.map((to) => ({ to, duration }));
}

// INFO: the pop starts from 0, waits its delay, overshoots and settles at 1.
export function popSteps(pop: PopMotion): Step[] {
  return [
    { to: pop.scale, duration: pop.up },
    { to: 1, duration: pop.settle },
  ];
}

// INFO: each config is built once at module level, so an effect keyed on it does not restart.
const HOME: HomeMotion = {
  rise: motion.home,
  ring: { delay: motion.home.ringDelay, duration: motion.home.ringDuration, curve: motion.ring },
  pop: {
    delay: motion.home.popDelay,
    up: motion.home.popUp,
    settle: motion.home.popSettle,
    scale: motion.home.popScale,
  },
  glowCycle: motion.home.glowCycle,
  nudge: { cycle: motion.home.nudgeCycle, offset: motion.home.nudgeOffset },
};

const FOCUS: FocusMotion = { rise: motion.focus };

const EXERCISE: ExerciseMotion = {
  fill: { duration: motion.exercise.fillDuration, curve: motion.ring },
  pick: { duration: motion.exercise.pickDuration },
  check: {
    delay: motion.exercise.checkDelay,
    up: motion.exercise.checkUp,
    scale: motion.exercise.checkScale,
    settle: motion.exercise.checkSettle,
  },
  slot: {
    delay: motion.exercise.slotDelay,
    duration: motion.exercise.slotDuration,
    offset: motion.exercise.slotOffset,
  },
  sheet: {
    delayRight: motion.exercise.sheetDelayRight,
    delayMiss: motion.exercise.sheetDelayMiss,
    duration: motion.exercise.sheetDuration,
    curve: motion.sheet,
  },
  shake: shakeSteps(motion.exercise.shake, motion.exercise.shakeStep),
  wrong: { duration: motion.exercise.wrongDuration },
};

const RESULT: ResultMotion = {
  ring: {
    delay: motion.result.ringDelay,
    duration: motion.result.ringDuration,
    curve: motion.ring,
  },
  rise: motion.result,
  halo: { cycle: motion.result.haloCycle },
  sparks: motion.result.sparkStagger.map((stagger) => ({
    delay: motion.result.sparkDelay + stagger,
    in: motion.result.sparkIn,
    out: motion.result.sparkOut,
    lift: motion.result.sparkLift,
    scale: motion.result.sparkScale,
  })),
};

export function homeMotion(reduceMotion: boolean): HomeMotion | null {
  return reduceMotion ? null : HOME;
}

export function focusMotion(reduceMotion: boolean): FocusMotion | null {
  return reduceMotion ? null : FOCUS;
}

export function exerciseMotion(reduceMotion: boolean): ExerciseMotion | null {
  return reduceMotion ? null : EXERCISE;
}

export function resultMotion(reduceMotion: boolean): ResultMotion | null {
  return reduceMotion ? null : RESULT;
}
