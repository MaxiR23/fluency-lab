export const LEVELS = ["beginner", "intermediate", "advanced"] as const;
export const GOALS = ["work", "travel", "exams", "conversation"] as const;
export const PROVIDERS = ["claude", "openai"] as const;
export const SESSION_STATUSES = ["active", "ended"] as const;
export const TITLE_SOURCES = ["default", "auto", "user"] as const;
export const MESSAGE_ROLES = ["user", "tutor"] as const;
export const PRACTICE_FOCUSES = ["mistakes", "words", "topic", "note"] as const;
export const NOTE_KINDS = ["table", "summary"] as const;
export const PRACTICE_KINDS = ["choose", "fix", "gap", "translate"] as const;
export const PRACTICE_TARGETS = [5, 10, 15] as const;
export const PRACTICE_ROUND_SIZE = 5;
export const PRACTICE_MAX_TARGET = 15;
export const PRACTICE_AVOID_DAYS = 7;
export const PRACTICE_AVOID_LIMIT = 40;
export const PRACTICE_CHECK_STAGES = ["code", "solver", "reviewer", "grader"] as const;
export const PRACTICE_CHECK_REASONS = [
  "wrong_kind",
  "limit",
  "gap_count",
  "fix_already_answer",
  "fix_polarity",
  "hint_shows_answer",
  "prompt_shows_answer",
  "choose_options",
  "choose_answer_not_option",
  "translate_source_word",
  "repeat",
  "similar_prompt",
  "gap_word_doubled",
  "solver_mismatch",
  "solver_already_correct",
  "single_answer",
  "meaning_kept",
  "answer_not_in_prompt",
  "one_real_mistake",
  "natural_english",
  "solver_answer_accepted",
  "grader_flawed",
] as const;

export type Level = (typeof LEVELS)[number];
export type Goal = (typeof GOALS)[number];
export type Provider = (typeof PROVIDERS)[number];
export type SessionStatus = (typeof SESSION_STATUSES)[number];
export type TitleSource = (typeof TITLE_SOURCES)[number];
export type MessageRole = (typeof MESSAGE_ROLES)[number];
export type NoteKind = (typeof NOTE_KINDS)[number];
export type PracticeFocus = (typeof PRACTICE_FOCUSES)[number];
export type PracticeKind = (typeof PRACTICE_KINDS)[number];
export type PracticeTarget = (typeof PRACTICE_TARGETS)[number];
export type PracticeCheckStage = (typeof PRACTICE_CHECK_STAGES)[number];
export type PracticeCheckReason = (typeof PRACTICE_CHECK_REASONS)[number];

export const GOAL_LABELS: Record<Goal, string> = {
  work: "Work",
  travel: "Travel",
  exams: "Exams",
  conversation: "Everyday conversation",
};

export function goalLabel(goal: Goal): string {
  return GOAL_LABELS[goal];
}
