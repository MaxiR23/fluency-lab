export const LEVELS = ["beginner", "intermediate", "advanced"] as const;
export const GOALS = ["work", "travel", "exams", "conversation"] as const;
export const PROVIDERS = ["claude", "openai"] as const;
export const SESSION_STATUSES = ["active", "ended"] as const;
export const MESSAGE_ROLES = ["user", "tutor"] as const;

export type Level = (typeof LEVELS)[number];
export type Goal = (typeof GOALS)[number];
export type Provider = (typeof PROVIDERS)[number];
export type SessionStatus = (typeof SESSION_STATUSES)[number];
export type MessageRole = (typeof MESSAGE_ROLES)[number];
