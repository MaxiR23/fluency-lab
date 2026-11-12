import {
  type ModelId,
  type PracticeCheckCreate,
  type PracticeCheckReason,
  type PracticeExercisePayload,
  type PracticeKind,
  type PracticeReviewPayload,
} from "@fluency-lab/shared";

import type { ExerciseReview, PracticeExercise } from "@/ai/ai-port";
import { matchesAccepted, normalizeAnswer } from "@/utils/practice-grade";
import { MAX_ACCEPTED, toExercise, type ExerciseCheck } from "@/utils/practice-round";
import type { PracticeSlot } from "@/utils/practice-slots";

const MIN_WORD = 3;
const MAX_REASON = 300;
const MAX_CHECK_TEXT = 1000;
const MAX_CHECK_KIND = 40;
const MAX_CHECK_LIST = 10;

function wordsOf(text: string): string[] {
  return (text.toLowerCase().match(/\p{L}+/gu) ?? []).filter((word) => word.length >= MIN_WORD);
}

// INFO: a translate whose accepted answers keep a word of 3+ letters of the prompt (numbers
// excluded, case ignored) kept a word of the source language, or a name.
export function sharesSourceWord(prompt: string, accepted: readonly string[]): boolean {
  const source = new Set(wordsOf(prompt));
  return accepted.some((answer) => wordsOf(answer).some((word) => source.has(word)));
}

// INFO: the English words that say nothing about a prompt's situation, left out of the
// similarity check.
const STOP_WORDS: ReadonlySet<string> = new Set([
  "the",
  "and",
  "that",
  "those",
  "this",
  "these",
  "with",
  "for",
  "are",
  "was",
  "were",
  "has",
  "have",
  "had",
  "will",
  "going",
  "from",
  "into",
  "your",
  "you",
  "she",
  "her",
  "his",
  "him",
  "they",
  "them",
  "our",
  "its",
  "not",
  "but",
  "can",
]);
// INFO: the time words, weekdays and number words that every timetable sentence shares; they
// say when, not what the situation is.
const TIME_WORDS: ReadonlySet<string> = new Set([
  "tomorrow",
  "today",
  "tonight",
  "yesterday",
  "morning",
  "afternoon",
  "evening",
  "night",
  "week",
  "weekend",
  "month",
  "year",
  "next",
  "last",
  "every",
  "clock",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
]);
const MIN_SIMILAR_WORDS = 3;
const MIN_OVERLAP = 0.5;

// INFO: the words that name a prompt's situation: letter runs of 3+ letters outside the
// parentheses of a gap cue, minus the stop words and the time words. The gap marker holds no
// letters.
function contentWords(prompt: string): Set<string> {
  const outside = prompt.replace(/\([^)]*\)/g, " ");
  return new Set(wordsOf(outside).filter((word) => !STOP_WORDS.has(word) && !TIME_WORDS.has(word)));
}

// INFO: two prompts are similar when both have at least 3 content words and the shared ones are
// at least half of the union: the same situation reused shows the answer of one exercise in
// another.
export function similarTo(prompt: string, earlier: string): boolean {
  const mine = contentWords(prompt);
  const theirs = contentWords(earlier);
  if (mine.size < MIN_SIMILAR_WORDS || theirs.size < MIN_SIMILAR_WORDS) return false;
  const shared = [...mine].filter((word) => theirs.has(word)).length;
  const union = mine.size + theirs.size - shared;
  return shared / union >= MIN_OVERLAP;
}

// INFO: a typed exercise takes the solver's answer as one more accepted answer when the reviewer
// accepts it and it is not accepted yet, within the accepted limit. A choose keeps its one answer.
export function withSolverAnswer(
  exercise: PracticeExercise,
  solverAnswer: string,
  review: { solverAnswerAccepted: boolean },
): PracticeExercise {
  const answer = solverAnswer.trim();
  if (exercise.kind === "choose" || !review.solverAnswerAccepted || answer === "") return exercise;
  if (matchesAccepted(answer, exercise.accepted)) return exercise;
  if (exercise.accepted.length >= MAX_ACCEPTED) return exercise;
  return { ...exercise, accepted: [...exercise.accepted, answer] };
}

// INFO: the fields the code sets, never the writer: the rule label is the topic point's label for
// a topic slot and the learner's rule for a slot on a learner's correction with one (other
// targets keep the writer's rule); source is kept only for a fix on a learner's correction.
export function settleFields(
  raw: PracticeExercisePayload,
  slot: PracticeSlot,
): PracticeExercisePayload {
  const { target } = slot;
  const learnerFix =
    slot.kind === "fix" && target.focus === "mistakes" && target.correction !== null;
  let rule = raw.rule;
  if (target.focus === "topic" && target.point !== null) rule = target.point.label;
  if (target.focus === "mistakes" && target.correction?.rule != null) rule = target.correction.rule;
  return { ...raw, rule, source: learnerFix ? raw.source : "" };
}

// INFO: check 1, no AI. The slot's kind, the limits and rules of the kind, the source word of a
// translate, a prompt already asked and a prompt too close to one the learner sees, in this
// order. seen are the prompts the learner has seen or will see; rejected are the slot's rejected
// prompts, which the learner never sees, so they count for an exact repeat only.
export function codeCheck(
  raw: PracticeExercisePayload,
  kind: PracticeKind,
  seen: readonly string[],
  rejected: readonly string[] = [],
): ExerciseCheck {
  if (raw.kind !== kind) return { ok: false, reason: "wrong_kind" };
  const checked = toExercise(raw);
  if (!checked.ok) return checked;
  const { exercise } = checked;
  if (exercise.kind === "translate" && sharesSourceWord(exercise.prompt, exercise.accepted)) {
    return { ok: false, reason: "translate_source_word" };
  }
  const asked = new Set([...seen, ...rejected].map(normalizeAnswer));
  if (asked.has(normalizeAnswer(exercise.prompt))) return { ok: false, reason: "repeat" };
  if (seen.some((earlier) => similarTo(exercise.prompt, earlier))) {
    return { ok: false, reason: "similar_prompt" };
  }
  return checked;
}

export type SolverVerdict =
  { kind: "reject"; reason: PracticeCheckReason } | { kind: "review"; solverAnswer: string };

// INFO: check 2. Only a choose is held to a single answer here: a choose the solver does not
// match is rejected at once. A fix the solver finds already correct is rejected. Everything else
// goes on to the reviewer with the solver's answer: the grader accepts any right answer to a
// typed kind, so a second fitting answer cannot mark the learner wrong.
export function solverVerdict(
  exercise: PracticeExercise,
  solution: { answer: string; alreadyCorrect: boolean },
): SolverVerdict {
  if (exercise.kind === "choose") {
    return matchesAccepted(solution.answer, exercise.accepted)
      ? { kind: "review", solverAnswer: solution.answer }
      : { kind: "reject", reason: "solver_mismatch" };
  }
  if (exercise.kind === "fix" && solution.alreadyCorrect) {
    return { kind: "reject", reason: "solver_already_correct" };
  }
  return { kind: "review", solverAnswer: solution.answer };
}

export type ReviewFields = Omit<ExerciseReview, "model" | "usage">;

// INFO: the model's own passed is never read; the booleans decide.
export function toReview(payload: PracticeReviewPayload): ReviewFields {
  const reason = payload.reason.trim();
  return {
    singleAnswer: payload.singleAnswer,
    meaningKept: payload.meaningKept,
    answerNotInPrompt: payload.answerNotInPrompt,
    oneRealMistake: payload.oneRealMistake,
    naturalEnglish: payload.naturalEnglish,
    solverAnswerAccepted: payload.solverAnswerAccepted,
    passed:
      payload.singleAnswer &&
      payload.meaningKept &&
      payload.answerNotInPrompt &&
      payload.oneRealMistake &&
      payload.naturalEnglish &&
      payload.solverAnswerAccepted,
    reason: reason === "" ? null : reason,
  };
}

export type ReviewVerdict =
  { passed: true } | { passed: false; code: PracticeCheckReason; reason: string };

const REVIEW_ORDER = [
  ["singleAnswer", "single_answer"],
  ["meaningKept", "meaning_kept"],
  ["answerNotInPrompt", "answer_not_in_prompt"],
  ["oneRealMistake", "one_real_mistake"],
  ["naturalEnglish", "natural_english"],
  ["solverAnswerAccepted", "solver_answer_accepted"],
] as const;

// INFO: check 3. The booleans each kind is held to: singleAnswer for a choose only,
// oneRealMistake for a fix only, solverAnswerAccepted never (a typed kind takes the solver's
// answer as one more accepted answer instead). The reason is the code of the first false boolean
// read, then the model's reason when it gave one, cut to 300.
export function reviewVerdict(
  review: Omit<ReviewFields, "passed"> & { passed?: boolean },
  kind: PracticeKind,
): ReviewVerdict {
  for (const [field, code] of REVIEW_ORDER) {
    if (field === "singleAnswer" && kind !== "choose") continue;
    if (field === "oneRealMistake" && kind !== "fix") continue;
    if (field === "solverAnswerAccepted") continue;
    if (!review[field]) {
      const text = review.reason === null ? code : `${code}: ${review.reason}`;
      return { passed: false, code, reason: text.slice(0, MAX_REASON) };
    }
  }
  return { passed: true };
}

const cut = (text: string): string => text.slice(0, MAX_CHECK_TEXT);

// INFO: the exercise of a check row, bounded so the row is never too big to save. A saved
// exercise has null options and source, which the row writes as empty.
export function checkExercise(
  exercise: PracticeExercisePayload | PracticeExercise,
): PracticeCheckCreate["exercise"] {
  return {
    kind: exercise.kind.slice(0, MAX_CHECK_KIND),
    rule: cut(exercise.rule),
    prompt: cut(exercise.prompt),
    options: (exercise.options ?? []).slice(0, MAX_CHECK_LIST).map(cut),
    accepted: exercise.accepted.slice(0, MAX_CHECK_LIST).map(cut),
    explanation: cut(exercise.explanation),
    source: cut(exercise.source ?? ""),
  };
}

function solverText(answer: string | null): string | null {
  if (answer === null) return null;
  const trimmed = answer.trim().slice(0, MAX_REASON);
  return trimmed === "" ? null : trimmed;
}

export function codeRow(input: {
  generatorModel: ModelId;
  exercise: PracticeExercisePayload;
  reason: PracticeCheckReason | null;
}): PracticeCheckCreate {
  return {
    stage: "code",
    generatorModel: input.generatorModel,
    checkerModel: null,
    passed: input.reason === null,
    reason: input.reason,
    solverAnswer: null,
    exercise: checkExercise(input.exercise),
  };
}

export function solverRow(input: {
  generatorModel: ModelId;
  checkerModel: ModelId;
  exercise: PracticeExercise;
  answer: string;
  reason: PracticeCheckReason | null;
}): PracticeCheckCreate {
  return {
    stage: "solver",
    generatorModel: input.generatorModel,
    checkerModel: input.checkerModel,
    passed: input.reason === null,
    reason: input.reason,
    solverAnswer: solverText(input.answer),
    exercise: checkExercise(input.exercise),
  };
}

export function reviewerRow(input: {
  generatorModel: ModelId;
  checkerModel: ModelId;
  exercise: PracticeExercise;
  solverAnswer: string;
  verdict: ReviewVerdict;
}): PracticeCheckCreate {
  return {
    stage: "reviewer",
    generatorModel: input.generatorModel,
    checkerModel: input.checkerModel,
    passed: input.verdict.passed,
    reason: input.verdict.passed ? null : input.verdict.reason,
    solverAnswer: solverText(input.solverAnswer),
    exercise: checkExercise(input.exercise),
  };
}

// INFO: a flawed verdict of the grader is recorded as a failed check; the learner sees the
// normal verdict.
export function graderRow(input: {
  generatorModel: ModelId;
  checkerModel: ModelId;
  exercise: PracticeExercise;
  flawed: boolean;
}): PracticeCheckCreate {
  return {
    stage: "grader",
    generatorModel: input.generatorModel,
    checkerModel: input.checkerModel,
    passed: !input.flawed,
    reason: input.flawed ? "grader_flawed" : null,
    solverAnswer: null,
    exercise: checkExercise(input.exercise),
  };
}
