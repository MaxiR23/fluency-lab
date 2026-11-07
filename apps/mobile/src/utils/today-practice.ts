import type { Level, MistakePage, PracticeRunWithItems } from "@fluency-lab/shared";

import { answeredCount } from "@/utils/practice-escalation";
import { defaultFocus, focusLabel, focusModel, type FocusChoice } from "@/utils/practice-focus";

const START_TARGET = 5;
const MAX_CHIPS = 2;

export type TodayCard = {
  answered: number;
  target: number;
  fraction: number;
  ringLabel: string;
  title: string;
  meta: string;
  chips: string[];
  action: "Keep going" | "Start practice" | "Practice again";
  open: { kind: "run"; runId: string } | { kind: "focus" };
};

// INFO: 1.2 minutes per exercise, in integers so no float error: ceil(left * 6 / 5).
export function minutesLeft(left: number): number {
  return Math.ceil((left * 6) / 5);
}

function distinct(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const name of names) {
    const key = name.trim().toLowerCase();
    if (key === "" || seen.has(key)) continue;
    seen.add(key);
    list.push(name.trim());
  }
  return list;
}

function runChips(today: PracticeRunWithItems): string[] {
  const names = distinct(today.items.map((item) => item.rule));
  if (today.run.focus === "words") {
    if (names.length === 0) return [];
    return [`${names.length} new ${names.length === 1 ? "word" : "words"}`];
  }
  return names.slice(0, MAX_CHIPS);
}

function runChoice(today: PracticeRunWithItems): FocusChoice {
  const { focus, topicId } = today.run;
  if (focus === "topic" && topicId !== null) return { kind: "topic", topicId };
  return focus === "words" ? { kind: "words" } : { kind: "mistakes" };
}

function leftMeta(left: number): string {
  return `${left} left · about ${minutesLeft(left)} min`;
}

export function todayCard(input: {
  today: PracticeRunWithItems | null;
  mistakes: MistakePage;
  level: Level | null;
}): TodayCard {
  const { today } = input;
  if (today === null) {
    const model = focusModel({
      mistakes: input.mistakes,
      words: { items: [], nextOffset: null },
      level: input.level,
    });
    const choice = defaultFocus(model);
    const rules =
      choice.kind === "mistakes"
        ? distinct(
            input.mistakes.items.flatMap((group) => (group.rule === null ? [] : [group.rule])),
          )
        : [];
    return {
      answered: 0,
      target: START_TARGET,
      fraction: 0,
      ringLabel: `0/${START_TARGET}`,
      title: focusLabel(choice),
      meta: leftMeta(START_TARGET),
      chips: rules.slice(0, MAX_CHIPS),
      action: "Start practice",
      open: { kind: "focus" },
    };
  }
  const { run, items } = today;
  const answered = answeredCount(items);
  const finished = run.finishedAt !== null;
  // INFO: a run at its target that was left unfinished waits on its result, with nothing left to do.
  const meta = finished
    ? "Done for today"
    : answered >= run.target
      ? "Your result is ready"
      : leftMeta(run.target - answered);
  return {
    answered,
    target: run.target,
    fraction: answered / run.target,
    ringLabel: `${answered}/${run.target}`,
    title: focusLabel(runChoice(today)),
    meta,
    chips: runChips(today),
    action: finished ? "Practice again" : "Keep going",
    open: finished ? { kind: "focus" } : { kind: "run", runId: run.id },
  };
}
