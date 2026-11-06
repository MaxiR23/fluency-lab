import { localDate } from "./week";

// INFO: the local first of the month is always less than 32 days before now,
// whatever the zone, so reading sessions since this long ago covers the month.
export const MONTH_LOOKBACK_MS = 32 * 24 * 60 * 60 * 1000;

export function currentMonthStart(now: Date, timeZone: string): string {
  return `${localDate(now, timeZone).slice(0, 7)}-01`;
}

export function monthSpend(
  rows: readonly { createdAt: string; costUsd: number }[],
  timeZone: string,
  monthStart: string,
): number {
  const total = rows
    .filter((row) => localDate(new Date(row.createdAt), timeZone) >= monthStart)
    .reduce((sum, row) => sum + row.costUsd, 0);
  return Math.round(total * 1e8) / 1e8;
}
