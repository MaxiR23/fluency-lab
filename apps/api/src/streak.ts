import { addDays } from "@fluency-lab/shared";

// INFO: the streak is alive until today ends. It counts the consecutive
// active days (a chat or a finished practice) back from today, or back from
// yesterday when today has none yet. The days are already local dates of the user's zone (the database
// buckets them), so no zone logic is needed here.
export function dayStreak(days: readonly string[], today: string): number {
  const set = new Set(days);
  let day = set.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (set.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}
