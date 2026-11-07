export const LEVELS = ["beginner", "intermediate", "advanced"] as const;
export const GOALS = ["work", "travel", "exams", "conversation"] as const;
export const PROVIDERS = ["claude", "openai"] as const;
export const SESSION_STATUSES = ["active", "ended"] as const;
export const MESSAGE_ROLES = ["user", "tutor"] as const;
export const PRACTICE_FOCUSES = ["mistakes", "words", "topic"] as const;
export const PRACTICE_KINDS = ["choose", "fix", "gap", "translate"] as const;
export const PRACTICE_TARGETS = [5, 10, 15] as const;
export const PRACTICE_ROUND_SIZE = 5;
export const PRACTICE_MAX_TARGET = 15;

export type Level = (typeof LEVELS)[number];
export type Goal = (typeof GOALS)[number];
export type Provider = (typeof PROVIDERS)[number];
export type SessionStatus = (typeof SESSION_STATUSES)[number];
export type MessageRole = (typeof MESSAGE_ROLES)[number];
export type PracticeFocus = (typeof PRACTICE_FOCUSES)[number];
export type PracticeKind = (typeof PRACTICE_KINDS)[number];
export type PracticeTarget = (typeof PRACTICE_TARGETS)[number];

export const GOAL_LABELS: Record<Goal, string> = {
  work: "Work",
  travel: "Travel",
  exams: "Exams",
  conversation: "Everyday conversation",
};

export function goalLabel(goal: Goal): string {
  return GOAL_LABELS[goal];
}
