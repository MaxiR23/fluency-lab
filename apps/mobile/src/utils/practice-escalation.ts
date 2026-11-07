import { PRACTICE_MAX_TARGET, PRACTICE_ROUND_SIZE, type PracticeItem } from "@fluency-lab/shared";

type Marked = Pick<PracticeItem, "position" | "correct" | "rule">;

export type PracticeStep = "answer" | "ask" | "offer" | "finish";

export function answeredCount(items: readonly Pick<PracticeItem, "correct">[]): number {
  return items.filter((item) => item.correct !== null).length;
}

// INFO: the last round is the last five positions before the target. A miss in
// an earlier round does not offer more.
export function lastRoundMissed(items: readonly Marked[], target: number): boolean {
  const first = target - PRACTICE_ROUND_SIZE;
  return items.some(
    (item) => item.position >= first && item.position < target && item.correct === false,
  );
}

export function practiceNext(items: readonly Marked[], target: number): PracticeStep {
  if (items.some((item) => item.correct === null)) return "answer";
  if (items.length < target) return "ask";
  if (lastRoundMissed(items, target) && target < PRACTICE_MAX_TARGET) return "offer";
  return "finish";
}

export function keepGoingTarget(target: number): number {
  return Math.min(PRACTICE_MAX_TARGET, target + PRACTICE_ROUND_SIZE);
}

export function roundSize(items: readonly unknown[], target: number): number {
  return Math.max(0, Math.min(PRACTICE_ROUND_SIZE, target - items.length));
}

export function missedRules(items: readonly Marked[]): string[] {
  const rules: string[] = [];
  for (const item of items) {
    if (item.correct === false && !rules.includes(item.rule)) rules.push(item.rule);
  }
  return rules;
}
