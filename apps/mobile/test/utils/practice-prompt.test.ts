// apps/mobile/test/utils/practice-prompt.test.ts
//
// Tests for the prompts of a practice round and of the grading of an answer.
//
// Tested:
// - focusDataFrom picks the focus data a round sends
// - roundRequest sends the focus data, the count, the missed rules and the language, and nothing else
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
  RULE_PRACTICE_GRADE,
  RULE_PRACTICE_KINDS,
  RULE_PRACTICE_NO_TRANSLATE,
  RULE_PRACTICE_RULE,
  RULE_PRACTICE_RULE_WORDS,
  focusDataFrom,
  gradeRequest,
  roundRequest,
  translateRule,
} from "@/utils/practice-prompt";
import { RULE_NO_KEY } from "@/utils/tutor-prompt";

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
    expect(focusDataFrom("mistakes", null, mistakes(2), words(0), "intermediate")).toEqual({
      kind: "mistakes",
      corrections: [
        { original: "bad 0", corrected: "good 0", rule: null },
        { original: "bad 1", corrected: "good 1", rule: "Rule 1" },
      ],
    });
  });

  it("sends at most ten mistake groups and fifteen words", () => {
    const data = focusDataFrom("mistakes", null, mistakes(14), words(20), null);
    expect(data.kind === "mistakes" && data.corrections).toHaveLength(10);
    const wordData = focusDataFrom("words", null, mistakes(0), words(20), null);
    expect(wordData.kind === "words" && wordData.words).toHaveLength(15);
  });

  it("sends only the words for the words focus", () => {
    expect(focusDataFrom("words", null, mistakes(3), words(2), null)).toEqual({
      kind: "words",
      words: ["word0", "word1"],
    });
  });

  it("sends the topic and the level for a topic", () => {
    expect(focusDataFrom("topic", "conditionals", mistakes(0), words(0), "advanced")).toEqual({
      kind: "topic",
      topic: "Conditionals",
      level: "advanced",
    });
  });

  it("sends a null level when none is set", () => {
    expect(focusDataFrom("topic", "articles", mistakes(0), words(0), null)).toEqual({
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
  };

  it("sends the focus data and the count in one user turn", () => {
    const request = roundRequest(base);
    expect(userTurn(request)).toEqual({ focus: base.focus, count: 5 });
  });

  it("asks for the given count", () => {
    expect(userTurn(roundRequest({ ...base, count: 3 })).count).toBe(3);
  });

  it("sends no name, goals, interests or chat text", () => {
    const request = roundRequest({
      ...base,
      focus: focusDataFrom("words", null, mistakes(0), words(2), "beginner"),
    });
    const everything = `${request.system}\n${request.turns.map((turn) => turn.text).join("\n")}`;
    expect(everything).not.toContain("private sentence");
    expect(everything.toLowerCase()).not.toContain("goals");
    expect(everything.toLowerCase()).not.toContain("name");
    expect(Object.keys(userTurn(request)).sort()).toEqual(["count", "focus"]);
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
