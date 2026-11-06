import type { ActiveSession, Profile, SessionWeek } from "@fluency-lab/shared";

import type { DataFailure, DataOutcome } from "@/data/data-port";

export type HomeState =
  | { kind: "loading" }
  | { kind: "failed"; failure: DataFailure }
  | {
      kind: "ready";
      profile: Profile;
      activeSession: ActiveSession | null;
      week: SessionWeek;
      loadedAt: number;
    };

export type HomeEvent =
  | { type: "load_started" }
  | {
      type: "loaded";
      profile: DataOutcome<Profile>;
      active: DataOutcome<ActiveSession | null>;
      week: DataOutcome<SessionWeek>;
      loadedAt: number;
    };

export const initialHome: HomeState = { kind: "loading" };

export function homeFromReads(
  profile: DataOutcome<Profile>,
  active: DataOutcome<ActiveSession | null>,
  week: DataOutcome<SessionWeek>,
  loadedAt: number,
): HomeState {
  if (!profile.ok) return { kind: "failed", failure: profile.failure };
  if (!active.ok) return { kind: "failed", failure: active.failure };
  if (!week.ok) return { kind: "failed", failure: week.failure };
  return {
    kind: "ready",
    profile: profile.value,
    activeSession: active.value,
    week: week.value,
    loadedAt,
  };
}

export function homeReducer(_state: HomeState, event: HomeEvent): HomeState {
  switch (event.type) {
    case "load_started":
      return initialHome;
    case "loaded":
      return homeFromReads(event.profile, event.active, event.week, event.loadedAt);
  }
}
