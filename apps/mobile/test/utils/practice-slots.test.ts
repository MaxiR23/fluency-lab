// apps/mobile/test/utils/practice-slots.test.ts
//
// Tests for the plan of a practice run: one slot per position, with its kind and its target.
//
// Tested:
// - planSlots gives each position a kind (translate only with a device language, at most one in three) and a target by focus
// - planSlots caps a rule at two slots, counting the rules already saved, and falls back to an open target
// - missingPositions lists the positions of a run not yet saved
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/practice-slots.test.ts
//
// SEE: apps/mobile/src/utils/practice-slots.ts

import { describe, expect, it } from "@jest/globals";
import type { MistakePage, StudyNoteDraft, WordPage } from "@fluency-lab/shared";

import { focusDataFrom, type FocusData } from "@/utils/practice-prompt";
import { MAX_SLOT_ATTEMPTS, missingPositions, planSlots } from "@/utils/practice-slots";

const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i);

const mistakes = (...rules: (string | null)[]): FocusData => ({
  kind: "mistakes",
  corrections: rules.map((rule, index) => ({
    original: `original ${index}`,
    corrected: `corrected ${index}`,
    rule,
  })),
});

describe("MAX_SLOT_ATTEMPTS", () => {
  it("is three", () => {
    expect(MAX_SLOT_ATTEMPTS).toBe(3);
  });
});

describe("planSlots kinds", () => {
  const topic: FocusData = { kind: "topic", topic: "Articles", level: null };

  it("cycles choose, gap and fix with no device language", () => {
    const slots = planSlots({
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
      positions: range(0, 15),
      focus: topic,
      language: null,
      usedRules: [],
    });
    expect(slots.some((slot) => slot.kind === "translate")).toBe(false);
  });

  it("plans at most one translate in any three consecutive slots", () => {
    const slots = planSlots({
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
    expect(planSlots({ positions: [], focus: topic, language: "es", usedRules: [] })).toEqual([]);
  });

  it("plans the next five positions for Keep going", () => {
    const slots = planSlots({
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
    const slots = planSlots({ positions: range(0, 3), focus, language: null, usedRules: [] });
    expect(slots.map((slot) => slot.target)).toEqual([
      { focus: "mistakes", correction: { original: "o2", corrected: "c2", rule: "Fresh rule" } },
      { focus: "mistakes", correction: { original: "o3", corrected: "c3", rule: null } },
      { focus: "mistakes", correction: { original: "o1", corrected: "c1", rule: "Seen rule" } },
    ]);
  });

  it("targets one word per slot", () => {
    const slots = planSlots({
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
      positions: range(0, 2),
      focus: { kind: "topic", topic: "Conditionals", level: "advanced" },
      language: null,
      usedRules: [],
    });
    for (const slot of slots) {
      expect(slot.target).toEqual({ focus: "topic", topic: "Conditionals", level: "advanced" });
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
      positions: range(0, 1),
      focus: { kind: "words", words: [] },
      language: null,
      usedRules: [],
    });
    expect(slots[0]?.target).toEqual({ focus: "words", word: null });
  });

  it("starts at the position's place in the corrections when resuming", () => {
    const slots = planSlots({
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
