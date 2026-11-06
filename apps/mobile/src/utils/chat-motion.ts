import { motion } from "@/constants/theme";

export type EnterMotion = { duration: number; offset: number };
export type FadeMotion = { duration: number };
export type PressMotion = { duration: number; scale: number };
export type DotPhases = { rise: number; fall: number; rest: number };
export type DotMotion = DotPhases & { stagger: number; lift: number; restOpacity: number };
export type ChatMotion = {
  enter: EnterMotion | null;
  fade: FadeMotion | null;
  press: PressMotion | null;
  dots: DotMotion | null;
  preview: EnterMotion | null;
  swipeBack: FadeMotion | null;
};

export function chatMotion(reduceMotion: boolean): ChatMotion {
  if (reduceMotion)
    return { enter: null, fade: null, press: null, dots: null, preview: null, swipeBack: null };
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
