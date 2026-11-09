import type { Correction, Message } from "@fluency-lab/shared";

// INFO: messageCount counts every saved message, the tutor's opening included, because it
// is the conversation's length as the learner saw it.
// The new words are the chat's, then the session's thread words, deduplicated the way the
// profile_stats SQL function counts them (lower, btrim); the first trimmed spelling is kept.
export function sessionSummary(
  messages: readonly Message[],
  threadWords: readonly string[] = [],
): {
  messageCount: number;
  corrections: Correction[];
  newWords: string[];
} {
  const seen = new Set<string>();
  const newWords: string[] = [];
  for (const raw of [...messages.flatMap((message) => message.newWords ?? []), ...threadWords]) {
    const word = raw.trim();
    if (word === "" || seen.has(word.toLowerCase())) continue;
    seen.add(word.toLowerCase());
    newWords.push(word);
  }
  return {
    messageCount: messages.length,
    // INFO: a withdrawn correction was not a mistake, so it is left out and the
    // flag does not travel in the summary.
    corrections: messages.flatMap((message) =>
      (message.corrections?.items ?? []).flatMap((item) =>
        item.withdrawn === true
          ? []
          : [
              {
                original: item.original,
                corrected: item.corrected,
                ...(item.rule === undefined ? {} : { rule: item.rule }),
              },
            ],
      ),
    ),
    newWords,
  };
}
