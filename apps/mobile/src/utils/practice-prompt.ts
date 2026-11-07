import {
  grammarTopicLabel,
  type GrammarTopicId,
  type Level,
  type MistakePage,
  type PracticeFocus,
  type PracticeItem,
  type PracticeKind,
  type StudyNoteDraft,
  type WordPage,
} from "@fluency-lab/shared";

import type { TutorRequest } from "@/ai/ai-port";
import { NOTE_SHAPE, RULE_NO_KEY } from "@/utils/tutor-prompt";

const MAX_CORRECTIONS = 10;
const MAX_WORDS = 15;

// INFO: a round sends only this: the learner's mistakes, words or topic. No name,
// goals, interests or chat text. The level goes only with a topic.
export type FocusData =
  | {
      kind: "mistakes";
      corrections: { original: string; corrected: string; rule: string | null }[];
    }
  | { kind: "words"; words: string[] }
  | { kind: "topic"; topic: string; level: Level | null }
  | { kind: "note"; note: StudyNoteDraft };

export const RULE_PRACTICE =
  "You are an English tutor. Write short practice exercises in English for the learner from the data in their message, at their level when it is given.";
export const RULE_PRACTICE_KINDS =
  'Each exercise has a kind. "choose": prompt holds ___ exactly once, options are three different texts, accepted is exactly one of them. "gap": prompt holds ___ exactly once, options is empty, accepted lists the texts that fill it. "fix": prompt is a sentence with a mistake and holds no ___, options is empty, accepted lists the correct versions. "translate": prompt is a sentence in the given language and holds no ___, options is empty, accepted lists correct English versions.';
export const RULE_PRACTICE_MIX = "Mix the kinds. Never repeat an exercise.";
export const RULE_PRACTICE_RULE =
  "rule is two to six words naming the grammar point the exercise practices.";
export const RULE_PRACTICE_RULE_WORDS = "rule is the word or expression the exercise practices.";
export const RULE_PRACTICE_FIX_SOURCE =
  "For a fix exercise built from a learner's mistake, set source to the learner's original sentence; in every other exercise source is empty.";
export const RULE_PRACTICE_EXPLANATION =
  "explanation is one short sentence saying why the answer is right.";
export const RULE_PRACTICE_NO_TRANSLATE = "Use only choose, fix and gap.";
export const RULE_PRACTICE_NOTE =
  "When the focus is a note, every exercise practices the rules in that note.";
export const RULE_STUDY_NOTE =
  "You are an English tutor. Write one study note in English about the grammar rule in the learner's message, for a learner who just missed an exercise on it. Answer in the given JSON format.";
export const RULE_PRACTICE_GRADE =
  "You are an English tutor. Decide whether the learner's answer to an exercise is correct English that fulfils the exercise, even when it differs from the accepted answers. Answer in the given JSON format: correct is the verdict and explanation is one short sentence about the answer.";

export function translateRule(language: string): string {
  return `For translate, write the prompt in the language with this tag: ${language}. Use translate in at most one exercise out of three.`;
}

export function missedRulesLine(rules: readonly string[]): string {
  return `The learner missed these rules, so practice them first: ${rules.join(", ")}.`;
}

export function focusDataFrom(
  focus: PracticeFocus,
  topicId: GrammarTopicId | null,
  mistakes: MistakePage,
  words: WordPage,
  level: Level | null,
  note: StudyNoteDraft | null,
): FocusData {
  if (focus === "mistakes") {
    return {
      kind: "mistakes",
      corrections: mistakes.items.slice(0, MAX_CORRECTIONS).map((group) => ({
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
  return { kind: "topic", topic: topicId === null ? "" : grammarTopicLabel(topicId), level };
}

export function roundRequest(input: {
  focus: FocusData;
  count: number;
  missedRules: readonly string[];
  language: string | null;
}): TutorRequest {
  const lines = [RULE_PRACTICE, RULE_NO_KEY];
  if (input.missedRules.length > 0) lines.push(missedRulesLine(input.missedRules));
  if (input.focus.kind === "note") lines.push(RULE_PRACTICE_NOTE);
  lines.push(
    RULE_PRACTICE_KINDS,
    RULE_PRACTICE_MIX,
    input.focus.kind === "words" ? RULE_PRACTICE_RULE_WORDS : RULE_PRACTICE_RULE,
    RULE_PRACTICE_FIX_SOURCE,
    RULE_PRACTICE_EXPLANATION,
    input.language === null ? RULE_PRACTICE_NO_TRANSLATE : translateRule(input.language),
  );
  return {
    system: lines.join("\n"),
    turns: [{ role: "user", text: JSON.stringify({ focus: input.focus, count: input.count }) }],
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
