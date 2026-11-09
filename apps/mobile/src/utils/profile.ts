import { catalogTopicIds } from "@fluency-lab/shared";
import type { Profile, ProfileStats } from "@fluency-lab/shared";

import type { FailureCause } from "@/auth/auth-port";
import type { DataFailure, DataOutcome } from "@/data/data-port";
import type { PromptButton } from "@/utils/chat-state";
import { avatarInitial } from "@/utils/home";
import { goalOptions, levelOptions } from "@/utils/onboarding-options";
import { selectedCountLabel } from "@/utils/onboarding-form";

const NOT_SET = "Not set";

export type ProfileState =
  | { kind: "loading" }
  | { kind: "failed"; failure: DataFailure }
  | { kind: "ready"; profile: Profile; stats: ProfileStats };

export type ProfileEvent =
  | { type: "load_started" }
  | { type: "loaded"; profile: DataOutcome<Profile>; stats: DataOutcome<ProfileStats> };

export const initialProfile: ProfileState = { kind: "loading" };

export function profileFromReads(
  profile: DataOutcome<Profile>,
  stats: DataOutcome<ProfileStats>,
): ProfileState {
  if (!profile.ok) return { kind: "failed", failure: profile.failure };
  if (!stats.ok) return { kind: "failed", failure: stats.failure };
  return { kind: "ready", profile: profile.value, stats: stats.value };
}

export function profileReducer(_state: ProfileState, event: ProfileEvent): ProfileState {
  switch (event.type) {
    case "load_started":
      return initialProfile;
    case "loaded":
      return profileFromReads(event.profile, event.stats);
  }
}

export function profileHeader(
  profile: Profile,
  email: string | null,
): { initial: string | null; name: string; email: string | null } {
  const initial = avatarInitial(profile.displayName);
  return {
    initial,
    name: initial === null ? "No name set" : (profile.displayName?.trim() ?? "No name set"),
    email,
  };
}

export function statTiles(stats: ProfileStats): { value: string; label: string }[] {
  return [
    { value: String(stats.sessions), label: "Sessions" },
    { value: String(stats.dayStreak), label: "Day streak" },
    { value: String(stats.newWords), label: "New words" },
  ];
}

export function learningValues(profile: Profile): {
  level: string;
  goals: string;
  topics: string;
} {
  const level = levelOptions.find((option) => option.id === profile.level)?.label ?? NOT_SET;
  const goals = goalOptions
    .filter((option) => profile.goals.includes(option.id))
    .map((option) => option.label);
  return {
    level,
    goals: goals.length === 0 ? NOT_SET : goals.join(", "),
    topics: selectedCountLabel(catalogTopicIds(profile.topics).length),
  };
}

export const deleteAccountPrompt = {
  title: "Delete your account?",
  message: "This removes your profile, chats and progress. It can't be undone.",
} as const;

export function deleteAccountButtons(onDelete: () => void): PromptButton[] {
  return [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: onDelete },
  ];
}

// INFO: the deletion runs three steps in order. A failure keeps its step, so a retry resumes
// there and never deletes the account twice.
export type DeletionStep = "idle" | "account" | "key" | "session";

export type Deletion = {
  step: DeletionStep;
  running: boolean;
  failure: { message: string; cause?: FailureCause } | null;
};

export type DeletionEvent =
  | { type: "started" }
  | { type: "account_deleted" }
  | { type: "key_cleared" }
  | { type: "failed"; step: DeletionStep; message: string; cause?: FailureCause };

export const initialDeletion: Deletion = { step: "idle", running: false, failure: null };

export function deletionReducer(state: Deletion, event: DeletionEvent): Deletion {
  switch (event.type) {
    case "started":
      return {
        step: state.step === "idle" ? "account" : state.step,
        running: true,
        failure: null,
      };
    case "account_deleted":
      return { step: "key", running: true, failure: null };
    case "key_cleared":
      return { step: "session", running: true, failure: null };
    case "failed":
      return {
        step: event.step,
        running: false,
        failure:
          event.cause === undefined
            ? { message: event.message }
            : { message: event.message, cause: event.cause },
      };
  }
}
