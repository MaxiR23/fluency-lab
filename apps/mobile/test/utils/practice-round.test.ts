// apps/mobile/test/utils/practice-round.test.ts
//
// Tests for the mapping of the tutor's practice round to exercises.
//
// Tested:
// - toPracticeRound trims, drops the exercises that break a rule of their kind or a limit, and caps the count
// - isNegative finds the polarity of a sentence
// - toPracticeRound drops a fix that is already correct or changes polarity, and needs the full count
// - gapSentenceFill matches a gap answered with the whole sentence
// - splitGap splits a prompt around its one gap
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/practice-round.test.ts
//
// SEE: apps/mobile/src/utils/practice-round.ts

import { describe, expect, it } from "@jest/globals";

import {
  GAP,
  gapSentenceFill,
  isNegative,
  splitGap,
  toPracticeRound,
} from "@/utils/practice-round";

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
      1,
    );
    expect(result?.[0]).toMatchObject({
      rule: "Present perfect",
      options: ["have been", "was", "am"],
      accepted: ["have been"],
    });
  });

  it("turns empty options and source into null", () => {
    const result = toPracticeRound(round(gap, translate), 2);
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
      toPracticeRound(round({ ...choose, options: ["have been", "Was", "was"] }), 1),
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
    expect(toPracticeRound(round({ ...gap, kind: "match" }, fix), 1)).toHaveLength(1);
  });

  it("drops an item with no accepted answer", () => {
    expect(toPracticeRound(round({ ...gap, accepted: [] }), 5)).toBeNull();
    expect(toPracticeRound(round({ ...gap, accepted: [" "] }), 5)).toBeNull();
  });

  it("keeps at most the asked count", () => {
    expect(toPracticeRound(round(gap, fix, translate, choose), 2)).toHaveLength(2);
  });

  it("cuts nothing at 80 characters of rule and drops 81", () => {
    expect(toPracticeRound(round({ ...gap, rule: "r".repeat(80) }), 1)).toHaveLength(1);
    expect(toPracticeRound(round({ ...gap, rule: "r".repeat(81) }), 5)).toBeNull();
  });

  it("drops an item whose prompt, explanation or an answer is too long", () => {
    expect(toPracticeRound(round({ ...gap, prompt: `${"p".repeat(300)} ___` }), 5)).toBeNull();
    expect(toPracticeRound(round({ ...gap, explanation: "e".repeat(301) }), 5)).toBeNull();
    expect(toPracticeRound(round({ ...gap, accepted: ["a".repeat(301)] }), 5)).toBeNull();
    expect(toPracticeRound(round({ ...gap, explanation: " " }), 5)).toBeNull();
  });

  it("keeps the source only for fix items", () => {
    const result = toPracticeRound(round({ ...gap, source: "from chat" }, fix), 2);
    expect(result?.map((item) => item.source)).toEqual([null, "I never been to Japan."]);
  });
});

describe("toPracticeRound with spares and fix checks", () => {
  const cant: Raw = {
    ...fix,
    prompt: "I can remember who made the shot.",
    accepted: ["I can't remember who made the shot."],
    source: "",
  };

  it("returns null when fewer items than the count are valid", () => {
    expect(toPracticeRound(round(gap, fix, { ...gap, kind: "riddle" }), 3)).toBeNull();
  });

  it("keeps the first valid items up to the count from a round with spares", () => {
    const items = [
      { ...gap, prompt: "One ___." },
      { ...gap, kind: "riddle" },
      { ...gap, prompt: "Three ___." },
      { ...gap, kind: "riddle" },
      { ...gap, prompt: "Five ___." },
      { ...gap, prompt: "Six ___." },
      { ...gap, prompt: "Seven ___." },
    ];
    const result = toPracticeRound(round(...items), 5);
    expect(result?.map((item) => item.prompt)).toEqual([
      "One ___.",
      "Three ___.",
      "Five ___.",
      "Six ___.",
      "Seven ___.",
    ]);
  });

  it("keeps exactly the count when exactly the count are valid", () => {
    expect(toPracticeRound(round(gap, gap, gap, gap, gap), 5)).toHaveLength(5);
  });

  it("drops a fix whose prompt is already one of its accepted answers", () => {
    const already: Raw = {
      ...fix,
      prompt: "I can't remember who made the shot.",
      accepted: ["I can't remember who made the shot."],
      source: "",
    };
    expect(toPracticeRound(round(already), 1)).toBeNull();
  });

  it("drops a fix equal to an accepted answer after normalizing", () => {
    const already: Raw = {
      ...fix,
      prompt: "i can’t remember who made the shot",
      accepted: ["I can't remember who made the shot.", "I can't recall who made the shot."],
    };
    expect(toPracticeRound(round(already), 1)).toBeNull();
  });

  it("drops a fix whose accepted answer turns the prompt negative", () => {
    expect(toPracticeRound(round(cant), 1)).toBeNull();
  });

  it("drops a fix when any accepted answer differs in polarity", () => {
    const mixed: Raw = {
      ...fix,
      prompt: "I never been to Japan.",
      accepted: ["I've never been to Japan.", "I've been to Japan."],
    };
    expect(toPracticeRound(round(mixed), 1)).toBeNull();
  });

  it("keeps a negative fix whose accepted answers stay negative", () => {
    expect(toPracticeRound(round(fix), 1)).toHaveLength(1);
  });

  it("does not check polarity for gap, choose and translate", () => {
    const negativeGap: Raw = {
      ...gap,
      prompt: "I ___ (not / can) remember who made the shot.",
      accepted: ["can't"],
    };
    const negativeChoose: Raw = {
      ...choose,
      prompt: "I ___ to Japan.",
      options: ["have never been", "was", "am"],
      accepted: ["have never been"],
    };
    const negativeTranslate: Raw = {
      ...translate,
      prompt: "No he estado en Japón.",
      accepted: ["I haven't been to Japan."],
    };
    expect(toPracticeRound(round(negativeGap), 1)).toHaveLength(1);
    expect(toPracticeRound(round(negativeChoose), 1)).toHaveLength(1);
    expect(toPracticeRound(round(negativeTranslate), 1)).toHaveLength(1);
  });
});

describe("isNegative", () => {
  it.each([
    "I do not know.",
    "I never go.",
    "There is no time.",
    "Nobody came.",
    "I saw nothing.",
    "It is nowhere.",
    "None of them.",
    "I cannot go.",
  ])("finds a negative word in %s", (text) => {
    expect(isNegative(text)).toBe(true);
  });

  it("finds n't at the end of a word, with a straight or a curly apostrophe", () => {
    expect(isNegative("I can't")).toBe(true);
    expect(isNegative("She doesn’t")).toBe(true);
    expect(isNegative("We won't")).toBe(true);
  });

  it("is false for an affirmative sentence", () => {
    expect(isNegative("I can remember who made the shot.")).toBe(false);
  });

  it("is false for an empty text", () => {
    expect(isNegative("")).toBe(false);
    expect(isNegative("  ")).toBe(false);
  });

  it("does not match a negative word inside another word", () => {
    expect(isNegative("I know the notes.")).toBe(false);
    expect(isNegative("Nobel")).toBe(false);
    expect(isNegative("nothingness")).toBe(false);
    expect(isNegative("Not now.")).toBe(true);
    expect(isNegative("Never!")).toBe(true);
  });

  it("ignores case", () => {
    expect(isNegative("NEVER again")).toBe(true);
  });
});

describe("gapSentenceFill", () => {
  const cued = {
    kind: "gap" as const,
    prompt: "I ___ (not / can) remember who made the shot!",
    accepted: ["can't"],
  };

  it("returns the fill when the answer is the whole sentence with the gap filled", () => {
    const item = {
      kind: "gap" as const,
      prompt: "She ___ here since May.",
      accepted: ["has lived"],
    };
    expect(gapSentenceFill(item, "She has lived here since May.")).toBe("has lived");
  });

  it("matches the whole sentence without the cue in parentheses", () => {
    expect(gapSentenceFill(cued, "I can't remember who made the shot")).toBe("can't");
  });

  it("matches the whole sentence that keeps the cue", () => {
    expect(gapSentenceFill(cued, "I can't (not / can) remember who made the shot!")).toBe("can't");
  });

  it("matches after case, spacing, curly quotes and the final mark", () => {
    expect(gapSentenceFill(cued, "  i can’t   remember who made the shot.")).toBe("can't");
  });

  it("returns the second accepted answer when it is the one used", () => {
    const item = { ...cued, accepted: ["can't", "cannot"] };
    expect(gapSentenceFill(item, "I cannot remember who made the shot")).toBe("cannot");
  });

  it("returns null for a sentence with a wrong fill", () => {
    expect(gapSentenceFill(cued, "I can remember who made the shot!")).toBeNull();
  });

  it("returns null for the fill alone", () => {
    expect(gapSentenceFill(cued, "can't")).toBeNull();
  });

  it("returns null for an empty answer", () => {
    expect(gapSentenceFill(cued, "")).toBeNull();
  });

  it("returns null for a choose, a fix or a translate item", () => {
    for (const kind of ["choose", "fix", "translate"] as const) {
      expect(gapSentenceFill({ ...cued, kind }, "I can't remember who made the shot")).toBeNull();
    }
  });

  it("returns null for a prompt with no gap or two gaps", () => {
    expect(gapSentenceFill({ ...cued, prompt: "I can remember." }, "I can't remember")).toBeNull();
    expect(
      gapSentenceFill({ ...cued, prompt: "I ___ ___ remember." }, "I can't can't remember"),
    ).toBeNull();
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
