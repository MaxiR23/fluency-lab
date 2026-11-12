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
import { toExercise, type ExerciseCheck } from "@/utils/practice-round";

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

// INFO: check 1, no AI. The slot's kind, the limits and rules of the kind, the source word of a
// translate and a prompt already asked, in this order.
export function codeCheck(
  raw: PracticeExercisePayload,
  kind: PracticeKind,
  avoid: readonly string[],
): ExerciseCheck {
  if (raw.kind !== kind) return { ok: false, reason: "wrong_kind" };
  const checked = toExercise(raw);
  if (!checked.ok) return checked;
  const { exercise } = checked;
  if (exercise.kind === "translate" && sharesSourceWord(exercise.prompt, exercise.accepted)) {
    return { ok: false, reason: "translate_source_word" };
  }
  const asked = new Set(avoid.map(normalizeAnswer));
  if (asked.has(normalizeAnswer(exercise.prompt))) return { ok: false, reason: "repeat" };
  return checked;
}

export type SolverVerdict =
  | { kind: "pass" }
  | { kind: "reject"; reason: PracticeCheckReason }
  | { kind: "review"; solverAnswer: string };

// INFO: check 2. choose and gap pass only on a match; a fix the solver finds already correct is
// rejected; a fix and a translate go on to the reviewer with the solver's answer.
export function solverVerdict(
  exercise: PracticeExercise,
  solution: { answer: string; alreadyCorrect: boolean },
): SolverVerdict {
  if (exercise.kind === "choose" || exercise.kind === "gap") {
    return matchesAccepted(solution.answer, exercise.accepted)
      ? { kind: "pass" }
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

// INFO: check 3. The reason is the code of the first false boolean, then the model's reason
// when it gave one, cut to 300. oneRealMistake is read for a fix only; it is true otherwise.
export function reviewVerdict(
  review: Omit<ReviewFields, "passed"> & { passed?: boolean },
  kind: PracticeKind,
): ReviewVerdict {
  for (const [field, code] of REVIEW_ORDER) {
    if (field === "oneRealMistake" && kind !== "fix") continue;
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
