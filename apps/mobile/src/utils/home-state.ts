import type {
  ActiveSession,
  MistakePage,
  PracticeRunWithItems,
  Profile,
  SessionWeek,
} from "@fluency-lab/shared";

import type { DataFailure, DataOutcome } from "@/data/data-port";
import { todayCard, type TodayCard } from "@/utils/today-practice";
import { retryStarted } from "@/utils/load-failure";

export type HomeState =
  | { kind: "loading" }
  | { kind: "failed"; failure: DataFailure; retrying?: true }
  | {
      kind: "ready";
      profile: Profile;
      activeSession: ActiveSession | null;
      openCount: number;
      week: SessionWeek;
      today: TodayCard;
      loadedAt: number;
    };

export type HomeEvent =
  | { type: "load_started" }
  | {
      type: "loaded";
      profile: DataOutcome<Profile>;
      open: DataOutcome<ActiveSession[]>;
      week: DataOutcome<SessionWeek>;
      today: DataOutcome<PracticeRunWithItems | null>;
      mistakes: DataOutcome<MistakePage>;
      loadedAt: number;
    };

export const initialHome: HomeState = { kind: "loading" };

export function homeFromReads(
  profile: DataOutcome<Profile>,
  open: DataOutcome<ActiveSession[]>,
  week: DataOutcome<SessionWeek>,
  today: DataOutcome<PracticeRunWithItems | null>,
  mistakes: DataOutcome<MistakePage>,
  loadedAt: number,
): HomeState {
  if (!profile.ok) return { kind: "failed", failure: profile.failure };
  if (!open.ok) return { kind: "failed", failure: open.failure };
  if (!week.ok) return { kind: "failed", failure: week.failure };
  if (!today.ok) return { kind: "failed", failure: today.failure };
  if (!mistakes.ok) return { kind: "failed", failure: mistakes.failure };
  return {
    kind: "ready",
    profile: profile.value,
    activeSession: open.value[0] ?? null,
    openCount: open.value.length,
    week: week.value,
    today: todayCard({
      today: today.value,
      mistakes: mistakes.value,
      level: profile.value.level,
    }),
    loadedAt,
  };
}

export function homeReducer(state: HomeState, event: HomeEvent): HomeState {
  switch (event.type) {
    case "load_started":
      return retryStarted(state, initialHome);
    case "loaded":
      return homeFromReads(
        event.profile,
        event.open,
        event.week,
        event.today,
        event.mistakes,
        event.loadedAt,
      );
  }
}
