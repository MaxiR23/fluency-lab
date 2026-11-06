import { borderWidth, motion, size, spacing } from "@/constants/theme";

export type TabBarLayout = { bottom: number; height: number; clearance: number };

// INFO: the design's bar is 52 tall tabs in a 6 padding and a 1 border; Home's content ends 14
// above it (home.html pads by 110 with the bar at 30).
export function tabBarLayout(bottomInset: number): TabBarLayout {
  const bottom = Math.max(bottomInset, spacing.tabBarBottom);
  const height = size.control + 2 * spacing.stack + 2 * borderWidth.thin;
  return { bottom, height, clearance: bottom + height + spacing.card };
}

export function pillWidth(rowWidth: number, count: number): number {
  if (rowWidth <= 0 || count <= 0) return 0;
  return rowWidth / count;
}

export function pillOffset(index: number, rowWidth: number, count: number): number {
  if (count <= 0) return 0;
  const clamped = Math.min(Math.max(index, 0), count - 1);
  return clamped * pillWidth(rowWidth, count);
}

export type PillMotion = { duration: number; dampingRatio: number };

// INFO: the same object every call, so the bar's effect does not restart the spring on every
// render.
const pillSpring: PillMotion = {
  duration: motion.pillDuration,
  dampingRatio: motion.pillDampingRatio,
};

export function tabPillMotion(reduceMotion: boolean): PillMotion | null {
  return reduceMotion ? null : pillSpring;
}
