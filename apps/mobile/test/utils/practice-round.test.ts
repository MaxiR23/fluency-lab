// apps/mobile/test/utils/practice-round.test.ts
//
// Tests for the mapping of the tutor's practice exercise to a saved exercise.
//
// Tested:
// - toExercise trims, maps and rejects an exercise that breaks a rule of its kind or a limit, each with its reason code
// - toExercise rejects a choose option or a gap answer that repeats the word before or after the gap
// - hintGivesAnswer and promptShowsAnswer find a gap or a translate that shows its answer
// - ruleKey compares rules trimmed and case-insensitive
// - isNegative finds the polarity of a sentence
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
  hintGivesAnswer,
  isNegative,
  promptShowsAnswer,
  ruleKey,
  splitGap,
  toExercise,
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
  rule: "Present perfect with since",
  kind: "gap",
  prompt: "She ___ here since May.",
  options: [],
  accepted: ["has lived"],
};
const fix: Raw = {
  ...choose,
  rule: "Present perfect with never",
  kind: "fix",
  prompt: "I never been to Japan.",
  options: [],
  accepted: ["I've never been to Japan."],
  source: "I never been to Japan.",
};
const translate: Raw = {
  ...choose,
  rule: "Present perfect experience",
  kind: "translate",
  prompt: "Nunca he estado en Japón.",
  options: [],
  accepted: ["I have never been to Japan."],
};

function ok(raw: Raw) {
  const result = toExercise(raw);
  if (!result.ok) throw new Error(`rejected with ${result.reason}`);
  return result.exercise;
}

function reasonOf(raw: Raw) {
  const result = toExercise(raw);
  return result.ok ? null : result.reason;
}

describe("toExercise and a word doubled around the gap", () => {
  const supermarket = "She ___ to the supermarket twice this week.";

  it("rejects a choose whose options end with the word after the gap", () => {
    expect(
      reasonOf({
        ...choose,
        prompt: supermarket,
        options: ["has been to", "has gone to", "has went to"],
        accepted: ["has been to"],
      }),
    ).toBe("gap_word_doubled");
  });

  it("passes the same choose when the options leave the word to the sentence", () => {
    expect(
      reasonOf({
        ...choose,
        prompt: supermarket,
        options: ["has been", "has gone", "has went"],
        accepted: ["has been"],
      }),
    ).toBeNull();
  });

  it("rejects a gap whose accepted answer ends with the word after the cue", () => {
    const museum = { ...gap, prompt: "We ___ (go) to the museum.", accepted: ["have gone to"] };
    expect(reasonOf(museum)).toBe("gap_word_doubled");
    expect(reasonOf({ ...museum, accepted: ["have gone"] })).toBeNull();
  });

  it("rejects an answer that starts with the word before the gap", () => {
    expect(reasonOf({ ...gap, prompt: "I have ___ (be) to Rome.", accepted: ["have been"] })).toBe(
      "gap_word_doubled",
    );
  });

  it("does not reject a gap at the start or the end of the prompt for a missing neighbour", () => {
    expect(
      reasonOf({
        ...choose,
        prompt: "___ you ever been to Rome?",
        options: ["Have", "Has", "Did"],
        accepted: ["Have"],
      }),
    ).toBeNull();
    expect(
      reasonOf({
        ...choose,
        prompt: "By next year she ___",
        options: ["will have left", "leaves", "left"],
        accepted: ["will have left"],
      }),
    ).toBeNull();
  });

  it("compares whole words, not parts of them", () => {
    expect(
      reasonOf({
        ...choose,
        prompt: "She ___ together with us.",
        options: ["went", "goes", "go"],
        accepted: ["went"],
      }),
    ).toBeNull();
  });
});

describe("toExercise", () => {
  it("maps a valid exercise of each kind", () => {
    expect(ok(choose)).toEqual({
      kind: "choose",
      rule: "Present perfect",
      prompt: "I ___ to Japan twice.",
      options: ["have been", "was", "am"],
      accepted: ["have been"],
      explanation: "Use the present perfect for an experience.",
      source: null,
    });
    expect(toExercise(gap).ok).toBe(true);
    expect(toExercise(fix).ok).toBe(true);
    expect(toExercise(translate).ok).toBe(true);
  });

  it("trims every text", () => {
    const exercise = ok({
      ...choose,
      rule: " Present perfect ",
      options: [" have been ", "was", "am"],
      accepted: [" have been "],
    });
    expect(exercise).toMatchObject({
      rule: "Present perfect",
      options: ["have been", "was", "am"],
      accepted: ["have been"],
    });
  });

  it("turns empty options and source into null", () => {
    expect([ok(gap), ok(translate)].map((item) => [item.options, item.source])).toEqual([
      [null, null],
      [null, null],
    ]);
  });

  it("keeps the source only for fix exercises", () => {
    expect(ok({ ...gap, source: "from chat" }).source).toBeNull();
    expect(ok(fix).source).toBe("I never been to Japan.");
  });

  it("rejects an unknown kind with wrong_kind", () => {
    expect(reasonOf({ ...gap, kind: "riddle" })).toBe("wrong_kind");
  });

  it("rejects two options or a repeated option with choose_options", () => {
    expect(reasonOf({ ...choose, options: ["have been", "was"] })).toBe("choose_options");
    expect(reasonOf({ ...choose, options: ["have been", "was", "was"] })).toBe("choose_options");
    expect(reasonOf({ ...choose, options: ["have been", "Was", "was"] })).toBeNull();
  });

  it("rejects an answer outside the options, or two answers, with choose_answer_not_option", () => {
    expect(reasonOf({ ...choose, accepted: ["were"] })).toBe("choose_answer_not_option");
    expect(reasonOf({ ...choose, accepted: ["have been", "was"] })).toBe(
      "choose_answer_not_option",
    );
  });

  it("rejects no gap or two gaps with gap_count", () => {
    expect(reasonOf({ ...choose, prompt: "I have been there." })).toBe("gap_count");
    expect(reasonOf({ ...gap, prompt: "She has lived here." })).toBe("gap_count");
    expect(reasonOf({ ...gap, prompt: "She ___ here ___ May." })).toBe("gap_count");
    expect(reasonOf({ ...fix, prompt: "I never ___ there." })).toBe("gap_count");
    expect(reasonOf({ ...translate, prompt: "Nunca ___." })).toBe("gap_count");
  });

  it("rejects no accepted answer or too long a text with limit", () => {
    expect(reasonOf({ ...gap, accepted: [] })).toBe("limit");
    expect(reasonOf({ ...gap, accepted: [" "] })).toBe("limit");
    expect(reasonOf({ ...gap, rule: "r".repeat(81) })).toBe("limit");
    expect(reasonOf({ ...gap, rule: "r".repeat(80) })).toBeNull();
    expect(reasonOf({ ...gap, prompt: `${"p".repeat(300)} ___` })).toBe("limit");
    expect(reasonOf({ ...gap, explanation: "e".repeat(301) })).toBe("limit");
    expect(reasonOf({ ...gap, explanation: " " })).toBe("limit");
    expect(reasonOf({ ...gap, accepted: ["a".repeat(301)] })).toBe("limit");
    expect(reasonOf({ ...choose, options: ["o".repeat(121), "was", "am"] })).toBe("limit");
  });

  it("rejects a fix equal to an accepted answer with fix_already_answer", () => {
    const already: Raw = {
      ...fix,
      prompt: "I can't remember who made the shot.",
      accepted: ["I can't remember who made the shot."],
      source: "",
    };
    expect(reasonOf(already)).toBe("fix_already_answer");
    expect(
      reasonOf({
        ...already,
        prompt: "i can’t remember who made the shot",
        accepted: ["I can't remember who made the shot.", "I can't recall who made the shot."],
      }),
    ).toBe("fix_already_answer");
  });

  it("rejects a fix whose accepted answer changes the polarity with fix_polarity", () => {
    const cant: Raw = {
      ...fix,
      prompt: "I can remember who made the shot.",
      accepted: ["I can't remember who made the shot."],
      source: "",
    };
    expect(reasonOf(cant)).toBe("fix_polarity");
    expect(
      reasonOf({ ...fix, accepted: ["I've never been to Japan.", "I've been to Japan."] }),
    ).toBe("fix_polarity");
    expect(reasonOf(fix)).toBeNull();
  });

  it("does not check polarity for gap, choose and translate", () => {
    expect(
      reasonOf({
        ...gap,
        prompt: "I ___ (not / can) remember who made the shot.",
        accepted: ["can't"],
      }),
    ).toBeNull();
    expect(
      reasonOf({
        ...choose,
        prompt: "I ___ to Japan.",
        options: ["have never been", "was", "am"],
        accepted: ["have never been"],
      }),
    ).toBeNull();
    expect(
      reasonOf({
        ...translate,
        prompt: "No he estado en Japón.",
        accepted: ["I haven't been to Japan."],
      }),
    ).toBeNull();
  });

  it("rejects a gap whose hint gives the answer with hint_shows_answer", () => {
    expect(reasonOf({ ...gap, prompt: "I ___ (go) to school.", accepted: ["go"] })).toBe(
      "hint_shows_answer",
    );
  });

  it("rejects a gap or a translate that shows its answer with prompt_shows_answer", () => {
    expect(
      reasonOf({ ...gap, prompt: "She has lived here. She ___ here.", accepted: ["has lived"] }),
    ).toBe("prompt_shows_answer");
    expect(
      reasonOf({
        ...translate,
        prompt: "I have never been to Japan.",
        accepted: ["I have never been to Japan."],
      }),
    ).toBe("prompt_shows_answer");
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

describe("hintGivesAnswer", () => {
  it("drops the reported gap: I ___ (go) to school with go accepted", () => {
    expect(hintGivesAnswer("I ___ (go) to school.", ["go"])).toBe(true);
  });

  it("keeps a hint that is a different form of the answer", () => {
    expect(hintGivesAnswer("I ___ (go) to school.", ["went"])).toBe(false);
  });

  it("reads the hint without not and the slash", () => {
    expect(hintGivesAnswer("I ___ (not / go) there.", ["go"])).toBe(true);
  });

  it("keeps (not / can) with can't accepted", () => {
    expect(hintGivesAnswer("I ___ (not / can) remember.", ["can't"])).toBe(false);
  });

  it("is false with no parentheses", () => {
    expect(hintGivesAnswer("I ___ to school.", ["go"])).toBe(false);
  });

  it("matches after case, spacing and curly quotes", () => {
    expect(hintGivesAnswer("I ___ (Go ) there.", ["go"])).toBe(true);
    expect(hintGivesAnswer("It ___ (don’t) work.", ["don't"])).toBe(true);
  });

  it("ignores an empty hint", () => {
    expect(hintGivesAnswer("I ___ () there.", ["go"])).toBe(false);
  });
});

describe("promptShowsAnswer", () => {
  it("finds a gap whose sentence outside the parentheses holds the answer as whole words", () => {
    const item = {
      kind: "gap" as const,
      prompt: "She went home. Yesterday she ___ (go) out.",
      accepted: ["went"],
    };
    expect(promptShowsAnswer(item)).toBe(true);
  });

  it("does not count a word inside another word", () => {
    const item = { kind: "gap" as const, prompt: "I am going. I ___ (do) it.", accepted: ["go"] };
    expect(promptShowsAnswer(item)).toBe(false);
  });

  it("does not read the hint as part of the sentence", () => {
    const item = { kind: "gap" as const, prompt: "I ___ (go) home.", accepted: ["go"] };
    expect(promptShowsAnswer(item)).toBe(false);
  });

  it("finds a translate whose prompt holds an accepted answer", () => {
    const item = {
      kind: "translate" as const,
      prompt: "Say it in English: I have never been to Japan.",
      accepted: ["I have never been to Japan."],
    };
    expect(promptShowsAnswer(item)).toBe(true);
  });

  it("never checks a choose or a fix", () => {
    for (const kind of ["choose", "fix"] as const) {
      const item = { kind, prompt: "I went home.", accepted: ["went"] };
      expect(promptShowsAnswer(item)).toBe(false);
    }
  });

  it("matches a multi-word answer as a run of words", () => {
    const item = {
      kind: "gap" as const,
      prompt: "He has gone. She ___ (go) too.",
      accepted: ["has gone"],
    };
    expect(promptShowsAnswer(item)).toBe(true);
  });

  it("is false for an empty accepted list", () => {
    const item = { kind: "gap" as const, prompt: "She ___ home.", accepted: [] };
    expect(promptShowsAnswer(item)).toBe(false);
  });
});

describe("ruleKey", () => {
  it("compares rules trimmed and case-insensitive", () => {
    expect(ruleKey("  Present Perfect ")).toBe("present perfect");
    expect(ruleKey("Articles")).toBe(ruleKey("articles "));
  });

  it("keeps an empty rule empty", () => {
    expect(ruleKey("  ")).toBe("");
  });
});
