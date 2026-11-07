import type { PracticeItem, PracticeRun } from "@fluency-lab/shared";

import { missedRules } from "@/utils/practice-escalation";

const NEW_WORDS_LABEL = "New words";
const COUNT_WORDS = ["", "One", "Two"];

export type ResultRow = { label: string; right: number; total: number; allRight: boolean };

export function resultScore(items: readonly Pick<PracticeItem, "correct">[]): {
  right: number;
  answered: number;
  fraction: number;
  label: string;
} {
  const answered = items.filter((item) => item.correct !== null).length;
  const right = items.filter((item) => item.correct === true).length;
  return {
    right,
    answered,
    fraction: answered === 0 ? 0 : right / answered,
    label: `${right}/${answered}`,
  };
}

function row(label: string, answered: readonly Pick<PracticeItem, "correct">[]): ResultRow {
  const right = answered.filter((item) => item.correct === true).length;
  return { label, right, total: answered.length, allRight: right === answered.length };
}

// INFO: a words run is one row; every other run is one row per rule, case-insensitive,
// in first appearance order. Items not answered are not rows.
export function resultRows(
  run: Pick<PracticeRun, "focus">,
  items: readonly Pick<PracticeItem, "correct" | "rule">[],
): ResultRow[] {
  const answered = items.filter((item) => item.correct !== null);
  if (answered.length === 0) return [];
  if (run.focus === "words") return [row(NEW_WORDS_LABEL, answered)];
  const order: string[] = [];
  const groups = new Map<string, typeof answered>();
  const labels = new Map<string, string>();
  for (const item of answered) {
    const key = item.rule.trim().toLowerCase();
    if (!groups.has(key)) {
      order.push(key);
      labels.set(key, item.rule.trim());
      groups.set(key, []);
    }
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return order.map((key) => row(labels.get(key) ?? key, groups.get(key) ?? []));
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function withName(lead: string, name: string | null): string {
  const trimmed = name?.trim() ?? "";
  return trimmed === "" ? lead : `${lead}, ${trimmed}`;
}

export function resultCopy(input: {
  name: string | null;
  outcome: "offer" | "finished";
  items: readonly Pick<PracticeItem, "position" | "correct" | "rule">[];
}): { title: string; body: string } {
  const score = resultScore(input.items);
  const missed = score.answered - score.right;
  if (input.outcome === "offer") {
    const count = COUNT_WORDS[missed] ?? String(missed);
    const rule = missedRules(input.items)[0] ?? "";
    return {
      title: withName("Almost there", input.name),
      body: `${count === "" ? missed : count} slipped. 5 more on ${lowerFirst(rule)} to lock it in.`,
    };
  }
  if (missed === 0) {
    return { title: withName("Nice work", input.name), body: `All ${score.answered} right.` };
  }
  return {
    title: withName("Good work", input.name),
    body: `${score.right} of ${score.answered} right today.`,
  };
}
