import {
  TUTOR_MODEL,
  topicLabel,
  usageCostUsd,
  type Correction,
  type Goal,
  type Level,
  type Message,
  type MessageCreate,
  type Profile,
  type Provider,
  type Session,
  type SessionCreate,
  type SessionUsage,
  type SessionWithMessages,
  type TokenUsage,
  type TopicId,
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
import { spendLevel } from "@/utils/spend-limit";
import { tutorPrompt } from "@/utils/tutor-prompt";
import { replyTargetId, tutorTurns } from "@/utils/chat-reply";
import { groundCorrections } from "@/utils/tutor-reply";

// INFO: the longest message the API saves (messageCreateSchema).
export const MAX_MESSAGE_LENGTH = 4000;

// INFO: the list id of the tutor's opening line, which a new chat writes before its first ask.
export const OPENING_ID = "opening";

export type ChatMessage = {
  id: string;
  role: "user" | "tutor";
  text: string;
  corrections: Correction[];
  explanation: string | null;
  newWords: string[];
  // INFO: the list id of the tutor message this one replies to.
  replyTo: string | null;
  // INFO: the id the database gave the message; null for a local one until its write returns.
  savedId: string | null;
};

export type Write =
  | { kind: "message"; localId: string; input: MessageCreate }
  | { kind: "usage"; usage: SessionUsage };

export type Learner = {
  displayName: string | null;
  level: Level | null;
  goals: readonly Goal[];
  topics: readonly TopicId[];
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
  | { type: "write_done"; savedId?: string }
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
  | { type: "end_started" }
  | { type: "end_failed"; failure: ChatFailure };

export type Step =
  | { kind: "none" }
  | { kind: "create"; body: SessionCreate }
  | { kind: "write"; write: Write }
  | { kind: "ask"; request: TutorRequest };

export type SendState = {
  locked: boolean;
  notice: "unsupported" | "limit" | "warning" | null;
};

export function fromMessage(message: Message): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    text: message.text,
    corrections: message.corrections?.items ?? [],
    explanation: message.corrections?.explanation ?? null,
    newWords: message.newWords ?? [],
    replyTo: message.replyToId,
    savedId: message.id,
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
    replyTo: null,
    savedId: null,
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
  };
  if (origin.kind === "resume" && input.opened !== undefined) {
    const { session, messages } = input.opened;
    return {
      ...base,
      session,
      title: session.title,
      topicTitle: promptTopic(session),
      opening: openingOf(messages),
      messages: messages.map(fromMessage),
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

function round8(value: number): number {
  return Math.round(value * 1e8) / 1e8;
}

function messageWrite(input: MessageCreate, localId: string): Write {
  return { kind: "message", localId, input };
}

function replyWrites(
  pending: string,
  reply: TutorReply,
  ids: { user: string; tutor: string },
  replyToId: string | null,
): Write[] {
  const user: MessageCreate = { role: "user", text: pending };
  if (replyToId !== null) user.replyToId = replyToId;
  if (reply.corrections.length > 0) {
    user.corrections = { items: reply.corrections, explanation: reply.explanation };
  }
  if (reply.newWords.length > 0) user.newWords = reply.newWords;
  return [
    messageWrite(user, ids.user),
    messageWrite({ role: "tutor", text: reply.reply }, ids.tutor),
    {
      kind: "usage",
      usage: {
        model: reply.model,
        inputTokens: reply.usage.inputTokens,
        outputTokens: reply.usage.outputTokens,
        cacheCreationInputTokens: reply.usage.cacheCreationInputTokens,
        cacheReadInputTokens: reply.usage.cacheReadInputTokens,
      },
    },
  ];
}

// INFO: the phase to resume in after a failure: the pending text still needs its
// create or its ask (after any writes queued before it); otherwise the writes left.
function resumePhase(c: Conversation): Phase {
  if (c.pending !== null) return c.session === null ? "creating" : "asking";
  return c.writes.length > 0 ? "saving" : "idle";
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
        replyTo: c.pendingReplyTo,
        savedId: null,
      };
      const ids = { user: `message-${id}`, tutor: `message-${id + 1}` };
      return {
        ...c,
        messages: [...c.messages, user, localMessage(ids.tutor, "tutor", reply.reply)],
        writes: [
          ...c.writes,
          ...replyWrites(pending, reply, ids, replyTargetId(c.messages, c.pendingReplyTo)),
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
        writes: [...c.writes, { kind: "usage", usage: { model: TUTOR_MODEL, ...event.usage } }],
        spentUsd: round8(c.spentUsd + usageCostUsd(TUTOR_MODEL, event.usage)),
        phase: "saving",
      };
    }
    case "write_done": {
      const [done, ...writes] = c.writes;
      const saved = event.savedId;
      const messages =
        saved !== undefined && done?.kind === "message"
          ? c.messages.map((m) => (m.id === done.localId ? { ...m, savedId: saved } : m))
          : c.messages;
      return {
        ...c,
        messages,
        writes,
        phase: writes.length === 0 && c.phase === "saving" ? "idle" : c.phase,
      };
    }
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
    case "context_refreshed": {
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
    case "context_failed":
      return c.failure === null ? { ...c, failure: event.failure } : c;
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
    const turns = tutorTurns(c.messages, c.pending, c.pendingReplyTo);
    const system = tutorPrompt({
      ...c.learner,
      topicTitle: c.topicTitle,
      openingLine: c.opening,
    });
    return { kind: "ask", request: { system, turns } };
  }
  return { kind: "none" };
}

// INFO: after an AI failure the text is back in the draft, so the retry sends it again;
// after a failed save the writes left resume without asking the tutor again.
export function retryKind(c: Conversation): "resend" | "resume" | "end" {
  if (c.failure?.source === "ai") return "resend";
  return c.endFailed ? "end" : "resume";
}

export function sendState(c: Conversation): SendState {
  if (c.provider === "openai") return { locked: true, notice: "unsupported" };
  const level = spendLevel(c.spentUsd, c.limitUsd);
  if (level === "blocked") return { locked: true, notice: "limit" };
  if (level === "warning") return { locked: false, notice: "warning" };
  return { locked: false, notice: null };
}

export function busy(c: Conversation): boolean {
  return c.phase !== "idle";
}
