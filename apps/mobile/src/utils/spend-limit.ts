export type SpendLevel = "ok" | "warning" | "blocked";

export const spendWarningText = "You're close to your monthly limit.";
export const limitReachedMessage = "You reached your monthly limit.";

// INFO: one unit is 1e-8 USD, the precision of the stored cost. Comparing whole
// units keeps float error from moving a threshold. No limit never warns or blocks.
const units = (usd: number): number => Math.round(usd * 1e8);

export function spendLevel(spentUsd: number, limitUsd: number | null): SpendLevel {
  if (limitUsd === null) return "ok";
  const spent = units(spentUsd);
  const limit = units(limitUsd);
  if (spent >= limit) return "blocked";
  if (spent * 5 >= limit * 4) return "warning";
  return "ok";
}
