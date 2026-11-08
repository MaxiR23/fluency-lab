import type { TutorTurn } from "@/ai/ai-port";
import type { ChatMessage } from "@/utils/chat-conversation";
import { tutorTurns } from "@/utils/chat-reply";

// INFO: the messages after the summary point that call for a summary.
export const COMPACT_AFTER = 30;
// INFO: the latest messages always sent word for word, at least.
export const KEEP_RECENT = 12;
// INFO: characters; asked in the prompt and applied by toContextSummary.
export const SUMMARY_MAX = 1500;

// INFO: the index of the last message the summary covers; -1 when there is no usable
// summary (none, no point, or a point not in the list, as after its message was deleted).
export function summaryPoint(
  messages: readonly ChatMessage[],
  summary: string | null,
  throughId: string | null,
): number {
  if (summary === null || throughId === null) return -1;
  return messages.findIndex((m) => m.savedId === throughId);
}

// INFO: the messages a new summary covers and the saved id of the last one; null when fewer
// than COMPACT_AFTER messages follow the point. The kept tail is at least KEEP_RECENT and
// starts with a learner message: providerMessages drops turns before the first learner turn.
// null as well when the last covered message is not saved yet.
export function summaryCut(
  messages: readonly ChatMessage[],
  summary: string | null,
  throughId: string | null,
): { throughId: string; covered: ChatMessage[] } | null {
  const point = summaryPoint(messages, summary, throughId);
  const after = messages.slice(point + 1);
  if (after.length < COMPACT_AFTER) return null;
  let keepFrom = after.length - KEEP_RECENT;
  while (keepFrom > 0 && after[keepFrom].role !== "user") keepFrom -= 1;
  const covered = after.slice(0, keepFrom);
  const savedId = covered.at(-1)?.savedId ?? null;
  return savedId === null ? null : { throughId: savedId, covered };
}

export function needsSummary(
  messages: readonly ChatMessage[],
  summary: string | null,
  throughId: string | null,
): boolean {
  return summaryCut(messages, summary, throughId) !== null;
}

export function contextLine(summary: string): string {
  return `Earlier in this chat: ${summary}`;
}

// INFO: the system addition (null with no usable summary) and the turns to send: the messages
// after the point, word for word, then the pending learner turn. A quote whose original is
// before the point still carries its text: quotes are read from the whole list.
export function contextTurns(
  messages: readonly ChatMessage[],
  summary: string | null,
  throughId: string | null,
  pending: string,
  pendingReplyTo: string | null,
): { addition: string | null; turns: TutorTurn[] } {
  const point = summaryPoint(messages, summary, throughId);
  const turns = tutorTurns(messages, pending, pendingReplyTo, point + 1);
  return { addition: point === -1 || summary === null ? null : contextLine(summary), turns };
}

// INFO: the summary as saved: trimmed; null when empty or over SUMMARY_MAX (a bad response).
export function toContextSummary(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === "" || trimmed.length > SUMMARY_MAX ? null : trimmed;
}
