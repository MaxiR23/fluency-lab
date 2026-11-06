import { z } from "zod";
import { GOALS, LEVELS, MESSAGE_ROLES, PROVIDERS, SESSION_STATUSES } from "./profile-values";
import { MODEL_IDS } from "./model-price";
import { STARTER_IDS } from "./suggestions";
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

export const sessionCreateSchema = z.union([
  z.strictObject({ topicId: z.enum(TOPIC_IDS).nullable() }),
  z.strictObject({ starterId: z.enum(STARTER_IDS) }),
]);

export const correctionSchema = z.strictObject({
  original: z.string().trim().min(1).max(300),
  corrected: z.string().trim().min(1).max(300),
  rule: z.string().trim().min(1).max(80).optional(),
});

export const messageCorrectionsSchema = z.strictObject({
  items: z.array(correctionSchema).max(10),
  explanation: z.string().trim().min(1).max(300).nullable(),
});

// INFO: the read side of a correction. A tutor that agrees the learner was right
// withdraws it: the item is kept and flagged. The create side stays strict, so a
// client cannot send a correction already withdrawn.
export const storedCorrectionSchema = z.strictObject({
  ...correctionSchema.shape,
  withdrawn: z.literal(true).optional(),
});

export const storedMessageCorrectionsSchema = z.strictObject({
  items: z.array(storedCorrectionSchema).max(10),
  explanation: z.string().trim().min(1).max(300).nullable(),
});

export const newWordsSchema = z.array(z.string().trim().min(1).max(60)).max(10);

// INFO: the shape of the structured output of the tutor. It is parsed loosely
// here and normalized by the app before it is saved. rule is optional here so
// a paid reply that lacks it is kept.
export const tutorReplySchema = z.object({
  reply: z.string(),
  corrections: z.array(
    z.object({ original: z.string(), corrected: z.string(), rule: z.string().optional() }),
  ),
  explanation: z.string(),
  newWords: z.array(z.string()),
});

export const messageCreateSchema = z.strictObject({
  role: z.enum(MESSAGE_ROLES),
  text: z.string().trim().min(1).max(4000),
  corrections: messageCorrectionsSchema.optional(),
  newWords: newWordsSchema.optional(),
  replyToId: z.uuid().optional(),
});

export const threadMessageCreateSchema = z.strictObject({
  role: z.enum(MESSAGE_ROLES),
  text: z.string().trim().min(1).max(4000),
  newWords: newWordsSchema.optional(),
});

// INFO: the shape of the structured output of the tutor in a thread. It is
// parsed loosely here and normalized by the app before it is saved. withdrawn
// holds the numbers (from 1) of the corrections the tutor takes back.
export const threadReplySchema = z.object({
  reply: z.string(),
  newWords: z.array(z.string()),
  withdrawn: z.array(z.number()),
});

export const withdrawSchema = z.strictObject({
  items: z.array(z.int().min(0).max(9)).min(1).max(10).refine(isUnique),
});

const tokenCount = z.int().min(0).max(10_000_000);

export const sessionUsageSchema = z.strictObject({
  model: z.enum(MODEL_IDS),
  inputTokens: tokenCount,
  outputTokens: tokenCount,
  cacheCreationInputTokens: tokenCount,
  cacheReadInputTokens: tokenCount,
});

export const sessionIdParamSchema = z.object({ id: z.uuid() });

export const messageIdParamSchema = z.object({ id: z.uuid() });

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

// INFO: corrections and newWords have concrete, non-recursive shapes, so the
// typed client (hc) can type them. z.json() is recursive and made hc fail with
// "Type instantiation is excessively deep".
export const messageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: z.enum(MESSAGE_ROLES),
  text: z.string(),
  corrections: storedMessageCorrectionsSchema.nullable(),
  newWords: newWordsSchema.nullable(),
  replyToId: z.string().nullable(),
  createdAt: z.string(),
});

export const activeSessionSchema = z.object({
  session: sessionSchema,
  lastMessage: messageSchema.nullable(),
});

export const activeSessionResponseSchema = z.object({
  activeSession: activeSessionSchema.nullable(),
});

export const openSessionsResponseSchema = z.object({
  sessions: z.array(activeSessionSchema),
});

export const sessionWeekSchema = z.object({
  weekStart: z.iso.date(),
  today: z.iso.date(),
  days: z.array(z.iso.date()),
});

export const weekQuerySchema = z.object({ tz: z.string().min(1).max(100) });

export const threadMessageSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  role: z.enum(MESSAGE_ROLES),
  text: z.string(),
  newWords: newWordsSchema.nullable(),
  createdAt: z.string(),
});

export const correctionThreadSchema = z.object({
  session: sessionSchema,
  message: messageSchema,
  messages: z.array(threadMessageSchema),
});

// INFO: only messages with at least one thread row are listed.
export const threadRepliesSchema = z.array(
  z.object({ messageId: z.string(), count: z.int().min(1) }),
);

export const sessionMessagesResponseSchema = z.object({
  session: sessionSchema,
  messages: z.array(messageSchema),
  threadReplies: threadRepliesSchema,
});

export const sessionSummarySchema = z.object({
  session: sessionSchema,
  messageCount: z.int().min(0),
  corrections: z.array(correctionSchema),
  newWords: z.array(z.string()),
});

export const monthSpendSchema = z.object({
  monthStart: z.iso.date(),
  spentUsd: z.number().min(0),
});

export const profileStatsSchema = z.object({
  sessions: z.int().min(0),
  dayStreak: z.int().min(0),
  newWords: z.int().min(0),
});

const pageOffset = z
  .string()
  .regex(/^(0|[1-9]\d{0,5})$/)
  .transform(Number);

export const progressPageQuerySchema = z.object({
  tz: z.string().min(1).max(100),
  offset: pageOffset.optional(),
});

export const mistakesQuerySchema = z.object({ offset: pageOffset.optional() });

export const monthProgressSchema = z.object({
  monthStart: z.iso.date(),
  sessions: z.int().min(0),
  corrections: z.int().min(0),
  newWords: z.int().min(0),
});

export const historyItemSchema = z.object({
  session: sessionSchema,
  day: z.iso.date(),
  messageCount: z.int().min(0),
  correctionCount: z.int().min(0),
});

export const historyPageSchema = z.object({
  items: z.array(historyItemSchema),
  nextOffset: z.int().min(1).nullable(),
});

export const mistakeGroupSchema = z.object({
  rule: z.string().nullable(),
  times: z.int().min(1),
  latest: z.object({ original: z.string(), corrected: z.string() }),
});

export const mistakePageSchema = z.object({
  items: z.array(mistakeGroupSchema),
  nextOffset: z.int().min(1).nullable(),
});

export const newWordItemSchema = z.object({
  word: z.string(),
  sentence: z.string(),
  day: z.iso.date(),
});

export const wordPageSchema = z.object({
  items: z.array(newWordItemSchema),
  nextOffset: z.int().min(1).nullable(),
});

export const accountDeletedSchema = z.object({ deleted: z.literal(true) });

export type Profile = z.infer<typeof profileSchema>;
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type SessionCreate = z.infer<typeof sessionCreateSchema>;
export type SessionWeek = z.infer<typeof sessionWeekSchema>;
export type Message = z.infer<typeof messageSchema>;
export type ActiveSession = z.infer<typeof activeSessionSchema>;
export type Correction = z.infer<typeof correctionSchema>;
export type MessageCorrections = z.infer<typeof messageCorrectionsSchema>;
export type MessageCreate = z.infer<typeof messageCreateSchema>;
export type SessionUsage = z.infer<typeof sessionUsageSchema>;
export type TutorReplyPayload = z.infer<typeof tutorReplySchema>;
export type MonthSpend = z.infer<typeof monthSpendSchema>;
export type SessionWithMessages = z.infer<typeof sessionMessagesResponseSchema>;
export type SessionSummary = z.infer<typeof sessionSummarySchema>;
export type ProfileStats = z.infer<typeof profileStatsSchema>;
export type AccountDeleted = z.infer<typeof accountDeletedSchema>;
export type MonthProgress = z.infer<typeof monthProgressSchema>;
export type HistoryItem = z.infer<typeof historyItemSchema>;
export type HistoryPage = z.infer<typeof historyPageSchema>;
export type MistakeGroup = z.infer<typeof mistakeGroupSchema>;
export type MistakePage = z.infer<typeof mistakePageSchema>;
export type NewWordItem = z.infer<typeof newWordItemSchema>;
export type WordPage = z.infer<typeof wordPageSchema>;
export type StoredCorrection = z.infer<typeof storedCorrectionSchema>;
export type ThreadMessage = z.infer<typeof threadMessageSchema>;
export type ThreadMessageCreate = z.infer<typeof threadMessageCreateSchema>;
export type CorrectionThread = z.infer<typeof correctionThreadSchema>;
export type Withdraw = z.infer<typeof withdrawSchema>;
export type ThreadReplies = z.infer<typeof threadRepliesSchema>;
export type ThreadReplyPayload = z.infer<typeof threadReplySchema>;
