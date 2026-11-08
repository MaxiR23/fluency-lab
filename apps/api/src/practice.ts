import type { PracticeRunWithItems } from "@fluency-lab/shared";
import { localDate } from "./week";

// INFO: a local day starts less than 24 hours before now in any zone. Reading
// runs since two days ago keeps a margin, as the week reads 8 days for 7.
export const PRACTICE_LOOKBACK_MS = 2 * 24 * 60 * 60 * 1000;

// INFO: null is the expected empty: no practice was started today. Today's run
// is the newest one created on today's local date in the learner's zone.
export function todayRun(
  runs: readonly PracticeRunWithItems[],
  timeZone: string,
  today: string,
): PracticeRunWithItems | null {
  let newest: PracticeRunWithItems | null = null;
  for (const entry of runs) {
    if (localDate(new Date(entry.run.createdAt), timeZone) !== today) continue;
    if (newest === null || Date.parse(entry.run.createdAt) > Date.parse(newest.run.createdAt)) {
      newest = entry;
    }
  }
  return newest;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// INFO: the start of the window of recent prompts: the given days back from the time.
export function recentPromptsSince(at: Date, days: number): string {
  return new Date(at.getTime() - days * DAY_MS).toISOString();
}
