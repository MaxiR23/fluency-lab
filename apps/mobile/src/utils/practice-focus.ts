import {
  GRAMMAR_TOPIC_IDS,
  PRACTICE_TARGETS,
  grammarTopicLabel,
  orderedGrammarTopics,
  type GrammarTopic,
  type GrammarTopicId,
  type Level,
  type MistakePage,
  type PracticeFocus,
  type PracticeRunCreate,
  type PracticeTarget,
  type Profile,
  type WordPage,
} from "@fluency-lab/shared";

import type { DataFailure, DataOutcome } from "@/data/data-port";
import { firstOf, type Param } from "@/utils/chat-opening";
import { levelOptions } from "@/utils/onboarding-options";

export type FocusChoice =
  { kind: "mistakes" } | { kind: "words" } | { kind: "topic"; topicId: GrammarTopicId };

export type FocusModel = {
  mistakes: { subtitle: string } | null;
  words: { subtitle: string } | null;
  topics: GrammarTopic[];
  suggestedLabel: string | null;
};

export type PracticeOrigin =
  { kind: "resume"; runId: string } | { kind: "new"; input: PracticeRunCreate };

export const DEFAULT_TARGET: PracticeTarget = 5;

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

// INFO: names are the first page. "A, b and 2 more" names two and counts the rest of the
// page; a next page makes the count "2+". The second name starts in lower case.
export function listSummary(names: readonly string[], more: boolean): string {
  const [first, second] = names;
  if (first === undefined) return "";
  if (second === undefined) return more ? `${first} and more` : first;
  const rest = names.length - 2;
  if (rest === 0)
    return more ? `${first}, ${lowerFirst(second)} and more` : `${first} and ${lowerFirst(second)}`;
  return `${first}, ${lowerFirst(second)} and ${rest}${more ? "+" : ""} more`;
}

function mistakesSubtitle(page: MistakePage): string {
  const rules = page.items.flatMap((group) => (group.rule === null ? [] : [group.rule]));
  return rules.length === 0
    ? "Your latest corrections"
    : listSummary(rules, page.nextOffset !== null);
}

function levelLabel(level: Level | null): string | null {
  if (level === null) return null;
  return levelOptions.find((option) => option.id === level)?.label ?? null;
}

export function focusModel(input: {
  mistakes: MistakePage;
  words: WordPage;
  level: Level | null;
}): FocusModel {
  const label = levelLabel(input.level);
  return {
    mistakes:
      input.mistakes.items.length === 0 ? null : { subtitle: mistakesSubtitle(input.mistakes) },
    words:
      input.words.items.length === 0
        ? null
        : {
            subtitle: listSummary(
              input.words.items.map((item) => item.word),
              input.words.nextOffset !== null,
            ),
          },
    topics: orderedGrammarTopics(input.level),
    suggestedLabel: label === null ? null : `Suggested for ${label}`,
  };
}

export function defaultFocus(model: FocusModel): FocusChoice {
  if (model.mistakes !== null) return { kind: "mistakes" };
  const [first] = model.topics;
  return { kind: "topic", topicId: first === undefined ? GRAMMAR_TOPIC_IDS[0] : first.id };
}

export function focusLabel(choice: FocusChoice): string {
  if (choice.kind === "mistakes") return "From your mistakes";
  if (choice.kind === "words") return "Your new words";
  return grammarTopicLabel(choice.topicId);
}

export function practiceParams(
  choice: FocusChoice,
  target: PracticeTarget,
): Record<string, string> {
  return choice.kind === "topic"
    ? { focus: "topic", topic: choice.topicId, target: String(target) }
    : { focus: choice.kind, target: String(target) };
}

// INFO: a practice on a note is always of five, as the first practice of any focus.
export function notePracticeParams(noteId: string): Record<string, string> {
  return { focus: "note", note: noteId, target: String(DEFAULT_TARGET) };
}

function isTarget(value: number): value is PracticeTarget {
  return PRACTICE_TARGETS.some((target) => target === value);
}

function isGrammarTopic(value: string): value is GrammarTopicId {
  return GRAMMAR_TOPIC_IDS.some((id) => id === value);
}

function isFocus(value: string): value is PracticeFocus {
  return value === "mistakes" || value === "words" || value === "topic" || value === "note";
}

// INFO: a run id wins over a focus; an unknown focus, topic or target is null.
export function practiceOrigin(params: {
  run?: Param;
  focus?: Param;
  topic?: Param;
  note?: Param;
  target?: Param;
}): PracticeOrigin | null {
  const runId = firstOf(params.run);
  if (runId !== undefined) return { kind: "resume", runId };
  const focus = firstOf(params.focus);
  if (focus === undefined || !isFocus(focus)) return null;
  const targetText = firstOf(params.target);
  const target = targetText === undefined ? DEFAULT_TARGET : Number(targetText);
  if (!isTarget(target)) return null;
  if (focus === "note") {
    const noteId = firstOf(params.note);
    return noteId === undefined ? null : { kind: "new", input: { focus, noteId, target } };
  }
  if (focus !== "topic") return { kind: "new", input: { focus, target } };
  const topic = firstOf(params.topic);
  if (topic === undefined || !isGrammarTopic(topic)) return null;
  return { kind: "new", input: { focus: "topic", topicId: topic, target } };
}

export type FocusState =
  | { kind: "loading" }
  | { kind: "failed"; failure: DataFailure }
  | { kind: "ready"; model: FocusModel };

export type FocusEvent =
  | { type: "load_started" }
  | {
      type: "loaded";
      profile: DataOutcome<Profile>;
      mistakes: DataOutcome<MistakePage>;
      words: DataOutcome<WordPage>;
    };

export const initialFocus: FocusState = { kind: "loading" };

export function focusFromReads(
  profile: DataOutcome<Profile>,
  mistakes: DataOutcome<MistakePage>,
  words: DataOutcome<WordPage>,
): FocusState {
  if (!profile.ok) return { kind: "failed", failure: profile.failure };
  if (!mistakes.ok) return { kind: "failed", failure: mistakes.failure };
  if (!words.ok) return { kind: "failed", failure: words.failure };
  return {
    kind: "ready",
    model: focusModel({
      mistakes: mistakes.value,
      words: words.value,
      level: profile.value.level,
    }),
  };
}

export function focusReducer(_state: FocusState, event: FocusEvent): FocusState {
  switch (event.type) {
    case "load_started":
      return initialFocus;
    case "loaded":
      return focusFromReads(event.profile, event.mistakes, event.words);
  }
}
