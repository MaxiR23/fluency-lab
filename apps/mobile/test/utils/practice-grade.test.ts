// apps/mobile/test/utils/practice-grade.test.ts
//
// Tests for the grading of a practice answer.
//
// Tested:
// - normalizeAnswer and matchesAccepted compare answers ignoring case, spacing, quotes and final marks
// - gradeChoice and localGrade decide when no tutor call is needed
// - toAnswerGrade shapes the tutor's verdict
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/practice-grade.test.ts
//
// SEE: apps/mobile/src/utils/practice-grade.ts

import { describe, expect, it } from "@jest/globals";

import {
  gradeChoice,
  localGrade,
  matchesAccepted,
  normalizeAnswer,
  toAnswerGrade,
} from "@/utils/practice-grade";

describe("normalizeAnswer", () => {
  it("trims, lower-cases and collapses spaces", () => {
    expect(normalizeAnswer("  I   Have  Been ")).toBe("i have been");
  });

  it("turns curly quotes into straight ones", () => {
    expect(normalizeAnswer("I’ve “never” been")).toBe('i\'ve "never" been');
    expect(normalizeAnswer("‘hi’")).toBe("'hi'");
  });

  it("removes final full stops, question and exclamation marks and ellipses", () => {
    expect(normalizeAnswer("I've never been.")).toBe("i've never been");
    expect(normalizeAnswer("Have you been?")).toBe("have you been");
    expect(normalizeAnswer("Wow!")).toBe("wow");
    expect(normalizeAnswer("Well…")).toBe("well");
    expect(normalizeAnswer("Well . ")).toBe("well");
  });

  it("keeps inner punctuation", () => {
    expect(normalizeAnswer("I'm, well")).toBe("i'm, well");
  });

  it("returns an empty string for an empty answer", () => {
    expect(normalizeAnswer("  ")).toBe("");
    expect(normalizeAnswer("...")).toBe("");
  });
});

describe("matchesAccepted", () => {
  const accepted = ["I've never been to Japan.", "I have never been to Japan."];

  it("matches the same answer", () => {
    expect(matchesAccepted("I have never been to Japan.", accepted)).toBe(true);
  });

  it("matches after trimming, case and repeated spaces", () => {
    expect(matchesAccepted("  i HAVE  never been   to japan ", accepted)).toBe(true);
  });

  it("matches a curly apostrophe against a straight one", () => {
    expect(matchesAccepted("I’ve never been to Japan", accepted)).toBe(true);
  });

  it("matches without the final full stop, question or exclamation mark", () => {
    expect(matchesAccepted("I've never been to Japan", accepted)).toBe(true);
    expect(matchesAccepted("Yes!", ["Yes?"])).toBe(true);
  });

  it("does not match a different word", () => {
    expect(matchesAccepted("I never was to Japan", accepted)).toBe(false);
  });

  it("does not match an empty answer", () => {
    expect(matchesAccepted("", accepted)).toBe(false);
    expect(matchesAccepted("   ", [""])).toBe(false);
  });

  it("does not match when inner punctuation differs", () => {
    expect(matchesAccepted("Im well", ["I'm, well"])).toBe(false);
  });
});

describe("gradeChoice", () => {
  it("grades a picked option against the accepted one", () => {
    expect(gradeChoice("have been", ["have been"])).toBe(true);
    expect(gradeChoice("was", ["have been"])).toBe(false);
  });
});

describe("localGrade", () => {
  const typed = { kind: "fix" as const, accepted: ["I've never been to Japan."] };

  it("grades a typed answer that matches as right without a call", () => {
    expect(localGrade(typed, "i've never been to japan")).toBe("right");
  });

  it("asks the tutor only when no accepted answer matches", () => {
    expect(localGrade(typed, "I have never visited Japan")).toBe("ask");
  });

  it("never asks for a choose item", () => {
    expect(localGrade({ kind: "choose", accepted: ["have been"] }, "was")).toBe("miss");
    expect(localGrade({ kind: "choose", accepted: ["have been"] }, "have been")).toBe("right");
  });
});

describe("toAnswerGrade", () => {
  it("keeps the verdict and the explanation", () => {
    expect(toAnswerGrade({ correct: true, explanation: " Fine. " })).toEqual({
      correct: true,
      explanation: "Fine.",
    });
  });

  it("turns an empty explanation into null", () => {
    expect(toAnswerGrade({ correct: false, explanation: "  " })).toEqual({
      correct: false,
      explanation: null,
    });
  });

  it("cuts the explanation at 300", () => {
    expect(
      toAnswerGrade({ correct: false, explanation: "e".repeat(400) }).explanation,
    ).toHaveLength(300);
  });
});
