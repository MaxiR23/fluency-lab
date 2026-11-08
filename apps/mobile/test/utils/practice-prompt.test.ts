// apps/mobile/test/utils/practice-prompt.test.ts
//
// Tests for the prompts of a practice round and of the grading of an answer.
//
// Tested:
// - focusDataFrom picks the focus data a round sends
// - roundRequest sends the focus data, the count, the missed rules and the language, and nothing else
// - roundRequest states the generation rules and asks for two spare exercises
// - roundRequest sends the avoid list
// - avoidPrompts builds it from the run and the recent prompts
// - rotateMistakes puts the rules not practiced recently first
// - focusDataFrom and roundRequest carry a note as the focus of a note round
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

import {
  ROUND_SPARE,
  RULE_PRACTICE_AVOID,
  RULE_PRACTICE_NO_ANSWER,
  RULE_PRACTICE_PER_RULE,
  RULE_PRACTICE_ANSWERABLE,
  RULE_PRACTICE_CHOOSE,
  RULE_PRACTICE_FIX,
  RULE_PRACTICE_GAP,
  RULE_PRACTICE_GRADE,
  RULE_PRACTICE_NOTE,
  RULE_STUDY_NOTE,
  RULE_PRACTICE_KINDS,
  RULE_PRACTICE_NO_TRANSLATE,
  RULE_PRACTICE_RULE,
  RULE_PRACTICE_RULE_WORDS,
  avoidPrompts,
  focusDataFrom,
  gradeRequest,
  rotateMistakes,
  roundRequest,
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

describe("roundRequest", () => {
  const base = {
    focus: { kind: "words" as const, words: ["definitely"] },
    count: 5,
    missedRules: [] as string[],
    language: null,
    avoid: [] as string[],
  };

  it("sends the focus data and the count in one user turn", () => {
    const request = roundRequest(base);
    expect(userTurn(request)).toEqual({ focus: base.focus, count: 5 + ROUND_SPARE, avoid: [] });
  });

  it("asks for two more than the round needs", () => {
    expect(ROUND_SPARE).toBe(2);
    expect(userTurn(roundRequest({ ...base, count: 3 })).count).toBe(5);
  });

  it("states the generation rules in every round", () => {
    const requests = [
      roundRequest(base),
      roundRequest({ ...base, focus: { kind: "mistakes", corrections: [] } }),
      roundRequest({
        ...base,
        focus: {
          kind: "note",
          note: {
            kind: "table",
            title: "Future forms",
            topic: "Going to, will",
            content: {
              columns: ["Form", "When", "Example"],
              rows: [["going to", "plans", "I'm going to study."]],
              remember: "Plans use going to.",
            },
          },
        },
      }),
      roundRequest({ ...base, language: "es-AR" }),
    ];
    for (const { system } of requests) {
      expect(system).toContain(RULE_PRACTICE_ANSWERABLE);
      expect(system).toContain(RULE_PRACTICE_FIX);
      expect(system).toContain(RULE_PRACTICE_GAP);
      expect(system).toContain(RULE_PRACTICE_CHOOSE);
      expect(system).toContain(RULE_PRACTICE_NO_ANSWER);
      expect(system).toContain(RULE_PRACTICE_AVOID);
      expect(system).toContain(RULE_PRACTICE_PER_RULE);
    }
  });

  it("asks a gap to carry the base verb and not in parentheses", () => {
    expect(RULE_PRACTICE_GAP).toContain("(not / can)");
    expect(RULE_PRACTICE_GAP).toContain('"not"');
    expect(RULE_PRACTICE_ANSWERABLE).toContain("polarity");
    expect(RULE_PRACTICE_ANSWERABLE).toContain("exactly one answer");
  });

  it("asks a gap to show the base verb only for a different form and never the bare form", () => {
    expect(RULE_PRACTICE_GAP).toContain('"(go)" for "went"');
    expect(RULE_PRACTICE_GAP).toContain("bare base form");
  });

  it("asks for no answer in the prompt, no reuse of avoid and two items per rule at most", () => {
    expect(RULE_PRACTICE_NO_ANSWER).toContain("No prompt contains its accepted answer");
    expect(RULE_PRACTICE_AVOID).toContain("never reuse one of those prompts");
    expect(RULE_PRACTICE_PER_RULE).toContain("At most two exercises");
  });

  it("sends the avoid list in the user turn", () => {
    const request = roundRequest({ ...base, avoid: ["I ___ (be) there."] });
    expect(userTurn(request).avoid).toEqual(["I ___ (be) there."]);
  });

  it("sends an empty avoid on the first round of a new run", () => {
    expect(userTurn(roundRequest(base)).avoid).toEqual([]);
  });

  it("asks a fix to hold one real mistake and keep the learner's meaning", () => {
    expect(RULE_PRACTICE_FIX).toContain("never already correct");
    expect(RULE_PRACTICE_FIX).toContain("negation");
  });

  it("asks the grader to judge the visible prompt and to flag a flawed exercise", () => {
    expect(RULE_PRACTICE_GRADE).toContain("flawed");
    expect(RULE_PRACTICE_GRADE).toContain("examples");
    expect(RULE_PRACTICE_GRADE).toContain("___");
  });

  it("sends no name, goals, interests or chat text", () => {
    const request = roundRequest({
      ...base,
      focus: focusDataFrom("words", null, mistakes(0), words(2), "beginner", null, []),
    });
    const everything = `${request.system}\n${request.turns.map((turn) => turn.text).join("\n")}`;
    expect(everything).not.toContain("private sentence");
    expect(everything.toLowerCase()).not.toContain("goals");
    expect(everything.toLowerCase()).not.toContain("name");
    expect(Object.keys(userTurn(request)).sort()).toEqual(["avoid", "count", "focus"]);
  });

  it("states the rules of the four kinds and never asks for an API key", () => {
    const { system } = roundRequest(base);
    expect(system).toContain(RULE_PRACTICE_KINDS);
    expect(system).toContain(RULE_NO_KEY);
  });

  it("names the rule as the word for the words focus and as a grammar point otherwise", () => {
    expect(roundRequest(base).system).toContain(RULE_PRACTICE_RULE_WORDS);
    expect(roundRequest(base).system).not.toContain(RULE_PRACTICE_RULE);
    const mistakesRequest = roundRequest({
      ...base,
      focus: { kind: "mistakes", corrections: [] },
    });
    expect(mistakesRequest.system).toContain(RULE_PRACTICE_RULE);
    expect(mistakesRequest.system).not.toContain(RULE_PRACTICE_RULE_WORDS);
  });

  it("lists the missed rules first when there are any", () => {
    const { system } = roundRequest({ ...base, missedRules: ["Articles", "Present perfect"] });
    expect(system).toContain("Articles");
    expect(system).toContain("Present perfect");
    expect(system.indexOf("Articles")).toBeLessThan(system.indexOf(RULE_PRACTICE_KINDS));
  });

  it("does not mention missed rules when there are none", () => {
    expect(roundRequest(base).system.toLowerCase()).not.toContain("missed");
  });

  it("asks for translate in the device language", () => {
    const { system } = roundRequest({ ...base, language: "es-AR" });
    expect(system).toContain(translateRule("es-AR"));
    expect(system).toContain("es-AR");
    expect(system).not.toContain(RULE_PRACTICE_NO_TRANSLATE);
  });

  it("asks only for choose, fix and gap with no language", () => {
    const { system } = roundRequest(base);
    expect(system).toContain(RULE_PRACTICE_NO_TRANSLATE);
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

  it("sends the note's kind, title, topic and content as the focus of a note round", () => {
    const data = focusDataFrom("note", null, mistakes(0), words(0), null, draft, []);
    expect(data).toEqual({ kind: "note", note: draft });
    const request = roundRequest({
      focus: data,
      count: 5,
      missedRules: [],
      language: null,
      avoid: [],
    });
    expect(userTurn(request)).toEqual({
      focus: {
        kind: "note",
        note: {
          kind: "table",
          title: "Future forms",
          topic: "Going to, will",
          content: draft.content,
        },
      },
      count: 5 + ROUND_SPARE,
      avoid: [],
    });
  });

  it("asks a note round to practice the rules of the note", () => {
    const data = focusDataFrom("note", null, mistakes(0), words(0), null, draft, []);
    const note = roundRequest({
      focus: data,
      count: 5,
      missedRules: [],
      language: null,
      avoid: [],
    });
    expect(note.system).toContain(RULE_PRACTICE_NOTE);
    const other = roundRequest({
      focus: focusDataFrom("mistakes", null, mistakes(1), words(0), null, null, []),
      count: 5,
      missedRules: [],
      language: null,
      avoid: [],
    });
    expect(other.system).not.toContain(RULE_PRACTICE_NOTE);
  });

  it("uses the grammar rule line for a note round", () => {
    const data = focusDataFrom("note", null, mistakes(0), words(0), null, draft, []);
    const note = roundRequest({
      focus: data,
      count: 5,
      missedRules: [],
      language: null,
      avoid: [],
    });
    expect(note.system).toContain(RULE_PRACTICE_RULE);
    expect(note.system).not.toContain(RULE_PRACTICE_RULE_WORDS);
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
