const DAY_MS = 24 * 60 * 60 * 1000;

// INFO: plain calendar arithmetic over YYYY-MM-DD strings. UTC is only the
// carrier here, so there is no time zone and no daylight saving in the result.
export function addDays(date: string, days: number): string {
  const moved = new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS);
  return moved.toISOString().slice(0, 10);
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}
