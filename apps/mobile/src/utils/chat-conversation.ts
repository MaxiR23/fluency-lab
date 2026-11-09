import {
  TUTOR_MODEL,
  topicLabel,
  usageCostUsd,
  type Goal,
  type Level,
  type ModelId,
  type Message,
  type MessageCreate,
  type Profile,
  type Provider,
  type Session,
  type SessionContext,
  type SessionCreate,
  type SessionUsage,
  type SessionWithMessages,
  type StoredCorrection,
  type StudyNote,
  type StudyNoteCreate,
  type StudyNoteDraft,
  type TokenUsage,
} from "@fluency-lab/shared";

import type { TutorReply, TutorRequest } from "@/ai/ai-port";
import type { ChatFailure } from "@/utils/chat-failure";
import {
  freeChatGreeting,
  openingOf,
  promptTopic,
  topicGreeting,
  type ChatOrigin,
} from "@/utils/chat-opening";
import { contextTurns, summaryCut, summaryPoint } from "@/utils/chat-context";
import { summaryRequest } from "@/utils/context-prompt";
import { noteDraft } from "@/utils/note";
import { spendLevel } from "@/utils/spend-limit";
import { tutorPrompt } from "@/utils/tutor-prompt";
import { replyTargetId } from "@/utils/chat-reply";
import { groundCorrections } from "@/utils/tutor-reply";

// INFO: the longest message the API saves (messageCreateSchema).
export const MAX_MESSAGE_LENGTH = 4000;

// INFO: the list id of the tutor's opening line, which a new chat writes before its first ask.
export const OPENING_ID = "opening";

// INFO: the note a tutor message came with; savedId is null until its write returns.
export type ChatNote = { draft: StudyNoteDraft; savedId: string | null };

export type ChatMessage = {
  id: string;
  role: "user" | "tutor";
  text: string;
  corrections: StoredCorrection[];
  explanation: string | null;
  newWords: string[];
  // INFO: how many thread rows the message has; 0 draws no count.
  threadReplies: number;
  // INFO: the list id of the tutor message this one replies to.
  replyTo: string | null;
  // INFO: the id the database gave the message; null for a local one until its write returns.
  savedId: string | null;
  note: ChatNote | null;
};

export type Write =
  | { kind: "message"; localId: string; input: MessageCreate }
  // INFO: localId is the list id of the tutor message the note came with.
  | { kind: "note"; localId: string; input: StudyNoteCreate }
  | { kind: "usage"; usage: SessionUsage }
  // INFO: the summary of the older turns and the last message it covers, saved on the session.
  | { kind: "context"; input: SessionContext };

export type Learner = {
  displayName: string | null;
  level: Level | null;
  goals: readonly Goal[];
  topics: readonly string[];
};

export type Phase = "idle" | "creating" | "asking" | "saving" | "ending";

export type Conversation = {
  origin: ChatOrigin;
  session: Session | null;
  title: string;
  // INFO: null is a free chat.
  topicTitle: string | null;
  learner: Learner;
  opening: string | null;
  messages: ChatMessage[];
  draft: string;
  pending: string | null;
  // INFO: the draft's quoted message, and the quoted message of the text in flight (list ids).
  replyTo: string | null;
  pendingReplyTo: string | null;
  phase: Phase;
  writes: Write[];
  failure: ChatFailure | null;
  // INFO: the failure came from ending the session, so a retry ends it again.
  endFailed: boolean;
  provider: Provider | null;
  limitUsd: number | null;
  spentUsd: number;
  // INFO: this turn already tried a summary, so a failure does not loop; reset on each send.
  summaryTried: boolean;
};

export type ConversationEvent =
  | { type: "draft_changed"; text: string }
  | { type: "send_started" }
  | { type: "reply_started"; messageId: string }
  | { type: "reply_cancelled" }
  | { type: "session_created"; session: Session }
  | { type: "reply_received"; reply: TutorReply }
  // INFO: usage is present when the provider answered and billed a reply that was not usable.
  | { type: "reply_failed"; failure: ChatFailure; usage?: TokenUsage }
  | {
      type: "summary_received";
      summary: string;
      throughId: string;
      model: ModelId;
      usage: TokenUsage;
    }
  // INFO: usage is present when the provider billed a summary that was not usable.
  | { type: "summary_failed"; usage?: TokenUsage }
  // INFO: the context write failed: the summary is dropped and tried again on the next turn.
  | { type: "context_dropped" }
  // INFO: the turn's summary took the spend to the limit: the text goes back to the draft, no failure.
  | { type: "limit_reached" }
  // INFO: session is the session the context write returned.
  | { type: "write_done"; savedId?: string; session?: Session }
  | { type: "write_failed"; failure: ChatFailure }
  | { type: "create_failed"; failure: ChatFailure }
  | { type: "retry" }
  | { type: "flush_started" }
  | {
      type: "context_refreshed";
      provider: Provider | null;
      limitUsd: number | null;
      spentUsd: number;
    }
  | { type: "context_failed"; failure: ChatFailure }
  // INFO: the corrections and thread counts of the messages already in the chat, read again on return from a thread.
  | { type: "threads_refreshed"; opened: SessionWithMessages }
  | { type: "end_started" }
  | { type: "end_failed"; failure: ChatFailure };

export type Step =
  | { kind: "none" }
  | { kind: "create"; body: SessionCreate }
  | { kind: "write"; write: Write }
  | { kind: "summarize"; request: TutorRequest; throughId: string }
  // INFO: the turn stops here: the summary's cost reached the spend limit before the ask.
  | { kind: "limit" }
  | { kind: "ask"; request: TutorRequest };

export type SendState = {
  locked: boolean;
  notice: "unsupported" | "limit" | "warning" | null;
};

function noteOf(message: Message, notes: readonly StudyNote[]): ChatNote | null {
  const found =
    message.noteId === null ? undefined : notes.find((note) => note.id === message.noteId);
  return found === undefined ? null : { draft: noteDraft(found), savedId: found.id };
}

export function fromMessage(
  message: Message,
  threadReplies: number,
  notes: readonly StudyNote[],
): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    text: message.text,
    corrections: message.corrections?.items ?? [],
    explanation: message.corrections?.explanation ?? null,
    newWords: message.newWords ?? [],
    threadReplies,
    replyTo: message.replyToId,
    savedId: message.id,
    note: noteOf(message, notes),
  };
}

function localMessage(id: string, role: "user" | "tutor", text: string): ChatMessage {
  return {
    id,
    role,
    text,
    corrections: [],
    explanation: null,
    newWords: [],
    threadReplies: 0,
    replyTo: null,
    savedId: null,
    note: null,
  };
}

export function startConversation(input: {
  origin: ChatOrigin;
  profile: Profile;
  spentUsd: number;
  opened?: SessionWithMessages;
}): Conversation {
  const { origin, profile } = input;
  const base = {
    origin,
    learner: {
      displayName: profile.displayName,
      level: profile.level,
      goals: profile.goals,
      topics: profile.topics,
    },
    draft: "",
    pending: null,
    replyTo: null,
    pendingReplyTo: null,
    phase: "idle" as const,
    writes: [],
    failure: null,
    endFailed: false,
    provider: profile.provider,
    limitUsd: profile.monthlyLimitUsd,
    spentUsd: input.spentUsd,
    summaryTried: false,
  };
  if (origin.kind === "resume" && input.opened !== undefined) {
    const { session, messages, threadReplies, notes } = input.opened;
    return {
      ...base,
      session,
      title: session.title,
      topicTitle: promptTopic(session),
      opening: openingOf(messages),
      messages: messages.map((m) => fromMessage(m, countOf(threadReplies, m.id), notes)),
    };
  }
  if (origin.kind === "topic") {
    const label = topicLabel(origin.topicId);
    const opening = topicGreeting(profile.displayName, origin.topicId);
    return {
      ...base,
      session: null,
      title: label,
      topicTitle: label,
      opening,
      messages: [localMessage(OPENING_ID, "tutor", opening)],
    };
  }
  const starter = origin.kind === "starter" ? origin.starter : null;
  const opening = starter === null ? freeChatGreeting(profile.displayName) : starter.opener;
  return {
    ...base,
    session: null,
    title: starter === null ? "Free chat" : starter.title,
    topicTitle: starter === null ? null : starter.title,
    opening,
    messages: [localMessage(OPENING_ID, "tutor", opening)],
  };
}

export function round8(value: number): number {
  return Math.round(value * 1e8) / 1e8;
}

// INFO: the usage the API prices and adds to the session cost.
export function usageWrite(model: SessionUsage["model"], usage: TokenUsage): SessionUsage {
  return {
    model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheCreationInputTokens: usage.cacheCreationInputTokens,
    cacheReadInputTokens: usage.cacheReadInputTokens,
  };
}

function countOf(threadReplies: SessionWithMessages["threadReplies"], messageId: string): number {
  return threadReplies.find((entry) => entry.messageId === messageId)?.count ?? 0;
}

function messageWrite(input: MessageCreate, localId: string): Write {
  return { kind: "message", localId, input };
}

function replyWrites(
  pending: string,
  reply: TutorReply,
  ids: { user: string; tutor: string },
  replyToId: string | null,
  sessionId: string | null,
): Write[] {
  const user: MessageCreate = { role: "user", text: pending };
  if (replyToId !== null) user.replyToId = replyToId;
  if (reply.corrections.length > 0) {
    user.corrections = { items: reply.corrections, explanation: reply.explanation };
  }
  if (reply.newWords.length > 0) user.newWords = reply.newWords;
  // INFO: the note is saved first, so the tutor message can name it.
  const note: Write[] =
    reply.note === null
      ? []
      : [{ kind: "note", localId: ids.tutor, input: { ...reply.note, sessionId } }];
  return [
    messageWrite(user, ids.user),
    ...note,
    messageWrite({ role: "tutor", text: reply.reply }, ids.tutor),
    { kind: "usage", usage: usageWrite(reply.model, reply.usage) },
  ];
}

// INFO: the phase to resume in after a failure: the pending text still needs its
// create or its ask (after any writes queued before it); otherwise the writes left.
function resumePhase(c: Conversation): Phase {
  if (c.pending !== null) return c.session === null ? "creating" : "asking";
  return c.writes.length > 0 ? "saving" : "idle";
}

// INFO: the two events that re-read the context: the chat's and a thread's reducers both take them.
export type ContextEvent = Extract<
  ConversationEvent,
  { type: "context_refreshed" | "context_failed" }
>;

export type ContextFields = Pick<Conversation, "failure" | "provider" | "limitUsd" | "spentUsd">;

// INFO: the two events that re-read the context (provider, limit, spend) apply the same way
// to any conversation that has these fields, the chat's and a thread's.
export function withContext<T extends ContextFields>(c: T, event: ContextEvent): T {
  if (event.type === "context_failed")
    return c.failure === null ? { ...c, failure: event.failure } : c;
  const keyFailure =
    c.failure?.source === "ai" &&
    (c.failure.failure === "invalid_key" || c.failure.failure === "missing_key");
  return {
    ...c,
    provider: event.provider,
    limitUsd: event.limitUsd,
    spentUsd: event.spentUsd,
    failure: keyFailure ? null : c.failure,
  };
}

export function conversationReducer(c: Conversation, event: ConversationEvent): Conversation {
  switch (event.type) {
    case "draft_changed":
      return { ...c, draft: event.text };
    case "send_started": {
      if (c.phase !== "idle") return c;
      // INFO: a text still pending from a failed create or write is sent first; the new draft stays.
      const pending = c.pending ?? c.draft.trim();
      return {
        ...c,
        pending,
        pendingReplyTo: c.pending === null ? c.replyTo : c.pendingReplyTo,
        replyTo: c.pending === null ? null : c.replyTo,
        draft: c.pending === null ? "" : c.draft,
        failure: null,
        endFailed: false,
        summaryTried: false,
        phase: c.session === null ? "creating" : "asking",
      };
    }
    case "reply_started": {
      const target = c.messages.find((m) => m.id === event.messageId);
      return target !== undefined && target.role === "tutor"
        ? { ...c, replyTo: event.messageId }
        : c;
    }
    case "reply_cancelled":
      return { ...c, replyTo: null };
    case "session_created":
      return {
        ...c,
        session: event.session,
        phase: "asking",
        writes:
          c.opening === null
            ? c.writes
            : [messageWrite({ role: "tutor", text: c.opening }, OPENING_ID)],
      };
    case "reply_received": {
      const pending = c.pending ?? "";
      const reply: TutorReply = {
        ...event.reply,
        ...groundCorrections(pending, event.reply.corrections, event.reply.explanation),
      };
      const id = c.messages.length;
      const user: ChatMessage = {
        id: `message-${id}`,
        role: "user",
        text: pending,
        corrections: reply.corrections,
        explanation: reply.explanation,
        newWords: reply.newWords,
        threadReplies: 0,
        replyTo: c.pendingReplyTo,
        savedId: null,
        note: null,
      };
      const tutor: ChatMessage = {
        ...localMessage(`message-${id + 1}`, "tutor", reply.reply),
        note: reply.note === null ? null : { draft: reply.note, savedId: null },
      };
      const ids = { user: `message-${id}`, tutor: `message-${id + 1}` };
      return {
        ...c,
        messages: [...c.messages, user, tutor],
        writes: [
          ...c.writes,
          ...replyWrites(
            pending,
            reply,
            ids,
            replyTargetId(c.messages, c.pendingReplyTo),
            c.session?.id ?? null,
          ),
        ],
        spentUsd: round8(c.spentUsd + usageCostUsd(reply.model, reply.usage)),
        pending: null,
        pendingReplyTo: null,
        phase: "saving",
      };
    }
    case "reply_failed": {
      const merged =
        c.pending === null ? c.draft : c.draft === "" ? c.pending : `${c.pending} ${c.draft}`;
      const base = {
        ...c,
        draft: merged.slice(0, MAX_MESSAGE_LENGTH),
        pending: null,
        replyTo: c.pendingReplyTo ?? c.replyTo,
        pendingReplyTo: null,
        phase: "idle" as const,
        failure: event.failure,
      };
      if (event.usage === undefined) return base;
      // INFO: the billed call still counts: its usage is saved and its cost added to the spend.
      return {
        ...base,
        writes: [...c.writes, { kind: "usage", usage: usageWrite(TUTOR_MODEL, event.usage) }],
        spentUsd: round8(c.spentUsd + usageCostUsd(TUTOR_MODEL, event.usage)),
        phase: "saving",
      };
    }
    case "write_done": {
      const [done, ...rest] = c.writes;
      const saved = event.savedId;
      if (saved !== undefined && done?.kind === "note") {
        // INFO: the saved note's id goes to its tutor message and to the message's queued write.
        const writes = rest.map((w) =>
          w.kind === "message" && w.localId === done.localId
            ? { ...w, input: { ...w.input, noteId: saved } }
            : w,
        );
        return {
          ...c,
          messages: c.messages.map((m) =>
            m.id === done.localId && m.note !== null
              ? { ...m, note: { ...m.note, savedId: saved } }
              : m,
          ),
          writes,
          phase: writes.length === 0 && c.phase === "saving" ? "idle" : c.phase,
        };
      }
      const messages =
        saved !== undefined && done?.kind === "message"
          ? c.messages.map((m) => (m.id === done.localId ? { ...m, savedId: saved } : m))
          : c.messages;
      return {
        ...c,
        messages,
        session:
          done?.kind === "context" && event.session !== undefined ? event.session : c.session,
        writes: rest,
        phase: rest.length === 0 && c.phase === "saving" ? "idle" : c.phase,
      };
    }
    case "summary_received":
      return {
        ...c,
        summaryTried: true,
        writes: [
          ...c.writes,
          // INFO: a failed usage write stops the turn on purpose, so no billed call goes uncounted.
          { kind: "usage", usage: usageWrite(event.model, event.usage) },
          { kind: "context", input: { summary: event.summary, throughId: event.throughId } },
        ],
        spentUsd: round8(c.spentUsd + usageCostUsd(event.model, event.usage)),
      };
    case "summary_failed":
      if (event.usage === undefined) return { ...c, summaryTried: true };
      // INFO: the billed call still counts, as in reply_failed.
      return {
        ...c,
        summaryTried: true,
        writes: [...c.writes, { kind: "usage", usage: usageWrite(TUTOR_MODEL, event.usage) }],
        spentUsd: round8(c.spentUsd + usageCostUsd(TUTOR_MODEL, event.usage)),
      };
    case "context_dropped": {
      const [done, ...rest] = c.writes;
      if (done?.kind !== "context") return c;
      return {
        ...c,
        writes: rest,
        phase: rest.length === 0 && c.phase === "saving" ? "idle" : c.phase,
      };
    }
    case "limit_reached":
      return {
        ...c,
        draft: (c.draft === "" ? (c.pending ?? "") : `${c.pending ?? ""} ${c.draft}`).slice(
          0,
          MAX_MESSAGE_LENGTH,
        ),
        pending: null,
        replyTo: c.pendingReplyTo ?? c.replyTo,
        pendingReplyTo: null,
        phase: "idle",
      };
    case "write_failed":
    case "create_failed":
      return { ...c, phase: "idle", failure: event.failure };
    case "end_failed":
      return { ...c, phase: "idle", failure: event.failure, endFailed: true };
    case "retry":
      return { ...c, failure: null, endFailed: false, phase: resumePhase(c) };
    // INFO: sends the writes left, and only those, before the session ends.
    case "flush_started":
      return {
        ...c,
        failure: null,
        endFailed: false,
        phase: c.writes.length > 0 ? "saving" : c.phase,
      };
    case "context_refreshed":
    case "context_failed":
      return withContext(c, event);
    case "threads_refreshed": {
      const fresh = new Map(event.opened.messages.map((m) => [m.id, m]));
      return {
        ...c,
        messages: c.messages.map((m) => {
          const message = m.savedId === null ? undefined : fresh.get(m.savedId);
          if (message === undefined) return m;
          return {
            ...m,
            corrections: message.corrections?.items ?? [],
            explanation: message.corrections?.explanation ?? null,
            threadReplies: countOf(event.opened.threadReplies, message.id),
            note: noteOf(message, event.opened.notes),
          };
        }),
      };
    }
    case "end_started":
      return { ...c, phase: "ending" };
  }
}

function createBody(origin: ChatOrigin): SessionCreate {
  if (origin.kind === "starter") return { starterId: origin.starter.id };
  if (origin.kind === "topic") return { topicId: origin.topicId };
  return { topicId: null };
}

export function nextStep(c: Conversation): Step {
  if (c.phase === "creating" && c.session === null) {
    const body: SessionCreate = createBody(c.origin);
    return { kind: "create", body };
  }
  if ((c.phase === "asking" || c.phase === "saving") && c.writes.length > 0) {
    return { kind: "write", write: c.writes[0] };
  }
  if (c.phase === "asking" && c.pending !== null) {
    // INFO: send() checked the limit before the turn; a summary this turn may have spent past it.
    if (c.summaryTried && sendState(c).locked) return { kind: "limit" };
    const summary = c.session?.contextSummary ?? null;
    const throughId = c.session?.contextThroughId ?? null;
    if (c.session !== null && !c.summaryTried) {
      const cut = summaryCut(c.messages, summary, throughId);
      if (cut !== null) {
        const usable = summaryPoint(c.messages, summary, throughId) !== -1;
        return {
          kind: "summarize",
          request: summaryRequest(usable ? summary : null, c.messages, cut.covered),
          throughId: cut.throughId,
        };
      }
    }
    const context = contextTurns(c.messages, summary, throughId, c.pending, c.pendingReplyTo);
    const prompt = tutorPrompt({
      ...c.learner,
      topicTitle: c.topicTitle,
      openingLine: c.opening,
    });
    const system = context.addition === null ? prompt : `${prompt}\n${context.addition}`;
    return { kind: "ask", request: { system, turns: context.turns } };
  }
  return { kind: "none" };
}

// INFO: after an AI failure the text is back in the draft, so the retry sends it again;
// after a failed save the writes left resume without asking the tutor again.
export function retryKind(c: Conversation): "resend" | "resume" | "end" {
  if (c.failure?.source === "ai") return "resend";
  return c.endFailed ? "end" : "resume";
}

export function sendState(c: Pick<Conversation, "provider" | "limitUsd" | "spentUsd">): SendState {
  if (c.provider === "openai") return { locked: true, notice: "unsupported" };
  const level = spendLevel(c.spentUsd, c.limitUsd);
  if (level === "blocked") return { locked: true, notice: "limit" };
  if (level === "warning") return { locked: false, notice: "warning" };
  return { locked: false, notice: null };
}

export function busy(c: Conversation): boolean {
  return c.phase !== "idle";
}
