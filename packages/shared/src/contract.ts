import { z } from "zod";
import { GOALS, LEVELS, MESSAGE_ROLES, PROVIDERS, SESSION_STATUSES } from "./profile-values";
import { TOPIC_IDS } from "./topics";

// INFO: not multipleOf(0.01), whose float error rejects valid values like 0.07.
function hasAtMostCents(value: number): boolean {
  return Math.abs(Math.round(value * 100) - value * 100) < 1e-9;
}

function isUnique(list: readonly unknown[]): boolean {
  return new Set(list).size === list.length;
}

export const profileUpdateSchema = z
  .strictObject({
    displayName: z.string().trim().min(1).max(80).nullable().optional(),
    level: z.enum(LEVELS).optional(),
    goals: z.array(z.enum(GOALS)).max(GOALS.length).refine(isUnique).optional(),
    topics: z.array(z.enum(TOPIC_IDS)).max(TOPIC_IDS.length).refine(isUnique).optional(),
    provider: z.enum(PROVIDERS).optional(),
    monthlyLimitUsd: z.number().min(0.01).max(10000).refine(hasAtMostCents).optional(),
    onboardingCompleted: z.literal(true).optional(),
  })
  .refine((update) => Object.values(update).some((value) => value !== undefined));

export const sessionCreateSchema = z.strictObject({ topicId: z.enum(TOPIC_IDS).nullable() });

export const sessionIdParamSchema = z.object({ id: z.uuid() });

export const profileSchema = z.object({
  id: z.string(),
  displayName: z.string().nullable(),
  level: z.enum(LEVELS).nullable(),
  goals: z.array(z.enum(GOALS)),
  topics: z.array(z.enum(TOPIC_IDS)),
  provider: z.enum(PROVIDERS).nullable(),
  monthlyLimitUsd: z.number().nullable(),
  onboardingCompletedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const sessionSchema = z.object({
  id: z.string(),
  topicId: z.enum(TOPIC_IDS).nullable(),
  title: z.string(),
  status: z.enum(SESSION_STATUSES),
  summary: z.string().nullable(),
  costUsd: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// INFO: corrections and newWords are JSON from the database. They are typed unknown
// because z.json() is recursive and makes the typed client (hc) fail with
// "Type instantiation is excessively deep".
export const messageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: z.enum(MESSAGE_ROLES),
  text: z.string(),
  corrections: z.unknown().nullable(),
  newWords: z.unknown().nullable(),
  createdAt: z.string(),
});

export const activeSessionSchema = z.object({
  session: sessionSchema,
  lastMessage: messageSchema.nullable(),
});

export const activeSessionResponseSchema = z.object({
  activeSession: activeSessionSchema.nullable(),
});

export const messagesResponseSchema = z.object({ messages: z.array(messageSchema) });

export type Profile = z.infer<typeof profileSchema>;
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type SessionCreate = z.infer<typeof sessionCreateSchema>;
export type Message = z.infer<typeof messageSchema>;
export type ActiveSession = z.infer<typeof activeSessionSchema>;
