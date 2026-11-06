import type { StoredCorrection } from "@fluency-lab/shared";

// INFO: the tutor names a correction by its number in the thread prompt, counted
// from 1. Only whole numbers that name a correction not yet withdrawn become
// 0-based indexes, each once and in order, so a wrong or repeated number from the
// model never reaches the database.
export function withdrawnIndexes(
  numbers: readonly number[],
  corrections: readonly StoredCorrection[],
): number[] {
  const indexes = new Set<number>();
  for (const number of numbers) {
    const index = number - 1;
    if (!Number.isInteger(index) || index < 0 || index >= corrections.length) continue;
    if (corrections[index].withdrawn === true) continue;
    indexes.add(index);
  }
  return [...indexes].sort((a, b) => a - b);
}

export function applyWithdrawal(
  corrections: readonly StoredCorrection[],
  indexes: readonly number[],
): StoredCorrection[] {
  return corrections.map((item, index) =>
    indexes.includes(index) ? { ...item, withdrawn: true } : item,
  );
}
