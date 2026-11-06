// apps/mobile/test/utils/thread-prompt.test.ts
//
// Tests for the prompt and the turns of a correction thread.
//
// Tested:
// - threadPrompt quotes the learner's sentence, numbers the corrections from 1 with their rules and holds the explanation
// - A withdrawn correction is marked, a missing rule or explanation leaves its part out, an unset level has its own line
// - threadPrompt takes no chat text beyond the sentence and its corrections
// - threadTurns turns the thread and the new question into turns in order
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/thread-prompt.test.ts
//
// SEE: apps/mobile/src/utils/thread-prompt.ts

import { describe, expect, it } from "@jest/globals";

import {
  RULE_THREAD,
  RULE_THREAD_DECLINE,
  RULE_WITHDRAW,
  THREAD_OUTPUT_GUIDE,
  threadPrompt,
  threadTurns,
} from "@/utils/thread-prompt";
import { RULE_NO_KEY, RULE_OTHER_LANGUAGE } from "@/utils/tutor-prompt";

const input = {
  level: "intermediate" as const,
  sentence: "I never been to Japan, but I want to go the next year.",
  corrections: [
    { original: "the next year", corrected: "next year", rule: "Articles with years" },
    { original: "I never been", corrected: "I've never been" },
  ],
  explanation: "No article before next year; use the present perfect.",
};

describe("threadPrompt", () => {
  it("holds the sentence, the numbered corrections with their rules and the explanation", () => {
    const prompt = threadPrompt(input);
    expect(prompt).toContain(`"${input.sentence}"`);
    expect(prompt).toContain('1. "the next year" → "next year" (Articles with years)');
    expect(prompt).toContain('2. "I never been" → "I\'ve never been"');
    expect(prompt).toContain(input.explanation);
  });

  it("holds the thread rules, the withdraw rule, the language rules and the output guide", () => {
    const prompt = threadPrompt(input);
    for (const part of [
      RULE_THREAD,
      RULE_THREAD_DECLINE,
      RULE_WITHDRAW,
      RULE_OTHER_LANGUAGE,
      RULE_NO_KEY,
      THREAD_OUTPUT_GUIDE,
    ]) {
      expect(prompt).toContain(part);
    }
    expect(RULE_THREAD).toContain("Answer in English");
  });

  it("marks a withdrawn correction", () => {
    const prompt = threadPrompt({
      ...input,
      corrections: [{ ...input.corrections[0], withdrawn: true }, input.corrections[1]],
    });
    expect(prompt).toContain('1. "the next year" → "next year" (Articles with years) (withdrawn)');
    expect(prompt).not.toContain('2. "I never been" → "I\'ve never been" (withdrawn)');
  });

  it("leaves out the parentheses of a missing rule and the line of a missing explanation", () => {
    const prompt = threadPrompt({ ...input, explanation: null });
    expect(prompt).toContain('2. "I never been" → "I\'ve never been"\n');
    expect(prompt).not.toContain("Your explanation");
  });

  it("uses the unset level line when the level is null", () => {
    expect(threadPrompt({ ...input, level: null })).toContain("level is not set");
    expect(threadPrompt(input)).toContain("intermediate");
  });

  it("takes only the level, the sentence, the corrections and the explanation", () => {
    expect(Object.keys(input).sort()).toEqual(["corrections", "explanation", "level", "sentence"]);
    const prompt = threadPrompt(input);
    expect(prompt).not.toContain("goals");
    expect(prompt).not.toContain("Today's topic");
    expect(prompt).not.toContain("name is");
  });
});

describe("threadTurns", () => {
  it("turns the thread rows in order, then the new question", () => {
    expect(
      threadTurns(
        [
          { role: "user", text: "Why?" },
          { role: "tutor", text: "Because." },
        ],
        "And now?",
      ),
    ).toEqual([
      { role: "user", text: "Why?" },
      { role: "tutor", text: "Because." },
      { role: "user", text: "And now?" },
    ]);
  });

  it("sends only the question for an empty thread", () => {
    expect(threadTurns([], "Why is it wrong?")).toEqual([
      { role: "user", text: "Why is it wrong?" },
    ]);
  });
});
