import {
  GOALS,
  LEVELS,
  GRAMMAR_TOPIC_IDS,
  MESSAGE_ROLES,
  NOTE_KINDS,
  PRACTICE_FOCUSES,
  PRACTICE_KINDS,
  PROVIDERS,
  SESSION_STATUSES,
  TOPIC_IDS,
  newWordsSchema,
  storedMessageCorrectionsSchema,
  studyNoteShapeSchema,
  type ActiveSession,
  type Message,
  type PracticeItem,
  type PracticeRun,
  type PracticeRunWithItems,
  type Profile,
  type ProfileUpdate,
  type RecentPrompt,
  type Session,
  type StudyNote,
  type ThreadMessage,
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
  context_summary: z.string().nullable(),
  context_through_id: z.string().nullable(),
  cost_usd: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

const sessionStartRowSchema = z.object({ created_at: z.iso.datetime({ offset: true }) });

const sessionCostRowSchema = z.object({
  created_at: z.iso.datetime({ offset: true }),
  cost_usd: z.number(),
});

const profileStatsRowSchema = z.object({
  session_count: z.number(),
  session_days: z.array(z.iso.date()),
  new_words: z.number(),
});

const monthProgressRowSchema = z.object({
  session_count: z.number(),
  correction_count: z.number(),
  new_word_count: z.number(),
});

const historyCountsRowSchema = z.object({
  message_count: z.number(),
  correction_count: z.number(),
});

const mistakeRowSchema = z.object({
  rule: z.string().nullable(),
  times: z.number(),
  original: z.string(),
  corrected: z.string(),
});

const wordRowSchema = z.object({
  word: z.string(),
  sentence: z.string(),
  created_at: z.iso.datetime({ offset: true }),
});

const messageRowSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  role: z.enum(MESSAGE_ROLES),
  text: z.string(),
  corrections: storedMessageCorrectionsSchema.nullable(),
  new_words: newWordsSchema.nullable(),
  reply_to_id: z.string().nullable(),
  note_id: z.string().nullable(),
  created_at: z.string(),
});

const threadMessageRowSchema = z.object({
  id: z.string(),
  message_id: z.string(),
  role: z.enum(MESSAGE_ROLES),
  text: z.string(),
  new_words: newWordsSchema.nullable(),
  created_at: z.string(),
});

const practiceTarget = z.union([z.literal(5), z.literal(10), z.literal(15)]);

const practiceRunRowSchema = z.object({
  id: z.string(),
  focus: z.enum(PRACTICE_FOCUSES),
  topic_id: z.enum(GRAMMAR_TOPIC_IDS).nullable(),
  note_id: z.string().nullable(),
  target: practiceTarget,
  cost_usd: z.number(),
  created_at: z.string(),
  finished_at: z.string().nullable(),
});

const practiceItemRowSchema = z.object({
  id: z.string(),
  run_id: z.string(),
  position: z.int().min(0).max(14),
  kind: z.enum(PRACTICE_KINDS),
  rule: z.string(),
  prompt: z.string(),
  options: z.array(z.string()).nullable(),
  accepted: z.array(z.string()),
  explanation: z.string(),
  source: z.string().nullable(),
  user_answer: z.string().nullable(),
  correct: z.boolean().nullable(),
  answered_at: z.string().nullable(),
});

const practiceRunItemsRowSchema = z.object({ practice_items: z.array(z.unknown()) });

const noteRowSchema = z.object({
  id: z.string(),
  session_id: z.string().nullable(),
  kind: z.enum(NOTE_KINDS),
  title: z.string(),
  topic: z.string(),
  content: z.unknown(),
  created_at: z.string(),
  sessions: z.object({ title: z.string() }).nullable(),
});

const noteListRowSchema = z.object({
  id: z.string(),
  kind: z.enum(NOTE_KINDS),
  title: z.string(),
  topic: z.string(),
  created_at: z.iso.datetime({ offset: true }),
});

const threadCountRowSchema = z.object({ message_id: z.string(), reply_count: z.number() });

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
    contextSummary: r.context_summary,
    contextThroughId: r.context_through_id,
    costUsd: r.cost_usd,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const openSessionRowSchema = z.object({ messages: z.array(z.unknown()).max(1) });

// INFO: a session row with its newest message embedded (at most one).
export function toOpenSession(row: unknown): ActiveSession | null {
  const parsed = openSessionRowSchema.safeParse(row);
  const session = toSession(row);
  if (!parsed.success || session === null) return null;
  const [first] = parsed.data.messages;
  if (first === undefined) return { session, lastMessage: null };
  const lastMessage = toMessage(first);
  return lastMessage === null ? null : { session, lastMessage };
}

export function toSessionStart(row: unknown): string | null {
  const parsed = sessionStartRowSchema.safeParse(row);
  return parsed.success ? parsed.data.created_at : null;
}

const finishedRunRowSchema = z.object({
  finished_at: z.iso.datetime({ offset: true }),
  practice_items: z.array(z.object({ correct: z.boolean().nullable() })),
});

export function toFinishedRun(row: unknown): { finishedAt: string; missed: boolean } | null {
  const parsed = finishedRunRowSchema.safeParse(row);
  return parsed.success
    ? {
        finishedAt: parsed.data.finished_at,
        missed: parsed.data.practice_items.some((item) => item.correct === false),
      }
    : null;
}

const recentPromptRowSchema = z.object({
  run_id: z.string(),
  prompt: z.string(),
  rule: z.string(),
});

export function toRecentPrompt(row: unknown): RecentPrompt | null {
  const parsed = recentPromptRowSchema.safeParse(row);
  return parsed.success
    ? { runId: parsed.data.run_id, prompt: parsed.data.prompt, rule: parsed.data.rule }
    : null;
}

export function toSessionCost(row: unknown): { createdAt: string; costUsd: number } | null {
  const parsed = sessionCostRowSchema.safeParse(row);
  return parsed.success
    ? { createdAt: parsed.data.created_at, costUsd: parsed.data.cost_usd }
    : null;
}

export function toProfileStatsRow(
  row: unknown,
): { sessionCount: number; sessionDays: string[]; newWords: number } | null {
  const parsed = profileStatsRowSchema.safeParse(row);
  return parsed.success
    ? {
        sessionCount: parsed.data.session_count,
        sessionDays: parsed.data.session_days,
        newWords: parsed.data.new_words,
      }
    : null;
}

export function toMonthProgressRow(
  row: unknown,
): { sessionCount: number; correctionCount: number; newWordCount: number } | null {
  const parsed = monthProgressRowSchema.safeParse(row);
  return parsed.success
    ? {
        sessionCount: parsed.data.session_count,
        correctionCount: parsed.data.correction_count,
        newWordCount: parsed.data.new_word_count,
      }
    : null;
}

// INFO: a session row with the counts of its messages and corrections.
export function toHistoryRow(
  row: unknown,
): { session: Session; messageCount: number; correctionCount: number } | null {
  const parsed = historyCountsRowSchema.safeParse(row);
  const session = toSession(row);
  if (!parsed.success || session === null) return null;
  return {
    session,
    messageCount: parsed.data.message_count,
    correctionCount: parsed.data.correction_count,
  };
}

export function toMistakeRow(
  row: unknown,
): { rule: string | null; times: number; original: string; corrected: string } | null {
  const parsed = mistakeRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export function toWordRow(
  row: unknown,
): { word: string; sentence: string; createdAt: string } | null {
  const parsed = wordRowSchema.safeParse(row);
  return parsed.success
    ? { word: parsed.data.word, sentence: parsed.data.sentence, createdAt: parsed.data.created_at }
    : null;
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
    replyToId: r.reply_to_id,
    noteId: r.note_id,
    createdAt: r.created_at,
  };
}

export function toThreadMessage(row: unknown): ThreadMessage | null {
  const parsed = threadMessageRowSchema.safeParse(row);
  if (!parsed.success) return null;
  const r = parsed.data;
  return {
    id: r.id,
    messageId: r.message_id,
    role: r.role,
    text: r.text,
    newWords: r.new_words,
    createdAt: r.created_at,
  };
}

export function toThreadCount(row: unknown): { messageId: string; count: number } | null {
  const parsed = threadCountRowSchema.safeParse(row);
  return parsed.success
    ? { messageId: parsed.data.message_id, count: parsed.data.reply_count }
    : null;
}

// INFO: a note row with its session's title embedded (null when the session is gone). The
// content is checked against the shape of its kind, so a row that does not match is null.
export function toStudyNote(row: unknown): StudyNote | null {
  const parsed = noteRowSchema.safeParse(row);
  if (!parsed.success) return null;
  const r = parsed.data;
  const shape = studyNoteShapeSchema.safeParse({ kind: r.kind, content: r.content });
  if (!shape.success) return null;
  return {
    ...shape.data,
    id: r.id,
    sessionId: r.session_id,
    sessionTitle: r.sessions === null ? null : r.sessions.title,
    title: r.title,
    topic: r.topic,
    createdAt: r.created_at,
  };
}

export function toNoteRow(row: unknown): {
  id: string;
  kind: "table" | "summary";
  title: string;
  topic: string;
  createdAt: string;
} | null {
  const parsed = noteListRowSchema.safeParse(row);
  if (!parsed.success) return null;
  const r = parsed.data;
  return { id: r.id, kind: r.kind, title: r.title, topic: r.topic, createdAt: r.created_at };
}

export function toPracticeRun(row: unknown): PracticeRun | null {
  const parsed = practiceRunRowSchema.safeParse(row);
  if (!parsed.success) return null;
  const r = parsed.data;
  return {
    id: r.id,
    focus: r.focus,
    topicId: r.topic_id,
    noteId: r.note_id,
    target: r.target,
    costUsd: r.cost_usd,
    createdAt: r.created_at,
    finishedAt: r.finished_at,
  };
}

export function toPracticeItem(row: unknown): PracticeItem | null {
  const parsed = practiceItemRowSchema.safeParse(row);
  if (!parsed.success) return null;
  const r = parsed.data;
  return {
    id: r.id,
    runId: r.run_id,
    position: r.position,
    kind: r.kind,
    rule: r.rule,
    prompt: r.prompt,
    options: r.options,
    accepted: r.accepted,
    explanation: r.explanation,
    source: r.source,
    userAnswer: r.user_answer,
    correct: r.correct,
    answeredAt: r.answered_at,
  };
}

// INFO: a run row with its items embedded, sorted by position. One bad item
// makes the whole run null, as one bad row makes a list read fail.
export function toPracticeRunWithItems(row: unknown): PracticeRunWithItems | null {
  const parsed = practiceRunItemsRowSchema.safeParse(row);
  const run = toPracticeRun(row);
  if (!parsed.success || run === null) return null;
  const items: PracticeItem[] = [];
  for (const entry of parsed.data.practice_items) {
    const item = toPracticeItem(entry);
    if (item === null) return null;
    items.push(item);
  }
  return { run, items: items.sort((a, b) => a.position - b.position) };
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
