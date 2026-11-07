import type { PracticeRoundPayload } from "@fluency-lab/shared";
import { PRACTICE_KINDS } from "@fluency-lab/shared";

import type { PracticeExercise } from "@/ai/ai-port";

export const GAP = "___";

const MAX_RULE = 80;
const MAX_TEXT = 300;
const MAX_OPTION = 120;
const MAX_ACCEPTED = 5;
const OPTION_COUNT = 3;

function gapCount(prompt: string): number {
  return prompt.split(GAP).length - 1;
}

// INFO: null when the prompt has no gap or more than one.
export function splitGap(prompt: string): { before: string; after: string } | null {
  const parts = prompt.split(GAP);
  if (parts.length !== 2) return null;
  const [before, after] = parts;
  return { before: before ?? "", after: after ?? "" };
}

function within(text: string, max: number): boolean {
  return text !== "" && text.length <= max;
}

function toExercise(raw: PracticeRoundPayload["items"][number]): PracticeExercise | null {
  const kind = PRACTICE_KINDS.find((entry) => entry === raw.kind);
  if (kind === undefined) return null;
  const rule = raw.rule.trim();
  const prompt = raw.prompt.trim();
  const explanation = raw.explanation.trim();
  const accepted = raw.accepted.map((answer) => answer.trim()).filter((answer) => answer !== "");
  if (!within(rule, MAX_RULE) || !within(prompt, MAX_TEXT) || !within(explanation, MAX_TEXT)) {
    return null;
  }
  if (accepted.length === 0 || accepted.length > MAX_ACCEPTED) return null;
  if (!accepted.every((answer) => within(answer, MAX_TEXT))) return null;
  const gaps = gapCount(prompt);
  const needsGap = kind === "choose" || kind === "gap";
  if (needsGap ? gaps !== 1 : gaps !== 0) return null;
  if (kind !== "choose") {
    const source = raw.source.trim();
    return {
      kind,
      rule,
      prompt,
      options: null,
      accepted,
      explanation,
      source: kind === "fix" && within(source, MAX_TEXT) ? source : null,
    };
  }
  const options = raw.options.map((option) => option.trim());
  if (options.length !== OPTION_COUNT || !options.every((option) => within(option, MAX_OPTION))) {
    return null;
  }
  if (new Set(options).size !== OPTION_COUNT) return null;
  const [answer] = accepted;
  if (accepted.length !== 1 || answer === undefined || !options.includes(answer)) return null;
  return { kind, rule, prompt, options, accepted, explanation, source: null };
}

// INFO: an exercise that breaks a rule of its kind or a limit is dropped; null
// when none is left, which the caller reads as a bad response.
export function toPracticeRound(
  payload: PracticeRoundPayload,
  asked: number,
): PracticeExercise[] | null {
  const items: PracticeExercise[] = [];
  for (const raw of payload.items) {
    const exercise = toExercise(raw);
    if (exercise !== null) items.push(exercise);
  }
  return items.length === 0 ? null : items.slice(0, asked);
}
