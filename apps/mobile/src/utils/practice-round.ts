import type {
  PracticeCheckReason,
  PracticeExercisePayload,
  PracticeKind,
} from "@fluency-lab/shared";
import { PRACTICE_KINDS } from "@fluency-lab/shared";

import type { PracticeExercise } from "@/ai/ai-port";
import { normalizeAnswer } from "@/utils/practice-grade";

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

const NEGATIVE_WORDS = ["not", "never", "no", "nobody", "nothing", "nowhere", "none", "cannot"];

// INFO: a whole word of the list or a word ending in n't. cannot is in the list
// because "can not" and "cannot" must read the same.
export function isNegative(text: string): boolean {
  const tokens = normalizeAnswer(text).match(/[a-z']+/g) ?? [];
  return tokens.some((token) => NEGATIVE_WORDS.includes(token) || token.endsWith("n't"));
}

// INFO: a fix that already is one of its accepted answers teaches nothing.
function fixIsAnswer(prompt: string, accepted: readonly string[]): boolean {
  const normalized = normalizeAnswer(prompt);
  return accepted.some((answer) => normalizeAnswer(answer) === normalized);
}

// INFO: an accepted answer with another polarity than the prompt changes what the learner meant.
function fixKeepsPolarity(prompt: string, accepted: readonly string[]): boolean {
  return accepted.every((answer) => isNegative(answer) === isNegative(prompt));
}

const CUE = /^\s*\([^)]*\)/;

// INFO: the accepted answer that fills the gap when the learner typed the whole
// sentence, with or without the cue in parentheses; null otherwise, so the fill
// alone is left to matchesAccepted.
export function gapSentenceFill(
  item: { kind: PracticeKind; prompt: string; accepted: readonly string[] },
  answer: string,
): string | null {
  if (item.kind !== "gap") return null;
  const parts = splitGap(item.prompt);
  const typed = normalizeAnswer(answer);
  if (parts === null || typed === "") return null;
  for (const entry of item.accepted) {
    const keepsCue = normalizeAnswer(parts.before + entry + parts.after);
    const dropsCue = normalizeAnswer(parts.before + entry + parts.after.replace(CUE, ""));
    if (typed === keepsCue || typed === dropsCue) return entry;
  }
  return null;
}

export const MAX_PER_RULE = 2;
const HINT = /\(([^)]*)\)/g;

// INFO: rules are compared trimmed and case-insensitive.
export function ruleKey(rule: string): string {
  return rule.trim().toLowerCase();
}

// INFO: a hint without "not" and the slash that equals an accepted answer gives it away.
export function hintGivesAnswer(prompt: string, accepted: readonly string[]): boolean {
  const answers = accepted.map(normalizeAnswer);
  for (const match of prompt.matchAll(HINT)) {
    const inner = (match[1] ?? "").replace(/\//g, " ").replace(/\bnot\b/gi, " ");
    const hint = normalizeAnswer(inner);
    if (hint !== "" && answers.includes(hint)) return true;
  }
  return false;
}

function wordsOf(text: string): string[] {
  return normalizeAnswer(text).match(/[a-z0-9']+/g) ?? [];
}

function containsRun(words: readonly string[], phrase: readonly string[]): boolean {
  if (phrase.length === 0) return false;
  for (let start = 0; start + phrase.length <= words.length; start += 1) {
    if (phrase.every((word, offset) => words[start + offset] === word)) return true;
  }
  return false;
}

// INFO: a gap whose prompt outside the parentheses holds an accepted answer as whole
// words, or a translate whose prompt holds one; choose and fix are never checked.
export function promptShowsAnswer(item: {
  kind: PracticeKind;
  prompt: string;
  accepted: readonly string[];
}): boolean {
  if (item.kind !== "gap" && item.kind !== "translate") return false;
  const text = item.kind === "gap" ? item.prompt.replace(HINT, " ").replace(GAP, " ") : item.prompt;
  const words = wordsOf(text);
  return item.accepted.some((answer) => containsRun(words, wordsOf(answer)));
}

function within(text: string, max: number): boolean {
  return text !== "" && text.length <= max;
}

export type ExerciseCheck =
  { ok: true; exercise: PracticeExercise } | { ok: false; reason: PracticeCheckReason };

const reject = (reason: PracticeCheckReason): ExerciseCheck => ({ ok: false, reason });

// INFO: an exercise that breaks a rule of its kind or a limit is rejected with its reason code.
export function toExercise(raw: PracticeExercisePayload): ExerciseCheck {
  const kind = PRACTICE_KINDS.find((entry) => entry === raw.kind);
  if (kind === undefined) return reject("wrong_kind");
  const rule = raw.rule.trim();
  const prompt = raw.prompt.trim();
  const explanation = raw.explanation.trim();
  const accepted = raw.accepted.map((answer) => answer.trim()).filter((answer) => answer !== "");
  if (!within(rule, MAX_RULE) || !within(prompt, MAX_TEXT) || !within(explanation, MAX_TEXT)) {
    return reject("limit");
  }
  if (accepted.length === 0 || accepted.length > MAX_ACCEPTED) return reject("limit");
  if (!accepted.every((answer) => within(answer, MAX_TEXT))) return reject("limit");
  const gaps = gapCount(prompt);
  const needsGap = kind === "choose" || kind === "gap";
  if (needsGap ? gaps !== 1 : gaps !== 0) return reject("gap_count");
  if (kind !== "choose") {
    if (kind === "fix" && fixIsAnswer(prompt, accepted)) return reject("fix_already_answer");
    if (kind === "fix" && !fixKeepsPolarity(prompt, accepted)) return reject("fix_polarity");
    if (kind === "gap" && hintGivesAnswer(prompt, accepted)) return reject("hint_shows_answer");
    if (promptShowsAnswer({ kind, prompt, accepted })) return reject("prompt_shows_answer");
    const source = raw.source.trim();
    return {
      ok: true,
      exercise: {
        kind,
        rule,
        prompt,
        options: null,
        accepted,
        explanation,
        source: kind === "fix" && within(source, MAX_TEXT) ? source : null,
      },
    };
  }
  const options = raw.options.map((option) => option.trim());
  if (options.length !== OPTION_COUNT) return reject("choose_options");
  if (!options.every((option) => within(option, MAX_OPTION))) return reject("limit");
  if (new Set(options).size !== OPTION_COUNT) return reject("choose_options");
  const [answer] = accepted;
  if (accepted.length !== 1 || answer === undefined || !options.includes(answer)) {
    return reject("choose_answer_not_option");
  }
  return {
    ok: true,
    exercise: { kind, rule, prompt, options, accepted, explanation, source: null },
  };
}
