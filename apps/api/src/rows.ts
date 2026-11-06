import {
  GOALS,
  LEVELS,
  MESSAGE_ROLES,
  PROVIDERS,
  SESSION_STATUSES,
  TOPIC_IDS,
  type Message,
  type Profile,
  type ProfileUpdate,
  type Session,
} from "@fluency-lab/shared";
import { z } from "zod";

const profileRowSchema = z.object({
  id: z.string(),
  display_name: z.string().nullable(),
  level: z.enum(LEVELS).nullable(),
  goals: z.array(z.enum(GOALS)),
  topics: z.array(z.enum(TOPIC_IDS)),
  monthly_limit_usd: z.number().nullable(),
  provider: z.enum(PROVIDERS).nullable(),
  onboarding_completed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const sessionRowSchema = z.object({
  id: z.string(),
  topic_id: z.enum(TOPIC_IDS).nullable(),
  title: z.string(),
  status: z.enum(SESSION_STATUSES),
  summary: z.string().nullable(),
  cost_usd: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

const messageRowSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  role: z.enum(MESSAGE_ROLES),
  text: z.string(),
  corrections: z.json().nullable(),
  new_words: z.json().nullable(),
  created_at: z.string(),
});

export function toProfile(row: unknown): Profile | null {
  const parsed = profileRowSchema.safeParse(row);
  if (!parsed.success) return null;
  const r = parsed.data;
  return {
    id: r.id,
    displayName: r.display_name,
    level: r.level,
    goals: r.goals,
    topics: r.topics,
    provider: r.provider,
    monthlyLimitUsd: r.monthly_limit_usd,
    onboardingCompletedAt: r.onboarding_completed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function toSession(row: unknown): Session | null {
  const parsed = sessionRowSchema.safeParse(row);
  if (!parsed.success) return null;
  const r = parsed.data;
  return {
    id: r.id,
    topicId: r.topic_id,
    title: r.title,
    status: r.status,
    summary: r.summary,
    costUsd: r.cost_usd,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function toMessage(row: unknown): Message | null {
  const parsed = messageRowSchema.safeParse(row);
  if (!parsed.success) return null;
  const r = parsed.data;
  return {
    id: r.id,
    sessionId: r.session_id,
    role: r.role,
    text: r.text,
    corrections: r.corrections,
    newWords: r.new_words,
    createdAt: r.created_at,
  };
}

export type ProfilePatch = {
  display_name?: string | null;
  level?: string;
  goals?: string[];
  topics?: string[];
  provider?: string;
  monthly_limit_usd?: number;
  onboarding_completed_at?: string;
};

export function toProfilePatch(update: ProfileUpdate, now: Date): ProfilePatch {
  const patch: ProfilePatch = {};
  if (update.displayName !== undefined) patch.display_name = update.displayName;
  if (update.level !== undefined) patch.level = update.level;
  if (update.goals !== undefined) patch.goals = update.goals;
  if (update.topics !== undefined) patch.topics = update.topics;
  if (update.provider !== undefined) patch.provider = update.provider;
  if (update.monthlyLimitUsd !== undefined) patch.monthly_limit_usd = update.monthlyLimitUsd;
  if (update.onboardingCompleted !== undefined) {
    patch.onboarding_completed_at = now.toISOString();
  }
  return patch;
}
