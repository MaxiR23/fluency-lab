import type { Level, PracticeKind, StudyNoteDraft } from "@fluency-lab/shared";

import type { FocusData } from "@/utils/practice-prompt";
import { MAX_PER_RULE, ruleKey } from "@/utils/practice-round";

export const MAX_SLOT_ATTEMPTS = 3;

// INFO: a null correction or word is the open target: every point of the focus is capped,
// so the writer picks another one.
export type SlotTarget =
  | {
      focus: "mistakes";
      correction: { original: string; corrected: string; rule: string | null } | null;
    }
  | { focus: "words"; word: string | null }
  | { focus: "topic"; topic: string; level: Level | null }
  | { focus: "note"; note: StudyNoteDraft };

export type PracticeSlot = { position: number; kind: PracticeKind; target: SlotTarget };

const KINDS_PLAIN: readonly PracticeKind[] = ["choose", "gap", "fix"];
// INFO: translates fall on positions 2 and 5 of every six, three apart, so any three
// consecutive slots hold at most one.
const KINDS_TRANSLATE: readonly PracticeKind[] = [
  "choose",
  "gap",
  "translate",
  "fix",
  "choose",
  "translate",
];

function kindAt(position: number, language: string | null): PracticeKind {
  const order = language === null ? KINDS_PLAIN : KINDS_TRANSLATE;
  return order[position % order.length] ?? "choose";
}

// INFO: walks the candidates in a circle from the first position, skipping a target whose
// rule is already at MAX_PER_RULE (a null rule is never capped). usedRules are the rules of
// the items already saved in the run.
function pickTargets<T>(
  candidates: readonly T[],
  ruleOf: (candidate: T) => string | null,
  positions: readonly number[],
  usedRules: readonly string[],
): (T | null)[] {
  const counts = new Map<string, number>();
  for (const rule of usedRules) counts.set(ruleKey(rule), (counts.get(ruleKey(rule)) ?? 0) + 1);
  const total = candidates.length;
  let cursor = total === 0 ? 0 : (positions[0] ?? 0) % total;
  return positions.map(() => {
    for (let step = 0; step < total; step += 1) {
      const index = (cursor + step) % total;
      const candidate = candidates[index];
      if (candidate === undefined) continue;
      const rule = ruleOf(candidate);
      const key = rule === null ? null : ruleKey(rule);
      if (key !== null && (counts.get(key) ?? 0) >= MAX_PER_RULE) continue;
      if (key !== null) counts.set(key, (counts.get(key) ?? 0) + 1);
      cursor = index + 1;
      return candidate;
    }
    return null;
  });
}

function targetsFor(
  focus: FocusData,
  positions: readonly number[],
  usedRules: readonly string[],
): SlotTarget[] {
  if (focus.kind === "mistakes") {
    return pickTargets(focus.corrections, (item) => item.rule, positions, usedRules).map(
      (correction) => ({ focus: "mistakes", correction }),
    );
  }
  if (focus.kind === "words") {
    return pickTargets(focus.words, (word) => word, positions, usedRules).map((word) => ({
      focus: "words",
      word,
    }));
  }
  if (focus.kind === "topic") {
    return positions.map(() => ({ focus: "topic", topic: focus.topic, level: focus.level }));
  }
  return positions.map(() => ({ focus: "note", note: focus.note }));
}

export function planSlots(input: {
  positions: readonly number[];
  focus: FocusData;
  language: string | null;
  usedRules: readonly string[];
}): PracticeSlot[] {
  const targets = targetsFor(input.focus, input.positions, input.usedRules);
  const slots: PracticeSlot[] = [];
  input.positions.forEach((position, index) => {
    const target = targets[index];
    if (target !== undefined) {
      slots.push({ position, kind: kindAt(position, input.language), target });
    }
  });
  return slots;
}

// INFO: the positions of a run not saved yet, in order; [] at the target is the expected empty.
export function missingPositions(items: readonly { position: number }[], target: number): number[] {
  const saved = new Set(items.map((item) => item.position));
  return Array.from({ length: target }, (_, position) => position).filter(
    (position) => !saved.has(position),
  );
}
