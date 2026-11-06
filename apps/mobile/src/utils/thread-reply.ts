import type { ThreadReplyPayload } from "@fluency-lab/shared";

import { normalizeWords } from "@/utils/tutor-reply";

const MAX_REPLY = 4000;
const MAX_WITHDRAWN = 10;

export type NormalizedThreadReply = { reply: string; newWords: string[]; withdrawn: number[] };

// INFO: what the tutor returns in a thread is shaped here so it always passes
// threadMessageCreateSchema on save. withdrawn keeps whole numbers from 1, once each;
// which of them name a correction is decided against the corrections (withdrawnIndexes).
export function toThreadReply(payload: ThreadReplyPayload): NormalizedThreadReply | null {
  const reply = payload.reply.trim().slice(0, MAX_REPLY).trim();
  if (reply === "") return null;
  const withdrawn = [...new Set(payload.withdrawn.filter((n) => Number.isInteger(n) && n >= 1))];
  return {
    reply,
    newWords: normalizeWords(payload.newWords),
    withdrawn: withdrawn.slice(0, MAX_WITHDRAWN),
  };
}
