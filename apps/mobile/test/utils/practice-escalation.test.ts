// apps/mobile/test/utils/practice-escalation.test.ts
//
// Tests for the rule that decides what a practice run does next.
//
// Tested:
// - practiceNext: answer, ask for more, offer five more, or finish
// - keepGoingTarget, roundSize, answeredCount and missedRules
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/practice-escalation.test.ts
//
// SEE: apps/mobile/src/utils/practice-escalation.ts

import { describe, expect, it } from "@jest/globals";

import {
  answeredCount,
  keepGoingTarget,
  lastRoundMissed,
  missedRules,
  practiceNext,
  roundSize,
} from "@/utils/practice-escalation";

type Mark = boolean | null;

// INFO: true = right, false = missed, null = not answered.
function items(...marks: Mark[]) {
  return marks.map((correct, position) => ({ position, correct, rule: `Rule ${position}` }));
}

const right = (count: number): Mark[] => Array.from({ length: count }, () => true);

describe("practiceNext", () => {
  it("answers while an item is unanswered", () => {
    expect(practiceNext(items(true, null), 5)).toBe("answer");
    expect(practiceNext(items(null, null, null, null, null), 5)).toBe("answer");
  });

  it("asks for more while the items are below the target", () => {
    expect(practiceNext(items(true, true), 5)).toBe("ask");
    expect(practiceNext(items(), 5)).toBe("ask");
  });

  it("offers five more after a run of five with a miss", () => {
    expect(practiceNext(items(true, false, true, true, true), 5)).toBe("offer");
  });

  it("finishes a run of five with no miss", () => {
    expect(practiceNext(items(...right(5)), 5)).toBe("finish");
  });

  it("offers once more at ten with a miss in the second round", () => {
    expect(practiceNext(items(false, ...right(4), ...right(4), false), 10)).toBe("offer");
  });

  it("finishes at ten when only the first round had a miss", () => {
    expect(practiceNext(items(false, ...right(9)), 10)).toBe("finish");
  });

  it("finishes at fifteen with a miss", () => {
    expect(practiceNext(items(...right(10), false, ...right(4)), 15)).toBe("finish");
  });
});

describe("lastRoundMissed", () => {
  it("looks only at the last five positions before the target", () => {
    expect(lastRoundMissed(items(false, ...right(9)), 10)).toBe(false);
    expect(lastRoundMissed(items(...right(5), false, ...right(4)), 10)).toBe(true);
  });

  it("is false for no items", () => {
    expect(lastRoundMissed([], 5)).toBe(false);
  });
});

describe("keepGoingTarget", () => {
  it("raises the target by five and never past fifteen", () => {
    expect(keepGoingTarget(5)).toBe(10);
    expect(keepGoingTarget(10)).toBe(15);
    expect(keepGoingTarget(15)).toBe(15);
  });
});

describe("roundSize", () => {
  it("asks for five, then the rest", () => {
    expect(roundSize(items(), 5)).toBe(5);
    expect(roundSize(items(), 10)).toBe(5);
    expect(roundSize(items(true, true), 5)).toBe(3);
    expect(roundSize(items(...right(5)), 5)).toBe(0);
    expect(roundSize(items(...right(5)), 10)).toBe(5);
  });
});

describe("answeredCount", () => {
  it("counts the answered items", () => {
    expect(answeredCount(items(true, false, null))).toBe(2);
  });

  it("is 0 with no items", () => {
    expect(answeredCount([])).toBe(0);
  });
});

describe("missedRules", () => {
  it("lists missed rules once in order", () => {
    const list = [
      { position: 0, correct: false, rule: "Articles" },
      { position: 1, correct: true, rule: "Tenses" },
      { position: 2, correct: false, rule: "Present perfect" },
      { position: 3, correct: false, rule: "Articles" },
    ];
    expect(missedRules(list)).toEqual(["Articles", "Present perfect"]);
  });

  it("handles a run with no items", () => {
    expect(missedRules([])).toEqual([]);
  });
});
