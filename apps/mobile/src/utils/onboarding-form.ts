import type { Goal, Level, Provider, ProfileUpdate, TopicId } from "@fluency-lab/shared";

import { DEFAULT_MONTHLY_LIMIT, ONBOARDING_STEPS } from "@/utils/onboarding-options";

export const MIN_TOPICS = 3;

export type Step = 1 | 2 | 3 | 4;

export type OnboardingDraft = {
  level: Level | null;
  goals: Goal[];
  topics: TopicId[];
  provider: Provider;
  apiKey: string;
  monthlyLimit: string;
};

export type OnboardingForm = { step: Step; draft: OnboardingDraft };

export type OnboardingEvent =
  | { type: "level_picked"; level: Level }
  | { type: "goal_toggled"; goal: Goal }
  | { type: "topic_toggled"; topic: TopicId }
  | { type: "provider_picked"; provider: Provider }
  | { type: "api_key_changed"; apiKey: string }
  | { type: "monthly_limit_changed"; monthlyLimit: string }
  | { type: "continued" }
  | { type: "went_back" };

export const initialOnboardingForm: OnboardingForm = {
  step: 1,
  draft: {
    level: null,
    goals: [],
    topics: [],
    provider: "claude",
    apiKey: "",
    monthlyLimit: DEFAULT_MONTHLY_LIMIT,
  },
};

export function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];
}

export function canContinue(step: Step, draft: OnboardingDraft): boolean {
  switch (step) {
    case 1:
      return draft.level !== null;
    case 2:
      return draft.goals.length >= 1;
    case 3:
      return draft.topics.length >= MIN_TOPICS;
    case 4:
      return true;
  }
}

export function showsBack(step: Step): boolean {
  return step > 1;
}

export function stepLabel(step: number): string {
  return `Step ${step} of ${ONBOARDING_STEPS}`;
}

export function selectedCountLabel(count: number): string {
  return `${count} selected`;
}

export function onboardingFormReducer(
  form: OnboardingForm,
  event: OnboardingEvent,
): OnboardingForm {
  const { step, draft } = form;
  switch (event.type) {
    case "level_picked":
      return { step, draft: { ...draft, level: event.level } };
    case "goal_toggled":
      return { step, draft: { ...draft, goals: toggle(draft.goals, event.goal) } };
    case "topic_toggled":
      return { step, draft: { ...draft, topics: toggle(draft.topics, event.topic) } };
    case "provider_picked":
      return { step, draft: { ...draft, provider: event.provider } };
    case "api_key_changed":
      return { step, draft: { ...draft, apiKey: event.apiKey } };
    case "monthly_limit_changed":
      return { step, draft: { ...draft, monthlyLimit: event.monthlyLimit } };
    case "continued":
      if (step === 4 || !canContinue(step, draft)) return form;
      return { step: (step + 1) as Step, draft };
    case "went_back":
      if (step === 1) return form;
      return { step: (step - 1) as Step, draft };
  }
}

const MIN_LIMIT = 0.01;
const MAX_LIMIT = 10000;
const limitPattern = /^\d+(\.\d{1,2})?$/;

// INFO: mirrors profileUpdateSchema.monthlyLimitUsd: 0.01 to 10000, at most cents.
export function parseMonthlyLimit(text: string): number | null {
  const trimmed = text.trim();
  if (!limitPattern.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= MIN_LIMIT && value <= MAX_LIMIT ? value : null;
}

export type AiStepErrors = { apiKey?: string; monthlyLimit?: string };

export function normalizeApiKey(key: string): string {
  return key.trim();
}

export function validateAiStep(input: { apiKey: string; monthlyLimit: string }): AiStepErrors {
  const errors: AiStepErrors = {};
  if (normalizeApiKey(input.apiKey) === "") {
    errors.apiKey = "Enter your API key, or skip for now.";
  }
  if (input.monthlyLimit.trim() === "") {
    errors.monthlyLimit = "Enter an amount in USD.";
  } else if (parseMonthlyLimit(input.monthlyLimit) === null) {
    errors.monthlyLimit = "Enter an amount between 0.01 and 10000, with at most two decimals.";
  }
  return errors;
}

// INFO: built from an explicit field list, never a spread of the draft, so the
// API key cannot reach the data port. Skip leaves out provider and limit (the
// skipped step). A missing level is left out; steps 1-3 make that unreachable.
export function onboardingUpdate(draft: OnboardingDraft, mode: "finish" | "skip"): ProfileUpdate {
  const base: ProfileUpdate = {
    goals: draft.goals,
    topics: draft.topics,
    onboardingCompleted: true,
  };
  const withLevel: ProfileUpdate = draft.level === null ? base : { ...base, level: draft.level };
  if (mode === "skip") return withLevel;
  const limit = parseMonthlyLimit(draft.monthlyLimit);
  return {
    ...withLevel,
    provider: draft.provider,
    ...(limit === null ? {} : { monthlyLimitUsd: limit }),
  };
}
