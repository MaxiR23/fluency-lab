import type { PracticeKind, PracticeRoundPayload } from "@fluency-lab/shared";
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

// INFO: a fix that already is one of its accepted answers teaches nothing, and an
// accepted answer with another polarity than the prompt changes what the learner meant.
function fixKeepsPrompt(prompt: string, accepted: readonly string[]): boolean {
  const normalized = normalizeAnswer(prompt);
  if (accepted.some((answer) => normalizeAnswer(answer) === normalized)) return false;
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

// INFO: drops an item whose normalized prompt is in avoid or on an earlier item.
export function dropRepeats(
  items: readonly PracticeExercise[],
  avoid: readonly string[],
): PracticeExercise[] {
  const seen = new Set(avoid.map(normalizeAnswer));
  const kept: PracticeExercise[] = [];
  for (const item of items) {
    const key = normalizeAnswer(item.prompt);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(item);
  }
  return kept;
}

// INFO: keeps the first MAX_PER_RULE items of each rule, in order.
export function capPerRule(items: readonly PracticeExercise[]): PracticeExercise[] {
  const counts = new Map<string, number>();
  return items.filter((item) => {
    const key = ruleKey(item.rule);
    const count = counts.get(key) ?? 0;
    counts.set(key, count + 1);
    return count < MAX_PER_RULE;
  });
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
    if (kind === "fix" && !fixKeepsPrompt(prompt, accepted)) return null;
    if (kind === "gap" && hintGivesAnswer(prompt, accepted)) return null;
    if (promptShowsAnswer({ kind, prompt, accepted })) return null;
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

// INFO: an exercise that breaks a rule of its kind or a limit is dropped, and so is a
// repeated prompt (in avoid or earlier in the round) and a third item of a rule; null
// when fewer than count are left, which the caller reads as a bad response.
export function toPracticeRound(
  payload: PracticeRoundPayload,
  count: number,
  avoid: readonly string[],
): PracticeExercise[] | null {
  const valid: PracticeExercise[] = [];
  for (const raw of payload.items) {
    const exercise = toExercise(raw);
    if (exercise !== null) valid.push(exercise);
  }
  const items = capPerRule(dropRepeats(valid, avoid));
  return items.length < count ? null : items.slice(0, count);
}
