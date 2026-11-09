import { SESSION_TITLE_MAX, type Session } from "@fluency-lab/shared";

import type { ChatMessage } from "@/utils/chat-conversation";
import { hasText } from "@/utils/has-text";

export const TITLE_MAX_WORDS = 6;

const QUOTE_PAIRS: readonly (readonly [string, string])[] = [
  ['"', '"'],
  ["'", "'"],
  ["“", "”"],
  ["‘", "’"],
];

function unquoted(text: string): string {
  const pair = QUOTE_PAIRS.find(
    ([open, close]) => text.length >= 2 && text.startsWith(open) && text.endsWith(close),
  );
  return pair === undefined ? text : text.slice(1, -1).trim();
}

// INFO: a title that is empty, over six words or over 60 characters is null, never cut: a cut
// title reads as broken. The paid reply is kept and the next turn asks again.
export function toChatTitle(raw: string): string | null {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  const withoutQuotes = unquoted(collapsed);
  const title = (withoutQuotes.endsWith(".") ? withoutQuotes.slice(0, -1) : withoutQuotes).trim();
  if (title === "") return null;
  if (title.split(" ").length > TITLE_MAX_WORDS) return null;
  if (title.length > SESSION_TITLE_MAX) return null;
  return title;
}

// INFO: the tutor names the chat only while it has its default title and the learner has written.
export function wantsTitle(
  session: Session | null,
  messages: readonly ChatMessage[],
  pending: string | null,
): boolean {
  if (session === null || session.titleSource !== "default") return false;
  return (pending !== null && hasText(pending)) || messages.some((m) => m.role === "user");
}
