import { addDays, weekDates } from "@fluency-lab/shared";

// INFO: the week's local Monday 00:00 is always less than 8 days before now,
// whatever the zone, so reading sessions since this long ago covers the week.
export const WEEK_LOOKBACK_MS = 8 * 24 * 60 * 60 * 1000;

// INFO: Intl accepts raw offsets ("-03:00") and offset forms ("GMT-3"), which
// are not IANA zone names and make the week math throw, so they are refused.
const OFFSET_FORM = /^([+-]|(UTC|GMT)[+-])/;

export function isTimeZone(value: string): boolean {
  if (OFFSET_FORM.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch (error) {
    // INFO: validation, not a swallowed failure: an unknown zone throws a
    // RangeError and the route answers it as a 400 invalid_input.
    if (error instanceof RangeError) return false;
    throw error;
  }
}

export function localDate(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function currentWeek(now: Date, timeZone: string): { weekStart: string; today: string } {
  const today = localDate(now, timeZone);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  return { weekStart: addDays(today, -((weekday + 6) % 7)), today };
}

export type FinishedRun = { finishedAt: string | null; missed: boolean };

// INFO: a day counts with a chat or a finished run; it is perfect with at least one
// finished run without a missed item. perfectDays is a subset of days by construction.
export function weekDays(
  starts: readonly string[],
  runs: readonly FinishedRun[],
  timeZone: string,
  weekStart: string,
): { days: string[]; perfectDays: string[] } {
  const finished = runs.flatMap((run) =>
    run.finishedAt === null
      ? []
      : [{ date: localDate(new Date(run.finishedAt), timeZone), missed: run.missed }],
  );
  const counted = new Set([
    ...starts.map((start) => localDate(new Date(start), timeZone)),
    ...finished.map((run) => run.date),
  ]);
  const perfect = new Set(finished.filter((run) => !run.missed).map((run) => run.date));
  const week = weekDates(weekStart);
  return {
    days: week.filter((date) => counted.has(date)),
    perfectDays: week.filter((date) => perfect.has(date)),
  };
}
