import type { Goal, Level, Profile, ProfileUpdate, Provider, TopicId } from "@fluency-lab/shared";

import type { DataFailure, DataOutcome } from "@/data/data-port";
import { nameError } from "@/utils/auth-form";
import { canContinue, monthlyLimitError, parseMonthlyLimit, toggle } from "@/utils/onboarding-form";
import { DEFAULT_MONTHLY_LIMIT, stepTitles } from "@/utils/onboarding-options";

export type EditField = "name" | "limit" | "provider" | "level" | "goals" | "topics";

const FIELDS: readonly EditField[] = ["name", "limit", "provider", "level", "goals", "topics"];

// INFO: mirrors profileUpdateSchema.displayName.
const MAX_NAME_LENGTH = 80;

export function editField(param: string | string[] | undefined): EditField | null {
  const value = Array.isArray(param) ? param[0] : param;
  return FIELDS.find((field) => field === value) ?? null;
}

export function editTitle(field: EditField): string {
  switch (field) {
    case "name":
      return "Your name";
    case "limit":
      return "Monthly limit";
    case "provider":
      return "Provider";
    case "level":
      return stepTitles[0];
    case "goals":
      return stepTitles[1];
    case "topics":
      return stepTitles[2];
  }
}

export type EditDraft = {
  name: string;
  limit: string;
  provider: Provider;
  level: Level | null;
  goals: Goal[];
  topics: TopicId[];
};

export function editDraft(profile: Profile): EditDraft {
  return {
    name: profile.displayName ?? "",
    limit:
      profile.monthlyLimitUsd === null ? DEFAULT_MONTHLY_LIMIT : String(profile.monthlyLimitUsd),
    provider: profile.provider ?? "claude",
    level: profile.level,
    goals: profile.goals,
    topics: profile.topics,
  };
}

export type EditDraftEvent =
  | { type: "name_changed"; name: string }
  | { type: "limit_changed"; limit: string }
  | { type: "provider_picked"; provider: Provider }
  | { type: "level_picked"; level: Level }
  | { type: "goal_toggled"; goal: Goal }
  | { type: "topic_toggled"; topic: TopicId };

export function editDraftReducer(draft: EditDraft, event: EditDraftEvent): EditDraft {
  switch (event.type) {
    case "name_changed":
      return { ...draft, name: event.name };
    case "limit_changed":
      return { ...draft, limit: event.limit };
    case "provider_picked":
      return { ...draft, provider: event.provider };
    case "level_picked":
      return { ...draft, level: event.level };
    case "goal_toggled":
      return { ...draft, goals: toggle(draft.goals, event.goal) };
    case "topic_toggled":
      return { ...draft, topics: toggle(draft.topics, event.topic) };
  }
}

// INFO: level, goals and topics follow the onboarding rules. The name and the limit show their
// errors on Save, like the key step does.
export function canSaveEdit(field: EditField, draft: EditDraft): boolean {
  switch (field) {
    case "level":
      return canContinue(1, onboardingShape(draft));
    case "goals":
      return canContinue(2, onboardingShape(draft));
    case "topics":
      return canContinue(3, onboardingShape(draft));
    default:
      return true;
  }
}

function onboardingShape(draft: EditDraft) {
  return {
    level: draft.level,
    goals: draft.goals,
    topics: draft.topics,
    provider: draft.provider,
    apiKey: "",
    monthlyLimit: draft.limit,
  };
}

export type EditErrors = { name?: string; limit?: string };

export function editErrors(field: EditField, draft: EditDraft): EditErrors {
  if (field === "name") {
    const missing = nameError(draft.name);
    if (missing !== undefined) return { name: missing };
    return draft.name.trim().length > MAX_NAME_LENGTH
      ? { name: `Use at most ${MAX_NAME_LENGTH} characters.` }
      : {};
  }
  if (field === "limit") {
    const error = monthlyLimitError(draft.limit);
    return error === undefined ? {} : { limit: error };
  }
  return {};
}

// INFO: only the edited field, from an explicit list. Null when the field is invalid.
export function editUpdate(field: EditField, draft: EditDraft): ProfileUpdate | null {
  switch (field) {
    case "name":
      return nameError(draft.name) === undefined ? { displayName: draft.name.trim() } : null;
    case "limit": {
      const limit = parseMonthlyLimit(draft.limit);
      return limit === null ? null : { monthlyLimitUsd: limit };
    }
    case "provider":
      return { provider: draft.provider };
    case "level":
      return draft.level === null ? null : { level: draft.level };
    case "goals":
      return { goals: draft.goals };
    case "topics":
      return { topics: draft.topics };
  }
}

export type EditState =
  | { kind: "loading" }
  | { kind: "failed"; failure: DataFailure }
  | {
      kind: "ready";
      draft: EditDraft;
      errors: EditErrors;
      saving: boolean;
      saveFailure: string | null;
    };

export type EditEvent =
  | { type: "load_started" }
  | { type: "loaded"; profile: DataOutcome<Profile> }
  | { type: "draft_changed"; event: EditDraftEvent }
  | { type: "save_blocked"; errors: EditErrors }
  | { type: "save_started" }
  | { type: "save_failed"; message: string }
  | { type: "save_finished" };

export const initialEditState: EditState = { kind: "loading" };

export function editStateReducer(state: EditState, event: EditEvent): EditState {
  switch (event.type) {
    case "load_started":
      return initialEditState;
    case "loaded":
      return event.profile.ok
        ? {
            kind: "ready",
            draft: editDraft(event.profile.value),
            errors: {},
            saving: false,
            saveFailure: null,
          }
        : { kind: "failed", failure: event.profile.failure };
  }
  if (state.kind !== "ready") return state;
  switch (event.type) {
    case "draft_changed":
      return {
        ...state,
        draft: editDraftReducer(state.draft, event.event),
        errors: {},
        saveFailure: null,
      };
    case "save_blocked":
      return { ...state, errors: event.errors, saving: false };
    case "save_started":
      return { ...state, errors: {}, saving: true, saveFailure: null };
    case "save_failed":
      return { ...state, saving: false, saveFailure: event.message };
    case "save_finished":
      return { ...state, saving: false };
  }
}
