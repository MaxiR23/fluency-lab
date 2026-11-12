import {
  CONTRAST_TOPIC_IDS,
  PRACTICE_AVOID_LIMIT,
  topicPoints,
  type TopicPoint,
  grammarTopicLabel,
  type Level,
  type MistakePage,
  type PracticeFocus,
  type PracticeItem,
  type PracticeKind,
  type RecentPrompt,
  type StudyNoteDraft,
  type WordPage,
} from "@fluency-lab/shared";

import type { PracticeExercise, TutorRequest } from "@/ai/ai-port";
import { normalizeAnswer } from "@/utils/practice-grade";
import { ruleKey } from "@/utils/practice-round";
import { takesSeed, type PracticeSeed } from "@/utils/practice-seeds";
import type { PracticeSlot } from "@/utils/practice-slots";
import { NOTE_SHAPE, RULE_NO_KEY } from "@/utils/tutor-prompt";

const MAX_CORRECTIONS = 10;
const MAX_WORDS = 15;

// INFO: a run sends only this and the seed of each write attempt: the learner's
// mistakes, words or topic. No name, goals, interests or chat text. The level goes only with a topic.
export type FocusData =
  | {
      kind: "mistakes";
      corrections: { original: string; corrected: string; rule: string | null }[];
    }
  | { kind: "words"; words: string[] }
  // INFO: contrast marks a usage contrast topic; it shapes the plan and is not sent to the writer.
  // INFO: points are the topic's points, which the planner rotates over the slots.
  | {
      kind: "topic";
      topic: string;
      level: Level | null;
      contrast: boolean;
      points: readonly TopicPoint[];
    }
  | { kind: "note"; note: StudyNoteDraft };

export const KIND_LABELS: Record<PracticeKind, string> = {
  choose: "Choose the answer",
  fix: "Fix the sentence",
  gap: "Fill the gap",
  translate: "Say it in English",
};

export const RULE_PRACTICE =
  "You are an English tutor. Write one short practice exercise in English for the learner from the data in their message, at their level when it is given.";
export const RULE_PRACTICE_KIND: Record<PracticeKind, string> = {
  choose:
    'The exercise kind is "choose": prompt holds ___ exactly once, options are three different texts, accepted is exactly one of them.',
  gap: 'The exercise kind is "gap": prompt holds ___ exactly once, options is empty, accepted lists the texts that fill it.',
  fix: 'The exercise kind is "fix": prompt is a sentence with a mistake and holds no ___, options is empty, accepted lists the correct versions.',
  translate:
    'The exercise kind is "translate": prompt is a sentence in the given language and holds no ___, options is empty, accepted lists correct English versions.',
};
export const RULE_PRACTICE_ANSWERABLE =
  "The learner sees only the prompt, the options of a choose and the kind's title, so every exercise is answerable from those alone and exactly one answer fits; accepted lists that answer and only its spelling variants. Every accepted answer keeps the prompt's meaning: the same subject, content and polarity (affirmative or negative); only the practiced point changes.";
export const RULE_PRACTICE_FIX =
  "A fix prompt holds exactly one mistake that makes the sentence ungrammatical: a wrong or missing word, ending or verb form on the practiced rule. It is never a choice between two grammatical forms; that belongs to a choose. Exactly one correction fixes it. accepted lists that correction and only its spelling or contraction variants, each differing from the prompt only by fixing that mistake. A fix built from a learner's mistake keeps the learner's original meaning, negation included.";
export const RULE_PRACTICE_GAP =
  'A gap sentence carries every cue its answer depends on. When the answer is a different form of a verb, put its base verb in parentheses right after the ___, for example "(go)" for "went", "is going" or "has gone". A gap never asks for the bare base form it shows in parentheses. When the answer is negative, put "not" inside the parentheses, for example "I ___ (not / can) remember who made the shot."';
export const RULE_PRACTICE_CHOOSE =
  "In a choose, exactly one option is right in the sentence. The other two are wrong in it but plausible: forms a learner really confuses on this point, such as the same verb in another form, never an unrelated tense that is obviously wrong.";
export const RULE_PRACTICE_POINT =
  "Practice exactly the point of the learner's message. The sentence must make that point necessary, with a word or a context that rules out the other forms.";
export const RULE_PRACTICE_NO_ANSWER =
  "No prompt contains its accepted answer, except among the options of a choose.";
export const RULE_PRACTICE_SEED =
  "Set the sentence in the scenario of the learner's message when it fits the point naturally. The point comes first: choose the subject and the verb the point needs.";
export const RULE_PRACTICE_RULE =
  "rule is two to six words naming the grammar point the exercise practices.";
export const RULE_PRACTICE_RULE_WORDS = "rule is the word or expression the exercise practices.";
export const RULE_PRACTICE_TARGET_RULE =
  "When the target names a rule, rule is that rule as written.";
export const RULE_PRACTICE_OPEN_TARGET =
  "The target names no point left to practice: choose another everyday grammar point (or word, for a words target) at the learner's level.";
export const RULE_PRACTICE_FIX_SOURCE =
  "For a fix exercise built from a learner's mistake, set source to the learner's original sentence; in every other exercise source is empty.";
export const RULE_PRACTICE_EXPLANATION =
  "explanation is one short sentence saying why the answer is right.";
export const RULE_PRACTICE_NOTE =
  "When the focus is a note, every exercise practices the rules in that note.";
export const RULE_STUDY_NOTE =
  "You are an English tutor. Write one study note in English about the grammar rule in the learner's message, for a learner who just missed an exercise on it. Answer in the given JSON format.";
export const RULE_PRACTICE_GRADE =
  "You are an English tutor. Decide whether the learner's answer fulfils the exercise. Judge it against the visible prompt and the kind only; the accepted answers are examples, not the only right answers. For a gap, judge only the words that fill the ___. The exercise is flawed when its accepted answers are wrong or change the prompt's meaning, or when a fix prompt already is correct English. Answer in the given JSON format: flawed says whether the exercise is flawed, correct is the verdict and explanation is one short sentence to the learner about their answer, written as \"you\". Never mention the exercise, the prompt, the accepted answers, or the learner in the third person.";

export const RULE_PRACTICE_SOLVE =
  "You are an expert English teacher solving a practice exercise exactly as a learner sees it. Give the correct answer, using only what the learner sees: kind, instruction, prompt and options. For choose, answer with one option exactly as written. For gap, answer with the words that fill the ___. For fix, answer with the corrected sentence; when the sentence already is correct English, set alreadyCorrect to true and answer with it unchanged. For translate, answer with the English translation. alreadyCorrect is false for every kind but fix. Answer in the given JSON format.";
export const RULE_PRACTICE_REVIEW =
  "You are an English tutor reviewing a practice exercise before a learner sees it. Answer in the given JSON format, each check in this order. singleAnswer: for a choose, exactly one option fits what the learner sees; true for every other kind. For a gap, a fix and a translate, check instead that every accepted answer is a correct and natural answer. meaningKept: every accepted answer keeps the prompt's meaning, polarity (affirmative or negative) included. answerNotInPrompt: no prompt contains its accepted answer, except among the options of a choose. oneRealMistake: for a fix, the prompt is wrong as written and the first accepted answer corrects it; true for every other kind. naturalEnglish: the English of the prompt and of every accepted answer is natural. solverAnswerAccepted: the solver's answer is a correct answer to the exercise. passed: true only when all of those are true. Contractions and spelling variants of the same answer count as one answer. Judge only the practiced point, not punctuation or style outside it. reason: one short sentence naming what is wrong, empty when passed.";

export function translateRule(language: string): string {
  return `For translate, write the prompt in the language with this tag: ${language}. Use no names of people or places and no loanwords: no word of the prompt may appear in the English answer.`;
}

export function missedRulesLine(rules: readonly string[]): string {
  return `The learner missed these rules, so practice them first: ${rules.join(", ")}.`;
}

// INFO: the prompts an exercise must not repeat: first extra (the queued items and the
// prompts rejected for this slot), then this run's own newest first, then the recent
// prompts of other runs in their order, no duplicates after normalizing, at most
// PRACTICE_AVOID_LIMIT. The recent items of this run are left out: its own items are
// already in the list.
export function avoidPrompts(
  items: readonly Pick<PracticeItem, "prompt" | "position">[],
  recent: readonly RecentPrompt[],
  runId: string | null,
  extra: readonly string[] = [],
): string[] {
  const own = [...items].sort((a, b) => b.position - a.position).map((item) => item.prompt);
  const others = recent.filter((item) => item.runId !== runId).map((item) => item.prompt);
  const seen = new Set<string>();
  const prompts: string[] = [];
  for (const prompt of [...extra, ...own, ...others]) {
    const key = normalizeAnswer(prompt);
    if (seen.has(key)) continue;
    seen.add(key);
    prompts.push(prompt);
  }
  return prompts.slice(0, PRACTICE_AVOID_LIMIT);
}

// INFO: the groups whose rule was not practiced recently first, each part in its order.
// A group with no rule has no label to compare, so it counts as not seen.
export function rotateMistakes<T extends { rule: string | null }>(
  groups: readonly T[],
  seenRules: readonly string[],
): T[] {
  const seen = new Set(seenRules.map(ruleKey));
  const isSeen = (group: T) => group.rule !== null && seen.has(ruleKey(group.rule));
  return [...groups.filter((group) => !isSeen(group)), ...groups.filter(isSeen)];
}

export function focusDataFrom(
  focus: PracticeFocus,
  topicId: string | null,
  mistakes: MistakePage,
  words: WordPage,
  level: Level | null,
  note: StudyNoteDraft | null,
  seenRules: readonly string[],
): FocusData {
  if (focus === "mistakes") {
    return {
      kind: "mistakes",
      corrections: rotateMistakes(mistakes.items, seenRules)
        .slice(0, MAX_CORRECTIONS)
        .map((group) => ({
          original: group.latest.original,
          corrected: group.latest.corrected,
          rule: group.rule,
        })),
    };
  }
  if (focus === "words") {
    return { kind: "words", words: words.items.slice(0, MAX_WORDS).map((item) => item.word) };
  }
  if (focus === "note" && note !== null) return { kind: "note", note };
  return {
    kind: "topic",
    topic: topicId === null ? "" : grammarTopicLabel(topicId),
    level,
    contrast: CONTRAST_TOPIC_IDS.some((id) => id === topicId),
    points: topicPoints(topicId),
  };
}

const KIND_RULES: Record<PracticeKind, readonly string[]> = {
  choose: [RULE_PRACTICE_CHOOSE],
  gap: [RULE_PRACTICE_GAP],
  fix: [RULE_PRACTICE_FIX],
  translate: [],
};

function namesRule(target: PracticeSlot["target"]): boolean {
  if (target.focus === "mistakes") return target.correction?.rule != null;
  if (target.focus === "words") return target.word !== null;
  return false;
}

function isOpen(target: PracticeSlot["target"]): boolean {
  if (target.focus === "mistakes") return target.correction === null;
  if (target.focus === "words") return target.word === null;
  return false;
}

// INFO: one exercise of the slot's kind. The user turn is the kind, the target and the scenario
// the code picked for this attempt; a fix on a learner's own correction
// takes no seed. Repeats are caught by the code check, not by sending an avoid list.
export function exerciseRequest(input: {
  slot: PracticeSlot;
  missedRules: readonly string[];
  language: string | null;
  seed: PracticeSeed | null;
}): TutorRequest {
  const { slot } = input;
  const seed = takesSeed(slot) ? input.seed : null;
  const lines = [RULE_PRACTICE, RULE_NO_KEY];
  if (input.missedRules.length > 0) lines.push(missedRulesLine(input.missedRules));
  if (slot.target.focus === "note") lines.push(RULE_PRACTICE_NOTE);
  lines.push(
    RULE_PRACTICE_KIND[slot.kind],
    RULE_PRACTICE_ANSWERABLE,
    ...KIND_RULES[slot.kind],
    RULE_PRACTICE_NO_ANSWER,
    slot.target.focus === "words" ? RULE_PRACTICE_RULE_WORDS : RULE_PRACTICE_RULE,
  );
  if (namesRule(slot.target)) lines.push(RULE_PRACTICE_TARGET_RULE);
  if (slot.target.focus === "topic" && slot.target.point !== null) {
    lines.push(RULE_PRACTICE_POINT);
  }
  if (isOpen(slot.target)) lines.push(RULE_PRACTICE_OPEN_TARGET);
  if (slot.kind === "fix") lines.push(RULE_PRACTICE_FIX_SOURCE);
  if (seed !== null) lines.push(RULE_PRACTICE_SEED);
  lines.push(RULE_PRACTICE_EXPLANATION);
  if (slot.kind === "translate" && input.language !== null) {
    lines.push(translateRule(input.language));
  }
  return {
    system: lines.join("\n"),
    turns: [
      {
        role: "user",
        text: JSON.stringify({ kind: slot.kind, target: slot.target, ...seed }),
      },
    ],
  };
}

// INFO: the blind solver sees only what the learner sees: the kind, its instruction, the
// prompt and the options. No accepted answers, rule or explanation.
export function solveRequest(exercise: PracticeExercise): TutorRequest {
  return {
    system: [RULE_PRACTICE_SOLVE, RULE_NO_KEY].join("\n"),
    turns: [
      {
        role: "user",
        text: JSON.stringify({
          kind: exercise.kind,
          instruction: KIND_LABELS[exercise.kind],
          prompt: exercise.prompt,
          options: exercise.options ?? [],
        }),
      },
    ],
  };
}

// INFO: the reviewer sees the exercise with its accepted answers and the solver's answer, and
// no generation history.
export function reviewRequest(exercise: PracticeExercise, solverAnswer: string): TutorRequest {
  return {
    system: [RULE_PRACTICE_REVIEW, RULE_NO_KEY].join("\n"),
    turns: [
      {
        role: "user",
        text: JSON.stringify({
          kind: exercise.kind,
          instruction: KIND_LABELS[exercise.kind],
          rule: exercise.rule,
          prompt: exercise.prompt,
          options: exercise.options ?? [],
          accepted: exercise.accepted,
          explanation: exercise.explanation,
          solverAnswer,
        }),
      },
    ],
  };
}

export function gradeRequest(
  item: { kind: PracticeKind; rule: string; prompt: string; accepted: readonly string[] },
  answer: string,
): TutorRequest {
  return {
    system: [RULE_PRACTICE_GRADE, RULE_NO_KEY].join("\n"),
    turns: [
      {
        role: "user",
        text: JSON.stringify({
          kind: item.kind,
          rule: item.rule,
          prompt: item.prompt,
          accepted: item.accepted,
          answer,
        }),
      },
    ],
  };
}

// INFO: a study note request sends only the missed item's rule, prompt, first accepted
// answer and explanation: no name, goals or chat text.
export function studyNoteRequest(
  item: Pick<PracticeItem, "rule" | "prompt" | "accepted" | "explanation">,
): TutorRequest {
  return {
    system: [RULE_STUDY_NOTE, NOTE_SHAPE, RULE_NO_KEY].join("\n"),
    turns: [
      {
        role: "user",
        text: JSON.stringify({
          rule: item.rule,
          prompt: item.prompt,
          answer: item.accepted[0] ?? "",
          explanation: item.explanation,
        }),
      },
    ],
  };
}
