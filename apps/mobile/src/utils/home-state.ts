import type { ActiveSession, Profile, SessionWeek } from "@fluency-lab/shared";

import type { DataFailure, DataOutcome } from "@/data/data-port";

export type HomeState =
  | { kind: "loading" }
  | { kind: "failed"; failure: DataFailure }
  | {
      kind: "ready";
      profile: Profile;
      activeSession: ActiveSession | null;
      openCount: number;
      week: SessionWeek;
      loadedAt: number;
    };

export type HomeEvent =
  | { type: "load_started" }
  | {
      type: "loaded";
      profile: DataOutcome<Profile>;
      open: DataOutcome<ActiveSession[]>;
      week: DataOutcome<SessionWeek>;
      loadedAt: number;
    };

export const initialHome: HomeState = { kind: "loading" };

export function homeFromReads(
  profile: DataOutcome<Profile>,
  open: DataOutcome<ActiveSession[]>,
  week: DataOutcome<SessionWeek>,
  loadedAt: number,
): HomeState {
  if (!profile.ok) return { kind: "failed", failure: profile.failure };
  if (!open.ok) return { kind: "failed", failure: open.failure };
  if (!week.ok) return { kind: "failed", failure: week.failure };
  return {
    kind: "ready",
    profile: profile.value,
    activeSession: open.value[0] ?? null,
    openCount: open.value.length,
    week: week.value,
    loadedAt,
  };
}

export function homeReducer(_state: HomeState, event: HomeEvent): HomeState {
  switch (event.type) {
    case "load_started":
      return initialHome;
    case "loaded":
      return homeFromReads(event.profile, event.open, event.week, event.loadedAt);
  }
}
