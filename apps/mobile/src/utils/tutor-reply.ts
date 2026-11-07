import type { Correction, TutorReplyPayload } from "@fluency-lab/shared";

const MAX_CORRECTIONS = 10;
const MAX_REPLY = 4000;
const MAX_SIDE = 300;
const MAX_RULE = 80;
const MAX_EXPLANATION = 300;
const MAX_WORDS = 10;
const MAX_WORD = 60;

export type NormalizedReply = {
  reply: string;
  corrections: Correction[];
  explanation: string | null;
  newWords: string[];
};

export function cap(text: string, max: number): string {
  return text.trim().slice(0, max).trim();
}

// INFO: trimmed, capped, without repeats (ignoring case) and at most ten, so the list passes newWordsSchema.
export function normalizeWords(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  const words: string[] = [];
  for (const item of raw) {
    const word = cap(item, MAX_WORD);
    if (word === "" || seen.has(word.toLowerCase())) continue;
    seen.add(word.toLowerCase());
    words.push(word);
  }
  return words.slice(0, MAX_WORDS);
}

// INFO: what the tutor returns is shaped here so it always passes
// messageCreateSchema on save: a reply that was paid for is never lost to a 400.
export function toTutorReply(payload: TutorReplyPayload): NormalizedReply | null {
  const reply = cap(payload.reply, MAX_REPLY);
  if (reply === "") return null;
  const corrections = payload.corrections
    .map((item) => {
      const rule = cap(item.rule ?? "", MAX_RULE);
      return {
        original: cap(item.original, MAX_SIDE),
        corrected: cap(item.corrected, MAX_SIDE),
        ...(rule === "" ? {} : { rule }),
      };
    })
    .filter(
      (item) => item.original !== "" && item.corrected !== "" && item.original !== item.corrected,
    )
    .slice(0, MAX_CORRECTIONS);
  const explanation = cap(payload.explanation, MAX_EXPLANATION);
  return {
    reply,
    corrections,
    explanation: corrections.length === 0 || explanation === "" ? null : explanation,
    newWords: normalizeWords(payload.newWords),
  };
}

export type GroundedCorrections = { corrections: Correction[]; explanation: string | null };

function comparable(text: string): string {
  return text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();
}

// INFO: the tutor can invent or rewrite an original; only text the learner wrote in
// this message may be shown or saved as their mistake.
export function groundCorrections(
  message: string,
  corrections: readonly Correction[],
  explanation: string | null,
): GroundedCorrections {
  const written = comparable(message);
  const kept = corrections.filter((item) => {
    const original = comparable(item.original);
    return original !== "" && written.includes(original);
  });
  return { corrections: kept, explanation: kept.length === 0 ? null : explanation };
}
