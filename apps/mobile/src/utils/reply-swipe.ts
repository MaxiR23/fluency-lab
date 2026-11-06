// INFO: these run on the UI thread inside the pan gesture's callbacks, so each one starts with
// the "worklet" directive; without it the first swipe crashes on a device while jest still passes.

export function swipeOffset(translationX: number, travel: number): number {
  "worklet";
  return Math.min(Math.max(translationX, 0), travel);
}

export function swipeArmed(translationX: number, travel: number): boolean {
  "worklet";
  return travel > 0 && translationX >= travel;
}

export function armCrossed(wasArmed: boolean, armed: boolean): boolean {
  "worklet";
  return !wasArmed && armed;
}

export function hintLook(
  offset: number,
  travel: number,
  startScale: number,
): { opacity: number; scale: number } {
  "worklet";
  const progress = travel <= 0 ? 0 : Math.min(Math.max(offset / travel, 0), 1);
  return { opacity: progress, scale: startScale + (1 - startScale) * progress };
}

// INFO: a rightward move of the slop activates the pan and a vertical move of the slop fails it,
// so the list's vertical scroll wins.
export function replyPanOffsets(slop: number): {
  activeOffsetX: number;
  failOffsetY: [number, number];
} {
  return { activeOffsetX: slop, failOffsetY: [-slop, slop] };
}
