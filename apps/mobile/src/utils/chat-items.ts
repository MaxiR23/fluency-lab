import type { StoredCorrection } from "@fluency-lab/shared";

import type { Conversation } from "@/utils/chat-conversation";
import { quoteFor, type Quote } from "@/utils/chat-reply";

export type { StoredCorrection };

export type ChatItem =
  | { kind: "tutor"; id: string; text: string }
  | {
      kind: "user";
      id: string;
      text: string;
      corrections: StoredCorrection[];
      explanation: string | null;
      quote: Quote | null;
      // INFO: set when the message can open a thread: saved and with corrections.
      thread: { messageId: string; replies: string | null } | null;
    }
  | { kind: "new_word"; id: string; word: string }
  | { kind: "typing"; id: "typing" };

export function correctionsLabel(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? "1 correction" : `${count} corrections`;
}

export function threadRepliesLabel(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? "1 reply" : `${count} replies`;
}

export function threadAskLabel(replies: string | null): string {
  return replies === null ? "Ask about this" : `Ask about this, ${replies}`;
}

export type CorrectionRow = {
  key: string;
  original: string;
  corrected: string;
  withdrawn: boolean;
};

// INFO: the index is part of the key because two corrections can read the same.
export function correctionRows(corrections: readonly StoredCorrection[]): CorrectionRow[] {
  return corrections.map((item, index) => ({
    key: `${index}:${item.original}`,
    original: item.original,
    corrected: item.corrected,
    withdrawn: item.withdrawn === true,
  }));
}

// INFO: the rules of the corrections, each once (compared trimmed and lower case) in order.
export function pinnedRule(corrections: readonly StoredCorrection[]): string | null {
  const seen = new Set<string>();
  const rules: string[] = [];
  for (const item of corrections) {
    const rule = item.rule?.trim() ?? "";
    if (rule === "" || seen.has(rule.toLowerCase())) continue;
    seen.add(rule.toLowerCase());
    rules.push(rule);
  }
  return rules.length === 0 ? null : rules.join(" · ");
}

// INFO: a user message is followed by its "New word" rows, as the design draws them.
export function chatItems(c: Conversation): ChatItem[] {
  const items: ChatItem[] = [];
  for (const message of c.messages) {
    if (message.role === "tutor") {
      items.push({ kind: "tutor", id: message.id, text: message.text });
      continue;
    }
    items.push({
      kind: "user",
      id: message.id,
      text: message.text,
      corrections: message.corrections,
      explanation: message.explanation,
      quote: quoteFor(c, message.replyTo),
      thread:
        message.corrections.length > 0 && message.savedId !== null
          ? { messageId: message.savedId, replies: threadRepliesLabel(message.threadReplies) }
          : null,
    });
    message.newWords.forEach((word, index) => {
      items.push({ kind: "new_word", id: `${message.id}:word:${index}`, word });
    });
  }
  if (c.pending !== null) {
    items.push({
      kind: "user",
      // INFO: the reducer stores the sent message under this id when the reply arrives, so the row is not mounted again.
      id: `message-${c.messages.length}`,
      text: c.pending,
      corrections: [],
      explanation: null,
      quote: quoteFor(c, c.pendingReplyTo),
      thread: null,
    });
  }
  if (c.phase === "asking" || c.phase === "creating") items.push({ kind: "typing", id: "typing" });
  return items;
}
