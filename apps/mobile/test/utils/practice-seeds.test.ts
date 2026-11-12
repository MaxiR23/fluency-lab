// apps/mobile/test/utils/practice-seeds.test.ts
//
// Tests for the seed of a write attempt: the scenario the writer sets the sentence in.
//
// Tested:
// - seedFor is stable for the same run and write, and picks from SCENARIOS only
// - 24 consecutive writes of a run give 24 different scenarios, wherever the run starts
// - seedFor carries no subject
// - takesSeed is false only for a fix on a learner's own correction
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/practice-seeds.test.ts
//
// SEE: apps/mobile/src/utils/practice-seeds.ts

import { describe, expect, it } from "@jest/globals";

import { SCENARIOS, seedFor, takesSeed } from "@/utils/practice-seeds";
import type { PracticeSlot } from "@/utils/practice-slots";

describe("seedFor", () => {
  it("gives the same seed for the same run and write", () => {
    expect(seedFor({ runId: "run-1", writeCount: 3 })).toEqual(
      seedFor({ runId: "run-1", writeCount: 3 }),
    );
  });

  it("gives 24 different scenarios over 24 consecutive writes", () => {
    for (const runId of ["run-1", "abc", "f0e1d2c3"]) {
      for (const from of [0, 5, 23]) {
        const scenarios = Array.from(
          { length: SCENARIOS.length },
          (_, n) => seedFor({ runId, writeCount: from + n }).scenario,
        );
        expect(new Set(scenarios).size).toBe(SCENARIOS.length);
      }
    }
  });

  it("steps seven scenarios from one write to the next", () => {
    const at = (writeCount: number) =>
      SCENARIOS.indexOf(seedFor({ runId: "run-1", writeCount }).scenario);
    expect((at(1) - at(0) + SCENARIOS.length) % SCENARIOS.length).toBe(7);
    expect(at(SCENARIOS.length)).toBe(at(0));
  });

  it("returns a scenario from the list and no subject", () => {
    const seed = seedFor({ runId: "run-1", writeCount: 0 });
    expect(SCENARIOS).toContain(seed.scenario);
    expect(seed).toEqual({ scenario: seed.scenario });
  });

  it("has 24 scenarios and no repeated one", () => {
    expect(SCENARIOS).toHaveLength(24);
    expect(new Set(SCENARIOS).size).toBe(SCENARIOS.length);
  });
});

describe("takesSeed", () => {
  const correction = { original: "I never been", corrected: "I've never been", rule: null };
  const slot = (kind: PracticeSlot["kind"], target: PracticeSlot["target"]): PracticeSlot => ({
    position: 0,
    kind,
    target,
  });

  it("is false for a fix on a learner's own correction", () => {
    expect(takesSeed(slot("fix", { focus: "mistakes", correction }))).toBe(false);
  });

  it("is true for any other slot", () => {
    expect(takesSeed(slot("choose", { focus: "mistakes", correction }))).toBe(true);
    expect(takesSeed(slot("fix", { focus: "mistakes", correction: null }))).toBe(true);
    expect(
      takesSeed(slot("fix", { focus: "topic", topic: "Articles", level: null, point: null })),
    ).toBe(true);
    expect(takesSeed(slot("gap", { focus: "words", word: "definitely" }))).toBe(true);
  });
});
