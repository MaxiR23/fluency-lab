import {
  TUTOR_MODEL,
  usageCostUsd,
  type CorrectionThread,
  type Level,
  type Profile,
  type Provider,
  type Session,
  type SessionUsage,
  type StoredCorrection,
  type ThreadMessageCreate,
} from "@fluency-lab/shared";

import type { ThreadReply, TutorRequest } from "@/ai/ai-port";
import { MAX_MESSAGE_LENGTH, round8, usageWrite, withContext } from "@/utils/chat-conversation";
import type { ContextEvent } from "@/utils/chat-conversation";
import type { ChatFailure } from "@/utils/chat-failure";
import { pinnedRule, type ChatItem } from "@/utils/chat-items";
import { applyWithdrawal, withdrawnIndexes } from "@/utils/correction-withdrawal";
import { threadPrompt, threadTurns } from "@/utils/thread-prompt";

export type ThreadRow = {
  id: string;
  role: "user" | "tutor";
  text: string;
  newWords: string[];
  // INFO: the id the database gave the row; null for a local one until its write returns.
  savedId: string | null;
};

export type ThreadWrite =
  | { kind: "message"; localId: string; input: ThreadMessageCreate }
  | { kind: "withdraw"; items: number[] }
  | { kind: "usage"; usage: SessionUsage };

export type ThreadPhase = "idle" | "asking" | "saving";

// INFO: the learner's message the thread hangs on, with the corrections as the tutor and the
// learner see them (a withdrawn one is flagged).
export type ThreadMessageRef = {
  id: string;
  text: string;
  corrections: StoredCorrection[];
  explanation: string | null;
};

export type ThreadConversation = {
  session: Session;
  message: ThreadMessageRef;
  level: Level | null;
  messages: ThreadRow[];
  draft: string;
  pending: string | null;
  phase: ThreadPhase;
  writes: ThreadWrite[];
  failure: ChatFailure | null;
  provider: Provider | null;
  limitUsd: number | null;
  spentUsd: number;
};

export type ThreadEvent =
  | { type: "draft_changed"; text: string }
  // INFO: text is a quick ask's text, sent as it is with the draft kept; without it the draft is sent.
  | { type: "send_started"; text?: string }
  | { type: "reply_received"; reply: ThreadReply }
  // INFO: usage is present when the provider answered and billed a reply that was not usable.
  | { type: "reply_failed"; failure: ChatFailure; usage?: ThreadReply["usage"] }
  // INFO: savedId follows a row write; corrections follow a withdrawal, as the database saved them.
  | { type: "write_done"; savedId?: string; corrections?: StoredCorrection[] }
  | { type: "write_failed"; failure: ChatFailure }
  | { type: "retry" }
  | ContextEvent;

export type ThreadStep =
  { kind: "none" } | { kind: "write"; write: ThreadWrite } | { kind: "ask"; request: TutorRequest };

export function startThread(input: {
  thread: CorrectionThread;
  profile: Profile;
  spentUsd: number;
}): ThreadConversation {
  const { thread, profile } = input;
  return {
    session: thread.session,
    message: {
      id: thread.message.id,
      text: thread.message.text,
      corrections: thread.message.corrections?.items ?? [],
      explanation: thread.message.corrections?.explanation ?? null,
    },
    level: profile.level,
    messages: thread.messages.map((row) => ({
      id: row.id,
      role: row.role,
      text: row.text,
      newWords: row.newWords ?? [],
      savedId: row.id,
    })),
    draft: "",
    pending: null,
    phase: "idle",
    writes: [],
    failure: null,
    provider: profile.provider,
    limitUsd: profile.monthlyLimitUsd,
    spentUsd: input.spentUsd,
  };
}

function replyWrites(
  pending: string,
  reply: ThreadReply,
  ids: { user: string; tutor: string },
  withdrawn: number[],
): ThreadWrite[] {
  const user: ThreadMessageCreate = { role: "user", text: pending };
  if (reply.newWords.length > 0) user.newWords = reply.newWords;
  const writes: ThreadWrite[] = [
    { kind: "message", localId: ids.user, input: user },
    { kind: "message", localId: ids.tutor, input: { role: "tutor", text: reply.reply } },
  ];
  if (withdrawn.length > 0) writes.push({ kind: "withdraw", items: withdrawn });
  writes.push({ kind: "usage", usage: usageWrite(reply.model, reply.usage) });
  return writes;
}

function resumePhase(t: ThreadConversation): ThreadPhase {
  if (t.pending !== null) return "asking";
  return t.writes.length > 0 ? "saving" : "idle";
}

export function threadReducer(t: ThreadConversation, event: ThreadEvent): ThreadConversation {
  switch (event.type) {
    case "draft_changed":
      return { ...t, draft: event.text };
    case "send_started": {
      if (t.phase !== "idle") return t;
      const fromChip = event.text !== undefined;
      const text = (event.text ?? t.draft).trim();
      if (text === "") return t;
      return {
        ...t,
        pending: text,
        draft: fromChip ? t.draft : "",
        failure: null,
        phase: "asking",
      };
    }
    case "reply_received": {
      const pending = t.pending ?? "";
      const id = t.messages.length;
      const ids = { user: `thread-${id}`, tutor: `thread-${id + 1}` };
      const withdrawn = withdrawnIndexes(event.reply.withdrawn, t.message.corrections);
      const user: ThreadRow = {
        id: ids.user,
        role: "user",
        text: pending,
        newWords: event.reply.newWords,
        savedId: null,
      };
      const tutor: ThreadRow = {
        id: ids.tutor,
        role: "tutor",
        text: event.reply.reply,
        newWords: [],
        savedId: null,
      };
      return {
        ...t,
        message: {
          ...t.message,
          corrections: applyWithdrawal(t.message.corrections, withdrawn),
        },
        messages: [...t.messages, user, tutor],
        writes: [...t.writes, ...replyWrites(pending, event.reply, ids, withdrawn)],
        spentUsd: round8(t.spentUsd + usageCostUsd(event.reply.model, event.reply.usage)),
        pending: null,
        phase: "saving",
      };
    }
    case "reply_failed": {
      const merged =
        t.pending === null ? t.draft : t.draft === "" ? t.pending : `${t.pending} ${t.draft}`;
      const base = {
        ...t,
        draft: merged.slice(0, MAX_MESSAGE_LENGTH),
        pending: null,
        phase: "idle" as const,
        failure: event.failure,
      };
      if (event.usage === undefined) return base;
      // INFO: the billed call still counts: its usage is saved and its cost added to the spend.
      return {
        ...base,
        writes: [...t.writes, { kind: "usage", usage: usageWrite(TUTOR_MODEL, event.usage) }],
        spentUsd: round8(t.spentUsd + usageCostUsd(TUTOR_MODEL, event.usage)),
        phase: "saving",
      };
    }
    case "write_done": {
      const [done, ...writes] = t.writes;
      const saved = event.savedId;
      const messages =
        saved !== undefined && done?.kind === "message"
          ? t.messages.map((m) => (m.id === done.localId ? { ...m, savedId: saved } : m))
          : t.messages;
      const corrections =
        event.corrections !== undefined && done?.kind === "withdraw"
          ? event.corrections
          : t.message.corrections;
      return {
        ...t,
        messages,
        message: { ...t.message, corrections },
        writes,
        phase: writes.length === 0 && t.phase === "saving" ? "idle" : t.phase,
      };
    }
    case "write_failed":
      return { ...t, phase: "idle", failure: event.failure };
    case "retry":
      return { ...t, failure: null, phase: resumePhase(t) };
    case "context_refreshed":
    case "context_failed":
      return withContext(t, event);
  }
}

export function threadNextStep(t: ThreadConversation): ThreadStep {
  if ((t.phase === "asking" || t.phase === "saving") && t.writes.length > 0) {
    return { kind: "write", write: t.writes[0] };
  }
  if (t.phase === "asking" && t.pending !== null) {
    const system = threadPrompt({
      level: t.level,
      sentence: t.message.text,
      corrections: t.message.corrections,
      explanation: t.message.explanation,
    });
    const turns = threadTurns(
      t.messages.map(({ role, text }) => ({ role, text })),
      t.pending,
    );
    return { kind: "ask", request: { system, turns } };
  }
  return { kind: "none" };
}

// INFO: after an AI failure the text is back in the draft, so the retry sends it again;
// after a failed save the writes left resume without asking the tutor again.
export function threadRetryKind(t: ThreadConversation): "resend" | "resume" {
  return t.failure?.source === "ai" ? "resend" : "resume";
}

// INFO: a learner row is followed by its "New word" rows, as in the chat. A thread row has no
// corrections and no thread of its own.
export function threadItems(t: ThreadConversation): ChatItem[] {
  const items: ChatItem[] = [];
  for (const row of t.messages) {
    if (row.role === "tutor") {
      items.push({ kind: "tutor", id: row.id, text: row.text, note: null });
      continue;
    }
    items.push(userItem(row.id, row.text));
    row.newWords.forEach((word, index) => {
      items.push({ kind: "new_word", id: `${row.id}:word:${index}`, word });
    });
  }
  if (t.pending !== null) {
    // INFO: the reducer stores the sent question under this id when the reply arrives, so the row is not mounted again.
    items.push(userItem(`thread-${t.messages.length}`, t.pending));
  }
  if (t.phase === "asking") items.push({ kind: "typing", id: "typing" });
  return items;
}

function userItem(id: string, text: string): ChatItem {
  return { kind: "user", id, text, corrections: [], explanation: null, quote: null, thread: null };
}

export function pinnedCard(t: ThreadConversation): {
  sentence: string;
  corrections: StoredCorrection[];
  rule: string | null;
} {
  return {
    sentence: t.message.text,
    corrections: t.message.corrections,
    rule: pinnedRule(t.message.corrections),
  };
}
