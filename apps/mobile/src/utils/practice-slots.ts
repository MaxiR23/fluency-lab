import type { Level, PracticeKind, StudyNoteDraft, TopicPoint } from "@fluency-lab/shared";

import type { FocusData } from "@/utils/practice-prompt";
import { MAX_PER_RULE, ruleKey } from "@/utils/practice-round";
import { stableHash } from "@/utils/practice-seeds";

export const MAX_SLOT_ATTEMPTS = 3;
// INFO: the full rounds over every kind a slot gets before the AI failure shows; Try again starts
// that many more.
export const MAX_SLOT_ROUNDS = 2;

// INFO: a null correction or word is the open target: every point of the focus is capped,
// so the writer picks another one.
export type SlotTarget =
  | {
      focus: "mistakes";
      correction: { original: string; corrected: string; rule: string | null } | null;
    }
  | { focus: "words"; word: string | null }
  // INFO: point is the topic point the slot practices; null for a topic outside the catalog.
  | { focus: "topic"; topic: string; level: Level | null; point: TopicPoint | null }
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

// INFO: a usage contrast topic plans no gap (both forms often fit); its translates stay on
// positions 2 and 5 of every six.
const KINDS_CONTRAST: readonly PracticeKind[] = ["choose", "fix"];
const KINDS_CONTRAST_TRANSLATE: readonly PracticeKind[] = [
  "choose",
  "fix",
  "translate",
  "choose",
  "fix",
  "translate",
];

function isContrast(focus: FocusData): boolean {
  return focus.kind === "topic" && focus.contrast;
}

function kindAt(position: number, language: string | null, contrast: boolean): PracticeKind {
  const plain = contrast ? KINDS_CONTRAST : KINDS_PLAIN;
  const translate = contrast ? KINDS_CONTRAST_TRANSLATE : KINDS_TRANSLATE;
  const order = language === null ? plain : translate;
  return order[position % order.length] ?? "choose";
}

// INFO: the kinds a slot falls back to, in order, once its kind used up every attempt. A translate
// is never a fallback: it needs the device language and stays at most one in three. A contrast
// topic never falls back to a gap.
export function fallbackKinds(focus: FocusData): readonly PracticeKind[] {
  return isContrast(focus) ? ["choose", "fix"] : ["choose", "gap", "fix"];
}

// INFO: a slot starts on its planned kind unless that kind is dead (it used up its attempts on
// an earlier slot of the run); then on the first fallback kind not dead, or on the planned kind
// when every one is.
export function startKind(
  planned: PracticeKind,
  focus: FocusData,
  deadKinds: readonly PracticeKind[],
): PracticeKind {
  if (!deadKinds.includes(planned)) return planned;
  return fallbackKinds(focus).find((kind) => !deadKinds.includes(kind)) ?? planned;
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

// INFO: the point of a position: the topic's points in order through the run, from a start
// stable for the run, so a run of 5 shows 5 different points when the topic has 5.
function pointAt(
  points: readonly TopicPoint[],
  runId: string,
  position: number,
): TopicPoint | null {
  if (points.length === 0) return null;
  return points[(stableHash(runId) + position) % points.length] ?? null;
}

// INFO: the slot's target with the topic's next point, after a full round over every kind failed
// on the current one. Any other target stays as it is.
export function nextPoint(target: SlotTarget, points: readonly TopicPoint[]): SlotTarget {
  if (target.focus !== "topic" || target.point === null || points.length === 0) return target;
  const current = target.point.label;
  const index = points.findIndex((point) => point.label === current);
  return { ...target, point: points[(index + 1) % points.length] ?? target.point };
}

function targetsFor(
  focus: FocusData,
  positions: readonly number[],
  usedRules: readonly string[],
  runId: string,
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
    return positions.map((position) => ({
      focus: "topic",
      topic: focus.topic,
      level: focus.level,
      point: pointAt(focus.points, runId, position),
    }));
  }
  return positions.map(() => ({ focus: "note", note: focus.note }));
}

export function planSlots(input: {
  runId: string;
  positions: readonly number[];
  focus: FocusData;
  language: string | null;
  usedRules: readonly string[];
}): PracticeSlot[] {
  const targets = targetsFor(input.focus, input.positions, input.usedRules, input.runId);
  const slots: PracticeSlot[] = [];
  input.positions.forEach((position, index) => {
    const target = targets[index];
    if (target !== undefined) {
      slots.push({
        position,
        kind: kindAt(position, input.language, isContrast(input.focus)),
        target,
      });
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
