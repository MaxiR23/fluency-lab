// apps/mobile/test/utils/practice-round.test.ts
//
// Tests for the mapping of the tutor's practice round to exercises.
//
// Tested:
// - toPracticeRound trims, drops the exercises that break a rule of their kind or a limit, and caps the count
// - splitGap splits a prompt around its one gap
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/practice-round.test.ts
//
// SEE: apps/mobile/src/utils/practice-round.ts

import { describe, expect, it } from "@jest/globals";

import { GAP, splitGap, toPracticeRound } from "@/utils/practice-round";

type Raw = {
  kind: string;
  rule: string;
  prompt: string;
  options: string[];
  accepted: string[];
  explanation: string;
  source: string;
};

const choose: Raw = {
  kind: "choose",
  rule: "Present perfect",
  prompt: "I ___ to Japan twice.",
  options: ["have been", "was", "am"],
  accepted: ["have been"],
  explanation: "Use the present perfect for an experience.",
  source: "",
};
const gap: Raw = {
  ...choose,
  kind: "gap",
  prompt: "She ___ here since May.",
  options: [],
  accepted: ["has lived"],
};
const fix: Raw = {
  ...choose,
  kind: "fix",
  prompt: "I never been to Japan.",
  options: [],
  accepted: ["I've never been to Japan."],
  source: "I never been to Japan.",
};
const translate: Raw = {
  ...choose,
  kind: "translate",
  prompt: "Nunca he estado en Japón.",
  options: [],
  accepted: ["I have never been to Japan."],
};

function round(...items: Raw[]) {
  return { items };
}

describe("toPracticeRound", () => {
  it("maps a valid round of five", () => {
    const result = toPracticeRound(
      round(choose, gap, fix, translate, { ...gap, rule: "Other" }),
      5,
    );
    expect(result).toHaveLength(5);
    expect(result?.[0]).toEqual({
      kind: "choose",
      rule: "Present perfect",
      prompt: "I ___ to Japan twice.",
      options: ["have been", "was", "am"],
      accepted: ["have been"],
      explanation: "Use the present perfect for an experience.",
      source: null,
    });
  });

  it("trims every text", () => {
    const result = toPracticeRound(
      round({
        ...choose,
        rule: " Present perfect ",
        options: [" have been ", "was", "am"],
        accepted: [" have been "],
      }),
      5,
    );
    expect(result?.[0]).toMatchObject({
      rule: "Present perfect",
      options: ["have been", "was", "am"],
      accepted: ["have been"],
    });
  });

  it("turns empty options and source into null", () => {
    const result = toPracticeRound(round(gap, translate), 5);
    expect(result?.map((item) => [item.options, item.source])).toEqual([
      [null, null],
      [null, null],
    ]);
  });

  it("returns null for a round with no items", () => {
    expect(toPracticeRound(round(), 5)).toBeNull();
  });

  it("returns null when every item is dropped", () => {
    expect(toPracticeRound(round({ ...gap, kind: "riddle" }), 5)).toBeNull();
  });

  it("drops a choose item with two options, with repeated options and with an answer outside its options", () => {
    expect(toPracticeRound(round({ ...choose, options: ["have been", "was"] }), 5)).toBeNull();
    expect(
      toPracticeRound(round({ ...choose, options: ["have been", "was", "was"] }), 5),
    ).toBeNull();
    expect(
      toPracticeRound(round({ ...choose, options: ["have been", "Was", "was"] }), 5),
    ).not.toBeNull();
    expect(toPracticeRound(round({ ...choose, accepted: ["were"] }), 5)).toBeNull();
    expect(toPracticeRound(round({ ...choose, accepted: ["have been", "was"] }), 5)).toBeNull();
  });

  it("drops a choose or gap item with no gap in its prompt", () => {
    expect(toPracticeRound(round({ ...choose, prompt: "I have been there." }), 5)).toBeNull();
    expect(toPracticeRound(round({ ...gap, prompt: "She has lived here." }), 5)).toBeNull();
  });

  it("drops a gap item with two gaps", () => {
    expect(toPracticeRound(round({ ...gap, prompt: "She ___ here ___ May." }), 5)).toBeNull();
  });

  it("drops a fix or translate item with a gap", () => {
    expect(toPracticeRound(round({ ...fix, prompt: "I never ___ there." }), 5)).toBeNull();
    expect(toPracticeRound(round({ ...translate, prompt: "Nunca ___." }), 5)).toBeNull();
  });

  it("drops an unknown kind", () => {
    expect(toPracticeRound(round({ ...gap, kind: "match" }, fix), 5)).toHaveLength(1);
  });

  it("drops an item with no accepted answer", () => {
    expect(toPracticeRound(round({ ...gap, accepted: [] }), 5)).toBeNull();
    expect(toPracticeRound(round({ ...gap, accepted: [" "] }), 5)).toBeNull();
  });

  it("keeps at most the asked count", () => {
    expect(toPracticeRound(round(gap, fix, translate, choose), 2)).toHaveLength(2);
  });

  it("cuts nothing at 80 characters of rule and drops 81", () => {
    expect(toPracticeRound(round({ ...gap, rule: "r".repeat(80) }), 5)).toHaveLength(1);
    expect(toPracticeRound(round({ ...gap, rule: "r".repeat(81) }), 5)).toBeNull();
  });

  it("drops an item whose prompt, explanation or an answer is too long", () => {
    expect(toPracticeRound(round({ ...gap, prompt: `${"p".repeat(300)} ___` }), 5)).toBeNull();
    expect(toPracticeRound(round({ ...gap, explanation: "e".repeat(301) }), 5)).toBeNull();
    expect(toPracticeRound(round({ ...gap, accepted: ["a".repeat(301)] }), 5)).toBeNull();
    expect(toPracticeRound(round({ ...gap, explanation: " " }), 5)).toBeNull();
  });

  it("keeps the source only for fix items", () => {
    const result = toPracticeRound(round({ ...gap, source: "from chat" }, fix), 5);
    expect(result?.map((item) => item.source)).toEqual([null, "I never been to Japan."]);
  });
});

describe("splitGap", () => {
  it("splits around one gap", () => {
    expect(splitGap("I ___ to Japan.")).toEqual({ before: "I ", after: " to Japan." });
  });

  it("splits a gap at the start or the end", () => {
    expect(splitGap(`${GAP} went home`)).toEqual({ before: "", after: " went home" });
    expect(splitGap("He went ___")).toEqual({ before: "He went ", after: "" });
  });

  it("returns null with no gap", () => {
    expect(splitGap("I went home.")).toBeNull();
  });

  it("returns null with two gaps", () => {
    expect(splitGap("I ___ and ___.")).toBeNull();
  });
});
