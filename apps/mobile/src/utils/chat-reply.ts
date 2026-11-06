import type { Provider } from "@fluency-lab/shared";

import type { TutorTurn } from "@/ai/ai-port";
import type { ChatMessage, Conversation } from "@/utils/chat-conversation";
import { providerOptions } from "@/utils/onboarding-options";

export type Quote = { targetId: string; author: string; text: string };

export type ReplyPreviewView = { label: string; text: string };

// INFO: the provider's label, the same source the header's provider line reads; Tutor with none.
// Messages do not store a provider, so a reopened chat names the current one in its quotes.
export function tutorName(provider: Provider | null): string {
  return providerOptions.find((option) => option.id === provider)?.label ?? "Tutor";
}

export function replyingLabel(author: string): string {
  return `Replying to ${author}`;
}

// INFO: the text of the tutor message with this list id; null for none, a learner message or a
// missing id.
export function quotedText(messages: readonly ChatMessage[], id: string | null): string | null {
  if (id === null) return null;
  const found = messages.find((m) => m.id === id);
  return found !== undefined && found.role === "tutor" ? found.text : null;
}

export function quoteFor(c: Conversation, replyTo: string | null): Quote | null {
  const text = quotedText(c.messages, replyTo);
  if (replyTo === null || text === null) return null;
  return { targetId: replyTo, author: tutorName(c.provider), text };
}

export function replyPreview(c: Conversation): ReplyPreviewView | null {
  const quote = quoteFor(c, c.replyTo);
  return quote === null ? null : { label: replyingLabel(quote.author), text: quote.text };
}

// INFO: the saved id the write needs; null until the quoted message's own write returned.
export function replyTargetId(messages: readonly ChatMessage[], id: string | null): string | null {
  if (id === null) return null;
  return messages.find((m) => m.id === id)?.savedId ?? null;
}

// INFO: the quote goes to the model as Markdown block-quote lines, then a blank line, then the
// learner's own text.
export function learnerTurn(text: string, quoted: string | null): string {
  if (quoted === null || quoted.trim() === "") return text;
  const lines = quoted
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  return `${lines}\n\n${text}`;
}

export function tutorTurns(
  messages: readonly ChatMessage[],
  pending: string,
  pendingReplyTo: string | null,
): TutorTurn[] {
  const history: TutorTurn[] = messages.map((m) => ({
    role: m.role,
    text: m.role === "user" ? learnerTurn(m.text, quotedText(messages, m.replyTo)) : m.text,
  }));
  return [
    ...history,
    { role: "user", text: learnerTurn(pending, quotedText(messages, pendingReplyTo)) },
  ];
}

// INFO: the y to scroll to so a row lands under the list's top padding; null for a row that has
// not laid out.
export function quoteScrollY(rowY: number | undefined, padding: number): number | null {
  return rowY === undefined ? null : Math.max(0, rowY - padding);
}
