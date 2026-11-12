// apps/mobile/test/utils/practice-slots.test.ts
//
// Tests for the plan of a practice run: one slot per position, with its kind and its target.
//
// Tested:
// - planSlots gives each position a kind (translate only with a device language, at most one in three) and a target by focus
// - planSlots caps a rule at two slots, counting the rules already saved, and falls back to an open target
// - planSlots never plans a gap for a usage contrast topic: choose and fix, with translates three apart
// - fallbackKinds and startKind: the fallback order per focus, and the kind a slot starts on given the dead kinds
// - planSlots gives each topic slot a point, in order through the run from a start stable for the run; nextPoint moves a slot to the next one
// - missingPositions lists the positions of a run not yet saved
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/practice-slots.test.ts
//
// SEE: apps/mobile/src/utils/practice-slots.ts

import { describe, expect, it } from "@jest/globals";
import {
  TOPIC_POINTS,
  type MistakePage,
  type StudyNoteDraft,
  type WordPage,
} from "@fluency-lab/shared";

import { focusDataFrom, type FocusData } from "@/utils/practice-prompt";
import {
  MAX_SLOT_ATTEMPTS,
  fallbackKinds,
  missingPositions,
  nextPoint,
  planSlots,
  startKind,
} from "@/utils/practice-slots";

const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i);

const mistakes = (...rules: (string | null)[]): FocusData => ({
  kind: "mistakes",
  corrections: rules.map((rule, index) => ({
    original: `original ${index}`,
    corrected: `corrected ${index}`,
    rule,
  })),
});

describe("fallbackKinds and startKind", () => {
  const plain: FocusData = {
    kind: "topic",
    topic: "Articles",
    level: null,
    contrast: false,
    points: [],
  };
  const contrast: FocusData = {
    kind: "topic",
    topic: "Going to vs will",
    level: null,
    contrast: true,
    points: [],
  };

  it("falls back on choose, gap and fix, and on choose and fix for a contrast topic", () => {
    expect(fallbackKinds(plain)).toEqual(["choose", "gap", "fix"]);
    expect(fallbackKinds(mistakes("Verbs"))).toEqual(["choose", "gap", "fix"]);
    expect(fallbackKinds(contrast)).toEqual(["choose", "fix"]);
  });

  it("starts on the planned kind when it is not dead", () => {
    expect(startKind("fix", plain, [])).toBe("fix");
    expect(startKind("fix", plain, ["gap"])).toBe("fix");
  });

  it("starts on the first fallback kind not dead when the planned one is dead", () => {
    expect(startKind("fix", plain, ["fix"])).toBe("choose");
    expect(startKind("choose", plain, ["choose"])).toBe("gap");
    expect(startKind("choose", contrast, ["choose"])).toBe("fix");
    expect(startKind("translate", plain, ["translate", "choose"])).toBe("gap");
  });

  it("starts on the planned kind when every fallback kind is dead", () => {
    expect(startKind("fix", plain, ["choose", "gap", "fix"])).toBe("fix");
    expect(startKind("choose", contrast, ["choose", "fix"])).toBe("choose");
  });
});

describe("planSlots points", () => {
  const points = TOPIC_POINTS.going_to_vs_will;
  const willTopic: FocusData = {
    kind: "topic",
    topic: "Going to vs will",
    level: null,
    contrast: true,
    points,
  };
  const pointsOf = (runId: string, positions: number[]) =>
    planSlots({ runId, positions, focus: willTopic, language: null, usedRules: [] }).map((slot) =>
      slot.target.focus === "topic" ? slot.target.point?.label : null,
    );

  it("gives every topic slot a point of the topic", () => {
    const labels = points.map((point) => point.label);
    for (const label of pointsOf("run-1", range(0, 5))) expect(labels).toContain(label);
  });

  it("shows 5 different points over a run of 5 when the topic has 5", () => {
    for (const runId of ["run-1", "abc", "f0e1"]) {
      expect(new Set(pointsOf(runId, range(0, 5))).size).toBe(5);
    }
  });

  it("assigns the points in order through the run, from a start stable for the run", () => {
    const labels = points.map((point) => point.label);
    const first = pointsOf("run-1", range(0, 7));
    const start = labels.indexOf(first[0] ?? "");
    expect(first).toEqual(range(0, 7).map((n) => labels[(start + n) % labels.length]));
    expect(pointsOf("run-1", range(0, 7))).toEqual(first);
  });

  it("continues the order on keep going", () => {
    expect(pointsOf("run-1", range(5, 10))).toEqual(pointsOf("run-1", range(0, 10)).slice(5));
  });

  it("gives no point to a topic without points", () => {
    const raw: FocusData = { ...willTopic, points: [] };
    const [slot] = planSlots({
      runId: "run-1",
      positions: [0],
      focus: raw,
      language: null,
      usedRules: [],
    });
    expect(slot?.target).toMatchObject({ focus: "topic", point: null });
  });
});

describe("nextPoint", () => {
  const points = TOPIC_POINTS.present_simple_future;

  it("moves a topic target to the topic's next point, wrapping round", () => {
    const target = { focus: "topic" as const, topic: "Present simple for the future", level: null };
    expect(nextPoint({ ...target, point: points[0]! }, points)).toEqual({
      ...target,
      point: points[1],
    });
    expect(nextPoint({ ...target, point: points[2]! }, points)).toEqual({
      ...target,
      point: points[0],
    });
  });

  it("leaves any other target as it is", () => {
    const words = { focus: "words" as const, word: "definitely" };
    expect(nextPoint(words, points)).toBe(words);
    const none = { focus: "topic" as const, topic: "x", level: null, point: null };
    expect(nextPoint(none, points)).toBe(none);
  });
});

describe("MAX_SLOT_ATTEMPTS", () => {
  it("is three", () => {
    expect(MAX_SLOT_ATTEMPTS).toBe(3);
  });
});

describe("planSlots kinds", () => {
  const topic: FocusData = {
    kind: "topic",
    topic: "Articles",
    level: null,
    contrast: false,
    points: [],
  };
  const contrast: FocusData = {
    kind: "topic",
    topic: "Going to vs will",
    level: null,
    contrast: true,
    points: [],
  };

  it("never plans a gap for a contrast topic, with or without a device language", () => {
    for (const language of [null, "es"]) {
      const slots = planSlots({
        runId: "run-1",
        positions: range(0, 15),
        focus: contrast,
        language,
        usedRules: [],
      });
      expect(slots).toHaveLength(15);
      expect(slots.some((slot) => slot.kind === "gap")).toBe(false);
    }
  });

  it("cycles choose and fix for a contrast topic with no device language", () => {
    const slots = planSlots({
      runId: "run-1",
      positions: range(0, 5),
      focus: contrast,
      language: null,
      usedRules: [],
    });
    expect(slots.map((slot) => slot.kind)).toEqual(["choose", "fix", "choose", "fix", "choose"]);
  });

  it("keeps a contrast topic's translates three apart with a device language", () => {
    const slots = planSlots({
      runId: "run-1",
      positions: range(0, 15),
      focus: contrast,
      language: "es",
      usedRules: [],
    });
    expect(slots.slice(0, 6).map((slot) => slot.kind)).toEqual([
      "choose",
      "fix",
      "translate",
      "choose",
      "fix",
      "translate",
    ]);
    const translates = slots
      .filter((slot) => slot.kind === "translate")
      .map((slot) => slot.position);
    translates.slice(1).forEach((position, index) => {
      expect(position - (translates[index] ?? 0)).toBe(3);
    });
  });

  it("sends only the topic and level as a contrast topic's target", () => {
    const [slot] = planSlots({
      runId: "run-1",
      positions: [0],
      focus: contrast,
      language: null,
      usedRules: [],
    });
    expect(slot?.target).toEqual({
      focus: "topic",
      topic: "Going to vs will",
      level: null,
      point: null,
    });
  });

  it("cycles choose, gap and fix with no device language", () => {
    const slots = planSlots({
      runId: "run-1",
      positions: range(0, 7),
      focus: topic,
      language: null,
      usedRules: [],
    });
    expect(slots.map((slot) => slot.kind)).toEqual([
      "choose",
      "gap",
      "fix",
      "choose",
      "gap",
      "fix",
      "choose",
    ]);
    expect(slots.map((slot) => slot.position)).toEqual(range(0, 7));
  });

  it("mixes all four kinds in five slots with a device language", () => {
    const slots = planSlots({
      runId: "run-1",
      positions: range(0, 5),
      focus: topic,
      language: "es",
      usedRules: [],
    });
    expect(new Set(slots.map((slot) => slot.kind))).toEqual(
      new Set(["choose", "gap", "translate", "fix"]),
    );
  });

  it("never plans translate with an English device language (null)", () => {
    const slots = planSlots({
      runId: "run-1",
      positions: range(0, 15),
      focus: topic,
      language: null,
      usedRules: [],
    });
    expect(slots.some((slot) => slot.kind === "translate")).toBe(false);
  });

  it("plans at most one translate in any three consecutive slots", () => {
    const slots = planSlots({
      runId: "run-1",
      positions: range(0, 15),
      focus: topic,
      language: "es",
      usedRules: [],
    });
    for (let start = 0; start + 3 <= slots.length; start += 1) {
      const window = slots.slice(start, start + 3).filter((slot) => slot.kind === "translate");
      expect(window.length).toBeLessThanOrEqual(1);
    }
    expect(slots.some((slot) => slot.kind === "translate")).toBe(true);
  });

  it("plans nothing for no positions", () => {
    expect(
      planSlots({ runId: "run-1", positions: [], focus: topic, language: "es", usedRules: [] }),
    ).toEqual([]);
  });

  it("plans the next five positions for Keep going", () => {
    const slots = planSlots({
      runId: "run-1",
      positions: range(5, 10),
      focus: topic,
      language: null,
      usedRules: [],
    });
    expect(slots.map((slot) => slot.position)).toEqual([5, 6, 7, 8, 9]);
    expect(slots.map((slot) => slot.kind)).toEqual(["fix", "choose", "gap", "fix", "choose"]);
  });
});

describe("planSlots targets", () => {
  it("targets one correction per slot in the order given, which is rotateMistakes order", () => {
    const page = {
      items: [
        { rule: "Seen rule", latest: { original: "o1", corrected: "c1" } },
        { rule: "Fresh rule", latest: { original: "o2", corrected: "c2" } },
        { rule: null, latest: { original: "o3", corrected: "c3" } },
      ],
      nextOffset: null,
    } as unknown as MistakePage;
    const words = { items: [], nextOffset: null } as unknown as WordPage;
    const focus = focusDataFrom("mistakes", null, page, words, null, null, ["seen rule"]);
    const slots = planSlots({
      runId: "run-1",
      positions: range(0, 3),
      focus,
      language: null,
      usedRules: [],
    });
    expect(slots.map((slot) => slot.target)).toEqual([
      { focus: "mistakes", correction: { original: "o2", corrected: "c2", rule: "Fresh rule" } },
      { focus: "mistakes", correction: { original: "o3", corrected: "c3", rule: null } },
      { focus: "mistakes", correction: { original: "o1", corrected: "c1", rule: "Seen rule" } },
    ]);
  });

  it("targets one word per slot", () => {
    const slots = planSlots({
      runId: "run-1",
      positions: range(0, 3),
      focus: { kind: "words", words: ["definitely", "thrilled", "reluctant"] },
      language: null,
      usedRules: [],
    });
    expect(slots.map((slot) => slot.target)).toEqual([
      { focus: "words", word: "definitely" },
      { focus: "words", word: "thrilled" },
      { focus: "words", word: "reluctant" },
    ]);
  });

  it("targets the topic and level in every slot of a topic run", () => {
    const slots = planSlots({
      runId: "run-1",
      positions: range(0, 2),
      focus: {
        kind: "topic",
        topic: "Conditionals",
        level: "advanced",
        contrast: false,
        points: [],
      },
      language: null,
      usedRules: [],
    });
    for (const slot of slots) {
      expect(slot.target).toEqual({
        focus: "topic",
        topic: "Conditionals",
        level: "advanced",
        point: null,
      });
    }
  });

  it("targets the note in every slot of a note run", () => {
    const note: StudyNoteDraft = {
      kind: "summary",
      title: "Articles",
      topic: "Articles",
      content: { points: ["a", "b"], remember: "r" },
    } as StudyNoteDraft;
    const slots = planSlots({
      runId: "run-1",
      positions: range(0, 2),
      focus: { kind: "note", note },
      language: null,
      usedRules: [],
    });
    for (const slot of slots) expect(slot.target).toEqual({ focus: "note", note });
  });
});

describe("planSlots cap", () => {
  const countOf = (slots: ReturnType<typeof planSlots>, rule: string) =>
    slots.filter(
      (slot) => slot.target.focus === "mistakes" && slot.target.correction?.rule === rule,
    ).length;

  it("plans at most two slots per rule", () => {
    const slots = planSlots({
      runId: "run-1",
      positions: range(0, 5),
      focus: mistakes("A", "A", "A", "B"),
      language: null,
      usedRules: [],
    });
    expect(countOf(slots, "A")).toBe(2);
    expect(countOf(slots, "B")).toBe(2);
  });

  it("counts the rules already saved in the run toward the cap", () => {
    const slots = planSlots({
      runId: "run-1",
      positions: range(2, 5),
      focus: mistakes("A", "B"),
      language: null,
      usedRules: [" a ", "A"],
    });
    expect(countOf(slots, "A")).toBe(0);
    expect(countOf(slots, "B")).toBe(2);
  });

  it("never caps a correction with no rule", () => {
    const slots = planSlots({
      runId: "run-1",
      positions: range(0, 5),
      focus: mistakes(null),
      language: null,
      usedRules: [],
    });
    expect(
      slots.every((slot) => slot.target.focus === "mistakes" && slot.target.correction !== null),
    ).toBe(true);
  });

  it("falls back to an open target once every target is capped", () => {
    const slots = planSlots({
      runId: "run-1",
      positions: range(0, 5),
      focus: mistakes("A"),
      language: null,
      usedRules: [],
    });
    expect(slots.map((slot) => slot.target)).toEqual([
      {
        focus: "mistakes",
        correction: { original: "original 0", corrected: "corrected 0", rule: "A" },
      },
      {
        focus: "mistakes",
        correction: { original: "original 0", corrected: "corrected 0", rule: "A" },
      },
      { focus: "mistakes", correction: null },
      { focus: "mistakes", correction: null },
      { focus: "mistakes", correction: null },
    ]);
  });

  it("caps a word like a rule and falls back to no word", () => {
    const slots = planSlots({
      runId: "run-1",
      positions: range(0, 4),
      focus: { kind: "words", words: ["Ample"] },
      language: null,
      usedRules: ["ample"],
    });
    expect(slots.map((slot) => slot.target)).toEqual([
      { focus: "words", word: "Ample" },
      { focus: "words", word: null },
      { focus: "words", word: null },
      { focus: "words", word: null },
    ]);
  });

  it("plans an open target for a mistakes run with no corrections", () => {
    const slots = planSlots({
      runId: "run-1",
      positions: range(0, 2),
      focus: mistakes(),
      language: null,
      usedRules: [],
    });
    expect(slots.map((slot) => slot.target)).toEqual([
      { focus: "mistakes", correction: null },
      { focus: "mistakes", correction: null },
    ]);
  });

  it("plans an open target for a words run with no words", () => {
    const slots = planSlots({
      runId: "run-1",
      positions: range(0, 1),
      focus: { kind: "words", words: [] },
      language: null,
      usedRules: [],
    });
    expect(slots[0]?.target).toEqual({ focus: "words", word: null });
  });

  it("starts at the position's place in the corrections when resuming", () => {
    const slots = planSlots({
      runId: "run-1",
      positions: range(3, 5),
      focus: mistakes("A", "B", "C"),
      language: null,
      usedRules: [],
    });
    expect(
      slots.map((slot) => (slot.target.focus === "mistakes" ? slot.target.correction?.rule : null)),
    ).toEqual(["A", "B"]);
  });
});

describe("missingPositions", () => {
  it("lists only the positions not yet saved", () => {
    expect(missingPositions([{ position: 0 }, { position: 1 }, { position: 3 }], 5)).toEqual([
      2, 4,
    ]);
  });

  it("is empty at the target", () => {
    expect(
      missingPositions(
        range(0, 5).map((position) => ({ position })),
        5,
      ),
    ).toEqual([]);
  });

  it("is every position for no items", () => {
    expect(missingPositions([], 5)).toEqual([0, 1, 2, 3, 4]);
  });
});
