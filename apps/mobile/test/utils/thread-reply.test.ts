// apps/mobile/test/utils/thread-reply.test.ts
//
// Tests for the normalizing of a tutor reply in a thread.
//
// Tested:
// - toThreadReply trims and caps the reply, dedupes and caps the words, keeps only whole numbers from 1 in withdrawn
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/thread-reply.test.ts
//
// SEE: apps/mobile/src/utils/thread-reply.ts

import { describe, expect, it } from "@jest/globals";

import { toThreadReply } from "@/utils/thread-reply";

describe("toThreadReply", () => {
  it("keeps the reply, the words and the withdrawn numbers", () => {
    expect(toThreadReply({ reply: " Yes. ", newWords: ["laid-back"], withdrawn: [2] })).toEqual({
      reply: "Yes.",
      newWords: ["laid-back"],
      withdrawn: [2],
    });
  });

  it("returns null for an empty reply", () => {
    expect(toThreadReply({ reply: "  ", newWords: [], withdrawn: [] })).toBeNull();
  });

  it("caps the reply at 4000 characters", () => {
    const result = toThreadReply({ reply: "a".repeat(4100), newWords: [], withdrawn: [] });
    expect(result?.reply).toHaveLength(4000);
  });

  it("dedupes the words ignoring case and caps them at 60 characters and 10 words", () => {
    const words = [
      "Word",
      "word",
      "x".repeat(70),
      ...Array.from({ length: 12 }, (_, i) => `w${i}`),
    ];
    const result = toThreadReply({ reply: "ok", newWords: words, withdrawn: [] });
    expect(result?.newWords).toHaveLength(10);
    expect(result?.newWords.filter((w) => w.toLowerCase() === "word")).toEqual(["Word"]);
    expect(result?.newWords[1]).toHaveLength(60);
  });

  it("keeps only whole numbers from 1 in withdrawn, once each", () => {
    const result = toThreadReply({
      reply: "ok",
      newWords: [],
      withdrawn: [0, -1, 1.5, 2, 2, 3],
    });
    expect(result?.withdrawn).toEqual([2, 3]);
  });

  it("keeps at most 10 withdrawn numbers", () => {
    const withdrawn = Array.from({ length: 15 }, (_, i) => i + 1);
    expect(toThreadReply({ reply: "ok", newWords: [], withdrawn })?.withdrawn).toHaveLength(10);
  });

  it("keeps empty lists empty", () => {
    expect(toThreadReply({ reply: "ok", newWords: [], withdrawn: [] })).toEqual({
      reply: "ok",
      newWords: [],
      withdrawn: [],
    });
  });
});
