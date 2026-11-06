export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

// INFO: the day is a validated YYYY-MM-DD; "2026-11-05" is "Nov 5".
export function shortDate(day: string): string {
  const month = Number(day.slice(5, 7));
  return `${MONTH_SHORT[month - 1]} ${Number(day.slice(8, 10))}`;
}
