import { z } from "zod";
import { GRAMMAR_TOPIC_IDS } from "./grammar-topics";
import {
  GOALS,
  LEVELS,
  MESSAGE_ROLES,
  NOTE_KINDS,
  PRACTICE_FOCUSES,
  PRACTICE_KINDS,
  PROVIDERS,
  SESSION_STATUSES,
} from "./profile-values";
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

const noteCell = z.string().trim().min(1).max(120);
const noteLabel = z.string().trim().min(1).max(40);
const noteRemember = z.string().trim().min(1).max(300);

export const noteTableContentSchema = z.strictObject({
  columns: z.tuple([noteLabel, noteLabel, noteLabel]),
  rows: z
    .array(z.tuple([noteCell, noteCell, noteCell]))
    .min(1)
    .max(8),
  remember: noteRemember,
});

export const noteSummaryContentSchema = z.strictObject({
  points: z.array(z.string().trim().min(1).max(200)).min(1).max(8),
  remember: noteRemember,
});

const noteTableShape = z.strictObject({
  kind: z.literal("table"),
  content: noteTableContentSchema,
});

const noteSummaryShape = z.strictObject({
  kind: z.literal("summary"),
  content: noteSummaryContentSchema,
});

// INFO: the one schema of a note's two shapes: the API validates a body and a row with it.
export const studyNoteShapeSchema = z.discriminatedUnion("kind", [
  noteTableShape,
  noteSummaryShape,
]);

const noteText = z.string().trim().min(1).max(80);
const noteFields = { title: noteText, topic: noteText };

export const studyNoteCreateSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...noteTableShape.shape, ...noteFields, sessionId: z.uuid().nullable() }),
  z.strictObject({ ...noteSummaryShape.shape, ...noteFields, sessionId: z.uuid().nullable() }),
]);

const storedNoteFields = {
  id: z.string(),
  sessionId: z.string().nullable(),
  sessionTitle: z.string().nullable(),
  title: z.string(),
  topic: z.string(),
  createdAt: z.string(),
};

export const studyNoteSchema = z.discriminatedUnion("kind", [
  z.object({ ...noteTableShape.shape, ...storedNoteFields }),
  z.object({ ...noteSummaryShape.shape, ...storedNoteFields }),
]);

export const noteListItemSchema = z.object({
  id: z.string(),
  kind: z.enum(NOTE_KINDS),
  title: z.string(),
  topic: z.string(),
  day: z.iso.date(),
});

export const notePageSchema = z.object({
  items: z.array(noteListItemSchema),
  nextOffset: z.int().min(1).nullable(),
  today: z.iso.date(),
});

export const noteIdParamSchema = z.object({ id: z.uuid() });

export const noteDeletedSchema = z.object({ id: z.string() });

// INFO: the structured output of a note, parsed loosely and normalized by the app (toStudyNote).
// columns, rows and points are empty when they do not apply.
export const studyNotePayloadSchema = z.object({
  kind: z.string(),
  title: z.string(),
  topic: z.string(),
  columns: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  points: z.array(z.string()),
  remember: z.string(),
});

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
  note: studyNotePayloadSchema.optional(),
});

export const messageCreateSchema = z.strictObject({
  role: z.enum(MESSAGE_ROLES),
  text: z.string().trim().min(1).max(4000),
  corrections: messageCorrectionsSchema.optional(),
  newWords: newWordsSchema.optional(),
  replyToId: z.uuid().optional(),
  noteId: z.uuid().optional(),
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

// INFO: the chat's summary of its older turns and the last message it covers.
// 2000 is the database check; the app keeps summaries under SUMMARY_MAX.
export const sessionContextSchema = z.strictObject({
  summary: z.string().trim().min(1).max(2000),
  throughId: z.uuid(),
});

export const sessionIdParamSchema = z.object({ id: z.uuid() });

export const messageIdParamSchema = z.object({ id: z.uuid() });

// INFO: the read side takes any topic id: the database no longer checks it, and
// the app draws an unknown one with its fallback. profileUpdateSchema keeps the catalog enum.
export const profileSchema = z.object({
  id: z.string(),
  displayName: z.string().nullable(),
  level: z.enum(LEVELS).nullable(),
  goals: z.array(z.enum(GOALS)),
  topics: z.array(z.string()),
  provider: z.enum(PROVIDERS).nullable(),
  monthlyLimitUsd: z.number().nullable(),
  onboardingCompletedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// INFO: the read side takes any id: the database no longer checks it, and
// the app draws an unknown one with its fallback. The create schemas keep the catalog enum.
export const sessionSchema = z.object({
  id: z.string(),
  topicId: z.string().nullable(),
  title: z.string(),
  status: z.enum(SESSION_STATUSES),
  summary: z.string().nullable(),
  contextSummary: z.string().nullable(),
  contextThroughId: z.string().nullable(),
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
  noteId: z.string().nullable(),
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

export const sessionWeekSchema = z
  .object({
    weekStart: z.iso.date(),
    today: z.iso.date(),
    days: z.array(z.iso.date()),
    perfectDays: z.array(z.iso.date()),
  })
  .refine((week) => week.perfectDays.every((day) => week.days.includes(day)));

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
  // INFO: the notes saved in this session; a message's noteId names one of them.
  notes: z.array(studyNoteSchema),
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

const practiceTargetValue = z.union([z.literal(5), z.literal(10), z.literal(15)]);

export const practiceRunCreateSchema = z.union([
  z.strictObject({ focus: z.enum(["mistakes", "words"]), target: practiceTargetValue }),
  z.strictObject({
    focus: z.literal("topic"),
    topicId: z.enum(GRAMMAR_TOPIC_IDS),
    target: practiceTargetValue,
  }),
  z.strictObject({ focus: z.literal("note"), noteId: z.uuid(), target: practiceTargetValue }),
]);

export const practiceItemCreateSchema = z
  .strictObject({
    position: z.int().min(0).max(14),
    kind: z.enum(PRACTICE_KINDS),
    rule: z.string().trim().min(1).max(80),
    prompt: z.string().trim().min(1).max(300),
    options: z.array(z.string().trim().min(1).max(120)).length(3).nullable(),
    accepted: z.array(z.string().trim().min(1).max(300)).min(1).max(5),
    explanation: z.string().trim().min(1).max(300),
    source: z.string().trim().min(1).max(300).nullable(),
  })
  .refine((item) => (item.kind === "choose") === (item.options !== null))
  .refine(
    (item) =>
      item.kind !== "choose" ||
      (item.options !== null &&
        item.accepted.length === 1 &&
        item.options.includes(item.accepted[0] ?? "")),
  );

export const practiceItemsCreateSchema = z.strictObject({
  items: z
    .array(practiceItemCreateSchema)
    .min(1)
    .max(5)
    .refine((items) => isUnique(items.map((item) => item.position))),
});

export const practiceAnswerSchema = z.strictObject({
  userAnswer: z.string().trim().min(1).max(300),
  correct: z.boolean(),
});

// INFO: a run only grows: 5 becomes 10 and 10 becomes 15.
export const practiceTargetSchema = z.strictObject({
  target: z.union([z.literal(10), z.literal(15)]),
});

export const practiceRunIdParamSchema = z.object({ id: z.uuid() });

export const practiceItemIdParamSchema = z.object({ id: z.uuid() });

// INFO: the read side takes any id: the database no longer checks it, and
// the app draws an unknown one with its fallback. The create schemas keep the catalog enum.
export const practiceRunSchema = z.object({
  id: z.string(),
  focus: z.enum(PRACTICE_FOCUSES),
  topicId: z.string().nullable(),
  noteId: z.string().nullable(),
  target: practiceTargetValue,
  costUsd: z.number(),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
});

export const practiceItemSchema = z.object({
  id: z.string(),
  runId: z.string(),
  position: z.int().min(0).max(14),
  kind: z.enum(PRACTICE_KINDS),
  rule: z.string(),
  prompt: z.string(),
  options: z.array(z.string()).nullable(),
  accepted: z.array(z.string()),
  explanation: z.string(),
  source: z.string().nullable(),
  userAnswer: z.string().nullable(),
  correct: z.boolean().nullable(),
  answeredAt: z.string().nullable(),
});

// INFO: a run with no items is the expected empty (its first round failed).
export const practiceRunWithItemsSchema = z.object({
  run: practiceRunSchema,
  items: z.array(practiceItemSchema),
});

// INFO: run null is the expected empty: no practice started today.
export const practiceTodaySchema = z.object({ run: practiceRunWithItemsSchema.nullable() });

// INFO: the regexes stay in sync with PRACTICE_AVOID_DAYS (1 to 7) and PRACTICE_AVOID_LIMIT (1 to 40).
const avoidDays = z
  .string()
  .regex(/^[1-7]$/)
  .transform(Number);
const avoidLimit = z
  .string()
  .regex(/^([1-9]|[1-3]\d|40)$/)
  .transform(Number);
export const recentPromptsQuerySchema = z.object({ days: avoidDays, limit: avoidLimit });

// INFO: newest first; [] is the expected empty: no practice in the last days.
export const recentPromptsSchema = z.object({
  items: z.array(z.object({ runId: z.string(), prompt: z.string(), rule: z.string() })),
});
export type RecentPrompt = z.infer<typeof recentPromptsSchema>["items"][number];

export const practiceItemsResponseSchema = z.object({ items: z.array(practiceItemSchema) });

// INFO: the shape of the structured output of a practice round. It is parsed
// loosely here and normalized by the app before it is saved. options is an
// empty array and source an empty string when they do not apply.
export const practiceRoundSchema = z.object({
  items: z.array(
    z.object({
      kind: z.string(),
      rule: z.string(),
      prompt: z.string(),
      options: z.array(z.string()),
      accepted: z.array(z.string()),
      explanation: z.string(),
      source: z.string(),
    }),
  ),
});

export const answerGradeSchema = z.object({
  flawed: z.boolean(),
  correct: z.boolean(),
  explanation: z.string(),
});

// INFO: the structured output of a context summary, parsed loosely and normalized by the app (toContextSummary).
export const contextSummarySchema = z.object({ summary: z.string() });

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
export type SessionContext = z.infer<typeof sessionContextSchema>;
export type ContextSummaryPayload = z.infer<typeof contextSummarySchema>;
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
export type PracticeRunCreate = z.infer<typeof practiceRunCreateSchema>;
export type PracticeItemCreate = z.infer<typeof practiceItemCreateSchema>;
export type PracticeAnswer = z.infer<typeof practiceAnswerSchema>;
export type PracticeRun = z.infer<typeof practiceRunSchema>;
export type PracticeItem = z.infer<typeof practiceItemSchema>;
export type PracticeRunWithItems = z.infer<typeof practiceRunWithItemsSchema>;
export type PracticeRoundPayload = z.infer<typeof practiceRoundSchema>;
export type AnswerGradePayload = z.infer<typeof answerGradeSchema>;
export type StudyNoteShape = z.infer<typeof studyNoteShapeSchema>;
export type StudyNoteCreate = z.infer<typeof studyNoteCreateSchema>;
export type StudyNote = z.infer<typeof studyNoteSchema>;
export type NoteListItem = z.infer<typeof noteListItemSchema>;
export type NotePage = z.infer<typeof notePageSchema>;
export type StudyNotePayload = z.infer<typeof studyNotePayloadSchema>;
// INFO: a create without its session; Omit does not distribute over the union.
export type StudyNoteDraft = StudyNoteShape & { title: string; topic: string };
