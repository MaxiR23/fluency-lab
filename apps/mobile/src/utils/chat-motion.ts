import { motion } from "@/constants/theme";

export type EnterMotion = {
  duration: number;
  offset: number;
  delay?: number;
  curve?: readonly [number, number, number, number];
};
export type FadeMotion = { duration: number };
export type PressMotion = { duration: number; scale: number };
export type SavedMotion = { delay: number; duration: number; scale: number };
export type DotPhases = { rise: number; fall: number; rest: number };
export type DotMotion = DotPhases & { stagger: number; lift: number; restOpacity: number };
export type ChatMotion = {
  enter: EnterMotion | null;
  fade: FadeMotion | null;
  press: PressMotion | null;
  dots: DotMotion | null;
  preview: EnterMotion | null;
  swipeBack: FadeMotion | null;
  noteEnter: EnterMotion | null;
  saved: SavedMotion | null;
};

export function chatMotion(reduceMotion: boolean): ChatMotion {
  if (reduceMotion)
    return {
      enter: null,
      fade: null,
      press: null,
      dots: null,
      preview: null,
      swipeBack: null,
      noteEnter: null,
      saved: null,
    };
  return {
    enter: { duration: motion.enterDuration, offset: motion.enterOffset },
    fade: { duration: motion.fadeDuration },
    press: { duration: motion.pressDuration, scale: motion.pressScale },
    dots: {
      ...dotPhases(motion.dotCycle),
      stagger: motion.dotStagger,
      lift: motion.dotLift,
      restOpacity: motion.dotRestOpacity,
    },
    preview: { duration: motion.enterDuration, offset: motion.previewOffset },
    swipeBack: { duration: motion.enterDuration },
    // INFO: a tutor row with a study note enters slower than a plain row (note-in-chat.html).
    noteEnter: { duration: motion.note.enterDuration, offset: motion.enterOffset },
    saved: {
      delay: motion.note.savedDelay,
      duration: motion.note.savedDuration,
      scale: motion.note.savedScale,
    },
  };
}

// INFO: rise, fall and rest always add up to the cycle, so the loop never drifts.
export function dotPhases(cycle: number): DotPhases {
  if (cycle <= 0) return { rise: 0, fall: 0, rest: 0 };
  const rise = Math.round(cycle * motion.dotPeakAt);
  const fall = Math.round(cycle * motion.dotSettleAt) - rise;
  return { rise, fall, rest: cycle - rise - fall };
}

export function dotDelay(index: number, stagger: number): number {
  return Math.max(0, index) * stagger;
}

export function pressedScale(pressed: boolean, press: PressMotion | null): number {
  return pressed && press !== null ? press.scale : 1;
}
