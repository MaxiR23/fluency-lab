// apps/api/test/summary.test.ts
//
// Tests for the session summary numbers.
//
// Tested:
// - sessionSummary counts the messages and collects the corrections and the new words
// - The new words are deduplicated the way profile_stats counts them
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec vitest run apps/api/test/summary.test.ts
//
// SEE: apps/api/src/summary.ts

import { describe, expect, it } from "vitest";
import type { Message } from "@fluency-lab/shared";
import { sessionSummary } from "../src/summary";

const stamp = "2026-01-01 10:00:00+00";

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ec1",
    sessionId: "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e6f",
    role: "user",
    text: "Hello",
    corrections: null,
    newWords: null,
    replyToId: null,
    createdAt: stamp,
    ...overrides,
  };
}

describe("sessionSummary", () => {
  it("counts every message, the learner's and the tutor's", () => {
    const messages = [message(), message({ role: "tutor" }), message()];
    expect(sessionSummary(messages).messageCount).toBe(3);
  });

  it("collects the corrections of every message in message order", () => {
    const a = { original: "a", corrected: "b", rule: "Rule A" };
    const b = { original: "c", corrected: "d", rule: "Rule B" };
    const messages = [
      message({ corrections: { items: [a], explanation: null } }),
      message({ role: "tutor" }),
      message({ corrections: { items: [b], explanation: "x" } }),
    ];
    expect(sessionSummary(messages).corrections).toEqual([a, b]);
  });

  it("keeps a correction saved without a rule as it is", () => {
    const old = { original: "a", corrected: "b" };
    const messages = [message({ corrections: { items: [old], explanation: null } })];
    expect(sessionSummary(messages).corrections).toEqual([old]);
  });

  it("collects the new words in order, without duplicates, compared trimmed and case-insensitively", () => {
    const messages = [
      message({ newWords: ["definitely", " Deadline "] }),
      message({ newWords: ["DEFINITELY", "deadline", "budget", "  "] }),
    ];
    expect(sessionSummary(messages).newWords).toEqual(["definitely", "Deadline", "budget"]);
  });

  it("keeps the first spelling of a repeated word", () => {
    const messages = [message({ newWords: ["Budget"] }), message({ newWords: ["budget"] })];
    expect(sessionSummary(messages).newWords).toEqual(["Budget"]);
  });

  it("returns zero messages, no corrections and no words for a session with no messages", () => {
    expect(sessionSummary([])).toEqual({ messageCount: 0, corrections: [], newWords: [] });
  });

  it("returns no corrections and no words when no message has any", () => {
    expect(sessionSummary([message(), message({ role: "tutor" })])).toEqual({
      messageCount: 2,
      corrections: [],
      newWords: [],
    });
  });

  it("treats a corrections object with no items as no corrections", () => {
    const messages = [message({ corrections: { items: [], explanation: null } })];
    expect(sessionSummary(messages).corrections).toEqual([]);
  });
});
