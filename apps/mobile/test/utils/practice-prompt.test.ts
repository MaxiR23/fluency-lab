// apps/mobile/test/utils/practice-prompt.test.ts
//
// Tests for the prompts of a practice exercise, its solver and reviewer, and of the grading of an answer.
//
// Tested:
// - focusDataFrom picks the focus data a run sends
// - exerciseRequest sends only the slot's kind, target and avoid list, with the rules of that kind
// - solveRequest sends what the learner sees and reviewRequest adds the accepted answers and the solver's answer
// - RULE_PRACTICE_GRADE asks for one short sentence to the learner
// - RULE_PRACTICE_FIX puts the one mistake on the practiced rule with a single correction; RULE_PRACTICE_REVIEW counts variants as one answer and judges only the practiced point
// - avoidPrompts builds the avoid list from the run, the queue, the rejected prompts and the recent prompts
// - focusDataFrom sends the raw id of a topic outside the catalog
// - rotateMistakes puts the rules not practiced recently first
// - focusDataFrom carries a note as the focus of a note run
// - studyNoteRequest asks for one study note on the missed item's rule and sends nothing personal
// - gradeRequest sends the exercise, the accepted answers and the learner's answer only
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/practice-prompt.test.ts
//
// SEE: apps/mobile/src/utils/practice-prompt.ts

import { describe, expect, it } from "@jest/globals";

import { PRACTICE_KINDS, type PracticeKind } from "@fluency-lab/shared";

import type { PracticeSlot, SlotTarget } from "@/utils/practice-slots";
import {
  KIND_LABELS,
  RULE_PRACTICE_ANSWERABLE,
  RULE_PRACTICE_AVOID,
  RULE_PRACTICE_CHOOSE,
  RULE_PRACTICE_FIX,
  RULE_PRACTICE_FIX_SOURCE,
  RULE_PRACTICE_GAP,
  RULE_PRACTICE_GRADE,
  RULE_PRACTICE_KIND,
  RULE_PRACTICE_NO_ANSWER,
  RULE_PRACTICE_NOTE,
  RULE_PRACTICE_OPEN_TARGET,
  RULE_PRACTICE_REVIEW,
  RULE_PRACTICE_RULE,
  RULE_PRACTICE_RULE_WORDS,
  RULE_PRACTICE_SOLVE,
  RULE_PRACTICE_TARGET_RULE,
  RULE_STUDY_NOTE,
  avoidPrompts,
  exerciseRequest,
  focusDataFrom,
  gradeRequest,
  missedRulesLine,
  reviewRequest,
  rotateMistakes,
  solveRequest,
  studyNoteRequest,
  translateRule,
} from "@/utils/practice-prompt";
import { NOTE_SHAPE, RULE_NO_KEY } from "@/utils/tutor-prompt";

const mistakes = (count: number) => ({
  items: Array.from({ length: count }, (_, index) => ({
    rule: index === 0 ? null : `Rule ${index}`,
    times: 3,
    latest: { original: `bad ${index}`, corrected: `good ${index}` },
  })),
  nextOffset: null,
});
const words = (count: number) => ({
  items: Array.from({ length: count }, (_, index) => ({
    word: `word${index}`,
    sentence: "A private sentence from the chat.",
    day: "2026-11-05",
  })),
  nextOffset: null,
});

function userTurn(request: { turns: { role: string; text: string }[] }) {
  expect(request.turns).toHaveLength(1);
  expect(request.turns[0]?.role).toBe("user");
  return JSON.parse(request.turns[0]?.text ?? "null") as Record<string, unknown>;
}

describe("focusDataFrom", () => {
  it("sends the latest example of each mistake group with its rule", () => {
    expect(
      focusDataFrom("mistakes", null, mistakes(2), words(0), "intermediate", null, []),
    ).toEqual({
      kind: "mistakes",
      corrections: [
        { original: "bad 0", corrected: "good 0", rule: null },
        { original: "bad 1", corrected: "good 1", rule: "Rule 1" },
      ],
    });
  });

  it("sends the raw id as the topic of a round on a topic outside the catalog", () => {
    expect(focusDataFrom("topic", "subjunctive", mistakes(0), words(0), null, null, [])).toEqual({
      kind: "topic",
      topic: "subjunctive",
      level: null,
    });
  });

  it("sends at most ten mistake groups and fifteen words", () => {
    const data = focusDataFrom("mistakes", null, mistakes(14), words(20), null, null, []);
    expect(data.kind === "mistakes" && data.corrections).toHaveLength(10);
    const wordData = focusDataFrom("words", null, mistakes(0), words(20), null, null, []);
    expect(wordData.kind === "words" && wordData.words).toHaveLength(15);
  });

  it("sends only the words for the words focus", () => {
    expect(focusDataFrom("words", null, mistakes(3), words(2), null, null, [])).toEqual({
      kind: "words",
      words: ["word0", "word1"],
    });
  });

  it("sends the topic and the level for a topic", () => {
    expect(
      focusDataFrom("topic", "conditionals", mistakes(0), words(0), "advanced", null, []),
    ).toEqual({
      kind: "topic",
      topic: "Conditionals",
      level: "advanced",
    });
  });

  it("sends a null level when none is set", () => {
    expect(focusDataFrom("topic", "articles", mistakes(0), words(0), null, null, [])).toEqual({
      kind: "topic",
      topic: "Articles",
      level: null,
    });
  });
});

describe("exerciseRequest", () => {
  const slotOf = (kind: PracticeKind, target: SlotTarget, position = 0): PracticeSlot => ({
    position,
    kind,
    target,
  });
  const wordSlot = slotOf("gap", { focus: "words", word: "definitely" });
  const mistakeSlot = (rule: string | null) =>
    slotOf("fix", {
      focus: "mistakes",
      correction: { original: "I never been", corrected: "I've never been", rule },
    });
  const base = {
    slot: wordSlot,
    missedRules: [] as string[],
    language: null,
    avoid: [] as string[],
  };

  it("sends only the slot's kind, target and the avoid list", () => {
    const request = exerciseRequest({ ...base, avoid: ["I ___ (be) there."] });
    expect(userTurn(request)).toEqual({
      kind: "gap",
      target: { focus: "words", word: "definitely" },
      avoid: ["I ___ (be) there."],
    });
  });

  it("sends an empty avoid on the first exercise of a new run", () => {
    expect(userTurn(exerciseRequest(base)).avoid).toEqual([]);
  });

  it("states the rules of the slot's kind and not the other kinds'", () => {
    const rulesByKind: Record<PracticeKind, string[]> = {
      fix: [RULE_PRACTICE_FIX, RULE_PRACTICE_FIX_SOURCE],
      gap: [RULE_PRACTICE_GAP],
      choose: [RULE_PRACTICE_CHOOSE],
      translate: [],
    };
    const everyRule = [
      RULE_PRACTICE_FIX,
      RULE_PRACTICE_FIX_SOURCE,
      RULE_PRACTICE_GAP,
      RULE_PRACTICE_CHOOSE,
    ];
    for (const kind of PRACTICE_KINDS) {
      const { system } = exerciseRequest({
        ...base,
        slot: slotOf(kind, { focus: "topic", topic: "Articles", level: null }),
        language: "es",
      });
      expect(system).toContain(RULE_PRACTICE_KIND[kind]);
      for (const rule of rulesByKind[kind]) expect(system).toContain(rule);
      for (const rule of everyRule.filter((entry) => !rulesByKind[kind].includes(entry))) {
        expect(system).not.toContain(rule);
      }
      for (const other of PRACTICE_KINDS.filter((entry) => entry !== kind)) {
        expect(system).not.toContain(RULE_PRACTICE_KIND[other]);
      }
      expect(system).toContain(RULE_PRACTICE_ANSWERABLE);
      expect(system).toContain(RULE_PRACTICE_NO_ANSWER);
      expect(system).toContain(RULE_PRACTICE_AVOID);
      expect(system).toContain(RULE_NO_KEY);
    }
  });

  it("asks a translate in the device language with no names and no loanwords", () => {
    const { system } = exerciseRequest({
      ...base,
      slot: slotOf("translate", { focus: "topic", topic: "Articles", level: null }),
      language: "es-AR",
    });
    expect(system).toContain(translateRule("es-AR"));
    expect(translateRule("es-AR")).toContain("es-AR");
    expect(translateRule("es-AR")).toContain("no names");
    expect(translateRule("es-AR")).toContain("no loanwords");
    expect(system).not.toContain("at most one");
  });

  it("has no translate line for the other kinds", () => {
    expect(exerciseRequest(base).system).not.toContain("language with this tag");
  });

  it("has no mix, per-round cap or spare line", () => {
    const { system } = exerciseRequest(base);
    expect(system).not.toContain("Mix the kinds");
    expect(system).not.toContain("At most two exercises");
    expect(system).not.toContain("Within a round");
    expect(system).not.toContain("spare");
  });

  it("uses the words rule line for a words slot", () => {
    expect(exerciseRequest(base).system).toContain(RULE_PRACTICE_RULE_WORDS);
    expect(exerciseRequest(base).system).not.toContain(RULE_PRACTICE_RULE);
    expect(exerciseRequest({ ...base, slot: mistakeSlot("Articles") }).system).toContain(
      RULE_PRACTICE_RULE,
    );
  });

  it("asks for the target's rule as written when the target names one", () => {
    expect(exerciseRequest({ ...base, slot: mistakeSlot("Articles") }).system).toContain(
      RULE_PRACTICE_TARGET_RULE,
    );
    expect(exerciseRequest(base).system).toContain(RULE_PRACTICE_TARGET_RULE);
    expect(exerciseRequest({ ...base, slot: mistakeSlot(null) }).system).not.toContain(
      RULE_PRACTICE_TARGET_RULE,
    );
  });

  it("asks for another point for an open target", () => {
    const open = slotOf("fix", { focus: "mistakes", correction: null });
    const { system } = exerciseRequest({ ...base, slot: open });
    expect(system).toContain(RULE_PRACTICE_OPEN_TARGET);
    expect(system).not.toContain(RULE_PRACTICE_TARGET_RULE);
    expect(
      exerciseRequest({ ...base, slot: slotOf("gap", { focus: "words", word: null }) }).system,
    ).toContain(RULE_PRACTICE_OPEN_TARGET);
    expect(exerciseRequest(base).system).not.toContain(RULE_PRACTICE_OPEN_TARGET);
  });

  it("adds the missed rules line only when there are missed rules", () => {
    const { system } = exerciseRequest({ ...base, missedRules: ["Articles", "Present perfect"] });
    expect(system).toContain(missedRulesLine(["Articles", "Present perfect"]));
    expect(system.indexOf("Articles")).toBeLessThan(system.indexOf(RULE_PRACTICE_KIND.gap));
    expect(exerciseRequest(base).system.toLowerCase()).not.toContain("missed");
  });

  it("carries the note line for a note slot", () => {
    const note = {
      kind: "table" as const,
      title: "Future forms",
      topic: "Going to, will",
      content: {
        columns: ["Form", "When", "Example"] as [string, string, string],
        rows: [["going to", "plans", "I'm going to study."]] as [string, string, string][],
        remember: "Plans use going to.",
      },
    };
    const request = exerciseRequest({ ...base, slot: slotOf("gap", { focus: "note", note }) });
    expect(request.system).toContain(RULE_PRACTICE_NOTE);
    expect(request.system).toContain(RULE_PRACTICE_RULE);
    expect(userTurn(request)).toEqual({ kind: "gap", target: { focus: "note", note }, avoid: [] });
    expect(exerciseRequest(base).system).not.toContain(RULE_PRACTICE_NOTE);
  });

  it("asks a gap to carry the base verb and not in parentheses", () => {
    expect(RULE_PRACTICE_GAP).toContain("(not / can)");
    expect(RULE_PRACTICE_GAP).toContain('"not"');
    expect(RULE_PRACTICE_GAP).toContain('"(go)" for "went"');
    expect(RULE_PRACTICE_GAP).toContain("bare base form");
    expect(RULE_PRACTICE_ANSWERABLE).toContain("polarity");
    expect(RULE_PRACTICE_ANSWERABLE).toContain("exactly one answer");
  });

  it("asks for no answer in the prompt and no reuse of avoid", () => {
    expect(RULE_PRACTICE_NO_ANSWER).toContain("No prompt contains its accepted answer");
    expect(RULE_PRACTICE_AVOID).toContain("never reuse one of those prompts");
  });

  it("asks a fix to hold one real mistake and keep the learner's meaning", () => {
    expect(RULE_PRACTICE_FIX).toContain("never already correct");
    expect(RULE_PRACTICE_FIX).toContain("negation");
  });

  it("sends no name, goals, interests or chat text", () => {
    const request = exerciseRequest(base);
    const everything = `${request.system}\n${request.turns.map((turn) => turn.text).join("\n")}`;
    expect(everything).not.toContain("private sentence");
    expect(everything.toLowerCase()).not.toContain("goals");
    expect(everything.toLowerCase()).not.toMatch(/\bname\b/);
    expect(Object.keys(userTurn(request)).sort()).toEqual(["avoid", "kind", "target"]);
  });
});

describe("solveRequest", () => {
  const exercise = {
    kind: "choose" as const,
    rule: "Present perfect",
    prompt: "I ___ to Japan twice.",
    options: ["have been", "was", "am"],
    accepted: ["have been"],
    explanation: "Experience.",
    source: null,
  };

  it("sends only the kind, its instruction, the prompt and the options", () => {
    const request = solveRequest(exercise);
    expect(request.system).toContain(RULE_PRACTICE_SOLVE);
    expect(request.system).toContain(RULE_NO_KEY);
    const turn = userTurn(request);
    expect(turn).toEqual({
      kind: "choose",
      instruction: KIND_LABELS.choose,
      prompt: "I ___ to Japan twice.",
      options: ["have been", "was", "am"],
    });
    expect(turn).not.toHaveProperty("accepted");
    expect(turn).not.toHaveProperty("rule");
    expect(turn).not.toHaveProperty("explanation");
  });

  it("sends empty options for a kind with none", () => {
    const turn = userTurn(
      solveRequest({ ...exercise, kind: "fix", options: null, prompt: "She go home." }),
    );
    expect(turn.options).toEqual([]);
    expect(turn.instruction).toBe(KIND_LABELS.fix);
  });

  it("is a single user turn with no history", () => {
    expect(solveRequest(exercise).turns).toHaveLength(1);
    expect(solveRequest(exercise).turns[0]?.role).toBe("user");
  });
});

describe("reviewRequest", () => {
  const exercise = {
    kind: "fix" as const,
    rule: "Third person s",
    prompt: "She go to work.",
    options: null,
    accepted: ["She goes to work."],
    explanation: "Add s.",
    source: "She go to work.",
  };

  it("sends the exercise with its accepted answers and the solver's answer", () => {
    const request = reviewRequest(exercise, "She goes to work.");
    expect(request.system).toContain(RULE_PRACTICE_REVIEW);
    expect(request.system).toContain(RULE_NO_KEY);
    expect(userTurn(request)).toEqual({
      kind: "fix",
      instruction: KIND_LABELS.fix,
      rule: "Third person s",
      prompt: "She go to work.",
      options: [],
      accepted: ["She goes to work."],
      explanation: "Add s.",
      solverAnswer: "She goes to work.",
    });
  });

  it("defines each boolean in order", () => {
    const order = [
      "singleAnswer",
      "meaningKept",
      "answerNotInPrompt",
      "oneRealMistake",
      "naturalEnglish",
      "solverAnswerAccepted",
      "passed",
    ].map((name) => RULE_PRACTICE_REVIEW.indexOf(name));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("is a single user turn with no history", () => {
    expect(reviewRequest(exercise, "x").turns).toHaveLength(1);
  });

  it("counts contractions and spelling variants as one answer and judges only the practiced point", () => {
    expect(RULE_PRACTICE_REVIEW).toContain(
      "Contractions and spelling variants of the same answer count as one answer",
    );
    expect(RULE_PRACTICE_REVIEW).toContain(
      "Judge only the practiced point, not punctuation or style outside it",
    );
  });
});

describe("RULE_PRACTICE_FIX", () => {
  it("puts the mistake on the practiced rule with exactly one correction", () => {
    expect(RULE_PRACTICE_FIX).toContain("The mistake is on the practiced rule itself");
    expect(RULE_PRACTICE_FIX).toContain("exactly one correction fixes it");
  });

  it("never allows another form of the practiced point to be correct too", () => {
    expect(RULE_PRACTICE_FIX).toContain(
      "Never write a sentence where another form of the practiced point is also correct",
    );
    expect(RULE_PRACTICE_FIX).toContain('for "going to vs will"');
  });

  it("lists only the one correction and its spelling or contraction variants", () => {
    expect(RULE_PRACTICE_FIX).toContain(
      "accepted lists that one correction and only its spelling or contraction variants",
    );
  });
});

describe("RULE_PRACTICE_GRADE", () => {
  it("asks the grader to judge the visible prompt and to flag a flawed exercise", () => {
    expect(RULE_PRACTICE_GRADE).toContain("flawed");
    expect(RULE_PRACTICE_GRADE).toContain("examples");
    expect(RULE_PRACTICE_GRADE).toContain("___");
  });

  it("asks for one short sentence to the learner about their answer", () => {
    expect(RULE_PRACTICE_GRADE).toContain("one short sentence");
    expect(RULE_PRACTICE_GRADE).toContain("to the learner");
  });

  it("forbids naming the exercise, the prompt, the accepted answers or the learner in the third person", () => {
    expect(RULE_PRACTICE_GRADE).toContain("Never mention the exercise, the prompt");
    expect(RULE_PRACTICE_GRADE).toContain("accepted answers");
    expect(RULE_PRACTICE_GRADE).toContain("the learner in the third person");
  });
});

describe("gradeRequest", () => {
  it("sends the exercise, the accepted answers and the learner's answer only", () => {
    const request = gradeRequest(
      {
        kind: "fix",
        rule: "Present perfect",
        prompt: "I never been to Japan.",
        accepted: ["I've never been to Japan."],
      },
      "I have never visited Japan.",
    );
    expect(request.system).toContain(RULE_PRACTICE_GRADE);
    expect(request.system).toContain(RULE_NO_KEY);
    expect(userTurn(request)).toEqual({
      kind: "fix",
      rule: "Present perfect",
      prompt: "I never been to Japan.",
      accepted: ["I've never been to Japan."],
      answer: "I have never visited Japan.",
    });
  });
});

describe("study notes", () => {
  const draft = {
    kind: "table" as const,
    title: "Future forms",
    topic: "Going to, will",
    content: {
      columns: ["Form", "When", "Example"] as [string, string, string],
      rows: [["going to", "plans", "I'm going to study."]] as [string, string, string][],
      remember: "Plans use going to.",
    },
  };
  const item = {
    rule: "Going to vs will",
    prompt: "I ___ visit Rome next week.",
    accepted: ["am going to", "'m going to"],
    explanation: "Plans use going to.",
  };

  it("asks for one study note on the missed item's rule", () => {
    const request = studyNoteRequest(item);
    expect(request.system).toContain(RULE_STUDY_NOTE);
    expect(request.system).toContain(NOTE_SHAPE);
    expect(request.system).toContain(RULE_NO_KEY);
    expect(userTurn(request)).toEqual({
      rule: "Going to vs will",
      prompt: "I ___ visit Rome next week.",
      answer: "am going to",
      explanation: "Plans use going to.",
    });
  });

  it("sends no name, goals or chat text with a study note", () => {
    const request = studyNoteRequest(item);
    expect(Object.keys(userTurn(request)).sort()).toEqual([
      "answer",
      "explanation",
      "prompt",
      "rule",
    ]);
    expect(request.turns).toHaveLength(1);
  });

  it("sends an empty answer when the item accepts none", () => {
    expect(userTurn(studyNoteRequest({ ...item, accepted: [] })).answer).toBe("");
  });

  it("sends the note as the focus data of a note round", () => {
    const data = focusDataFrom("note", null, mistakes(0), words(0), null, draft, []);
    expect(data).toEqual({ kind: "note", note: draft });
  });
});

describe("avoidPrompts", () => {
  const own = [
    { prompt: "First ___.", position: 0 },
    { prompt: "Second ___.", position: 1 },
  ];
  const recent = (...prompts: string[]) =>
    prompts.map((prompt, index) => ({ runId: `old-${index}`, prompt, rule: "R" }));

  it("puts this run's prompts newest first, then the recent prompts of other runs", () => {
    expect(avoidPrompts(own, recent("Old one ___.", "Old two ___."), "run-1")).toEqual([
      "Second ___.",
      "First ___.",
      "Old one ___.",
      "Old two ___.",
    ]);
  });

  it("leaves out the recent items of this run", () => {
    const items = [
      { runId: "run-1", prompt: "First ___.", rule: "R" },
      { runId: "old", prompt: "Old ___.", rule: "R" },
    ];
    expect(avoidPrompts([], items, "run-1")).toEqual(["Old ___."]);
  });

  it("removes duplicates after normalizing", () => {
    expect(avoidPrompts(own, recent("first ___", "Other ___."), null)).toEqual([
      "Second ___.",
      "First ___.",
      "Other ___.",
    ]);
  });

  it("keeps 40 at most", () => {
    const many = (n: number) => recent(...Array.from({ length: n }, (_, i) => `Old ${i} ___.`));
    expect(avoidPrompts([], many(41), null)).toHaveLength(40);
    expect(avoidPrompts([], many(40), null)).toHaveLength(40);
    expect(avoidPrompts([], many(39), null)).toHaveLength(39);
  });

  it("is [] with no items and no recent prompts", () => {
    expect(avoidPrompts([], [], null)).toEqual([]);
  });

  it("adds the queued items and the rejected prompts of the slot", () => {
    expect(
      avoidPrompts(own, recent("Old ___."), null, ["Queued ___.", "Rejected ___.", "first ___"]),
    ).toEqual(["Queued ___.", "Rejected ___.", "first ___", "Second ___.", "Old ___."]);
  });
});

describe("rotateMistakes and focusDataFrom", () => {
  const groups = (count: number) => mistakes(count).items;

  it("puts the rules not seen in the recent items first, then the rest in order", () => {
    const rotated = rotateMistakes(groups(4), ["Rule 1"]);
    expect(rotated.map((group) => group.rule)).toEqual([null, "Rule 2", "Rule 3", "Rule 1"]);
  });

  it("compares rule labels trimmed and case-insensitive", () => {
    const rotated = rotateMistakes(groups(3), [" rule 1 "]);
    expect(rotated.map((group) => group.rule)).toEqual([null, "Rule 2", "Rule 1"]);
  });

  it("counts a group with no rule as not seen", () => {
    const rotated = rotateMistakes(groups(3), ["Rule 1", "Rule 2"]);
    expect(rotated.map((group) => group.rule)).toEqual([null, "Rule 1", "Rule 2"]);
  });

  it("keeps the existing order with no recent rules", () => {
    expect(rotateMistakes(groups(4), [])).toEqual(groups(4));
  });

  it("still sends ten at most after the rotation", () => {
    const seen = ["Rule 1", "Rule 2", "Rule 3", "Rule 4"];
    const data = focusDataFrom("mistakes", null, mistakes(14), words(0), null, null, seen);
    const rules = data.kind === "mistakes" ? data.corrections.map((c) => c.rule) : [];
    expect(rules).toHaveLength(10);
    expect(rules).toEqual([
      null,
      "Rule 5",
      "Rule 6",
      "Rule 7",
      "Rule 8",
      "Rule 9",
      "Rule 10",
      "Rule 11",
      "Rule 12",
      "Rule 13",
    ]);
  });

  it("sends the seen rules when every rule was seen", () => {
    const seen = Array.from({ length: 4 }, (_, i) => `Rule ${i}`);
    const data = focusDataFrom("mistakes", null, mistakes(4), words(0), null, null, seen);
    expect(data.kind === "mistakes" && data.corrections.map((c) => c.rule)).toEqual([
      null,
      "Rule 1",
      "Rule 2",
      "Rule 3",
    ]);
  });
});
