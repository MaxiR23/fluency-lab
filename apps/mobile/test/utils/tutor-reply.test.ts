// apps/mobile/test/utils/tutor-reply.test.ts
//
// Tests for the normalization of the tutor's structured reply.
//
// Tested:
// - toTutorReply trims, filters and caps the reply so it passes messageCreateSchema
// - toTutorReply keeps a correction's rule trimmed and capped, and drops a blank one
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/tutor-reply.test.ts
//
// SEE: apps/mobile/src/utils/tutor-reply.ts

import { describe, expect, it } from "@jest/globals";

import { toTutorReply } from "@/utils/tutor-reply";

const base = { reply: "Nice!", corrections: [], explanation: "", newWords: [] };

describe("toTutorReply", () => {
  it("keeps a normal reply", () => {
    expect(
      toTutorReply({
        reply: " Nice! ",
        corrections: [{ original: " I never been ", corrected: "I've never been" }],
        explanation: " Use the present perfect. ",
        newWords: [" definitely "],
      }),
    ).toEqual({
      reply: "Nice!",
      corrections: [{ original: "I never been", corrected: "I've never been" }],
      explanation: "Use the present perfect.",
      newWords: ["definitely"],
    });
  });

  it("keeps each correction's rule, trimmed", () => {
    const result = toTutorReply({
      ...base,
      corrections: [{ original: "a", corrected: "b", rule: "  Articles with years " }],
    });
    expect(result?.corrections).toEqual([
      { original: "a", corrected: "b", rule: "Articles with years" },
    ]);
  });

  it("drops a blank rule and keeps the correction", () => {
    const result = toTutorReply({
      ...base,
      corrections: [{ original: "a", corrected: "b", rule: "   " }],
    });
    expect(result?.corrections).toEqual([{ original: "a", corrected: "b" }]);
  });

  it("keeps a correction that comes without a rule", () => {
    const result = toTutorReply({ ...base, corrections: [{ original: "a", corrected: "b" }] });
    expect(result?.corrections).toEqual([{ original: "a", corrected: "b" }]);
  });

  it("caps a rule at 80 characters", () => {
    const rule = (n: number) => ({ original: "a", corrected: "b", rule: "r".repeat(n) });
    expect(toTutorReply({ ...base, corrections: [rule(80)] })?.corrections[0].rule).toHaveLength(
      80,
    );
    expect(toTutorReply({ ...base, corrections: [rule(81)] })?.corrections[0].rule).toHaveLength(
      80,
    );
  });

  it("caps the reply at 4000 characters", () => {
    expect(toTutorReply({ ...base, reply: "r".repeat(4001) })?.reply).toHaveLength(4000);
  });

  it("keeps a reply with no corrections and no words", () => {
    expect(toTutorReply(base)).toEqual({
      reply: "Nice!",
      corrections: [],
      explanation: null,
      newWords: [],
    });
  });

  it("rejects an empty reply", () => {
    expect(toTutorReply({ ...base, reply: "   " })).toBeNull();
  });

  it("drops a correction that changes nothing or has an empty side", () => {
    const result = toTutorReply({
      ...base,
      corrections: [
        { original: "same", corrected: " same " },
        { original: "", corrected: "x" },
        { original: "x", corrected: " " },
        { original: "a", corrected: "b" },
      ],
      explanation: "Because.",
    });
    expect(result?.corrections).toEqual([{ original: "a", corrected: "b" }]);
  });

  it("caps corrections at 10", () => {
    const corrections = Array.from({ length: 11 }, (_, n) => ({
      original: `a${n}`,
      corrected: `b${n}`,
    }));
    expect(toTutorReply({ ...base, corrections, explanation: "x" })?.corrections).toHaveLength(10);
  });

  it("caps a side at 300 characters", () => {
    const result = toTutorReply({
      ...base,
      corrections: [{ original: "a".repeat(301), corrected: "b".repeat(301) }],
      explanation: "x",
    });
    expect(result?.corrections[0].original).toHaveLength(300);
    expect(result?.corrections[0].corrected).toHaveLength(300);
  });

  it("removes duplicate words, case-insensitively, and empty ones", () => {
    expect(toTutorReply({ ...base, newWords: ["Hello", "hello", " ", "world"] })?.newWords).toEqual(
      ["Hello", "world"],
    );
  });

  it("caps words at 10 of 60 characters", () => {
    const words = Array.from(
      { length: 12 },
      (_, n) => `${String(n).padStart(2, "0")}${"w".repeat(70)}`,
    );
    const result = toTutorReply({ ...base, newWords: words });
    expect(result?.newWords).toHaveLength(10);
    expect(result?.newWords[0]).toHaveLength(60);
  });

  it("clears an explanation when there are no corrections", () => {
    expect(toTutorReply({ ...base, explanation: "Because." })?.explanation).toBeNull();
  });

  it("clears an empty explanation and caps a long one at 300", () => {
    const corrections = [{ original: "a", corrected: "b" }];
    expect(toTutorReply({ ...base, corrections, explanation: " " })?.explanation).toBeNull();
    expect(
      toTutorReply({ ...base, corrections, explanation: "e".repeat(301) })?.explanation,
    ).toHaveLength(300);
  });
});
