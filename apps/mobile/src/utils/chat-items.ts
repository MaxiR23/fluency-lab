import type { Correction } from "@fluency-lab/shared";

import type { Conversation } from "@/utils/chat-conversation";

export type { Correction };

export type ChatItem =
  | { kind: "tutor"; id: string; text: string }
  | {
      kind: "user";
      id: string;
      text: string;
      corrections: Correction[];
      explanation: string | null;
    }
  | { kind: "new_word"; id: string; word: string }
  | { kind: "typing"; id: "typing" };

export function correctionsLabel(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? "1 correction" : `${count} corrections`;
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
    });
    message.newWords.forEach((word, index) => {
      items.push({ kind: "new_word", id: `${message.id}:word:${index}`, word });
    });
  }
  if (c.pending !== null) {
    items.push({
      kind: "user",
      id: "pending",
      text: c.pending,
      corrections: [],
      explanation: null,
    });
  }
  if (c.phase === "asking" || c.phase === "creating") items.push({ kind: "typing", id: "typing" });
  return items;
}
