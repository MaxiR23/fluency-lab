// apps/mobile/test/utils/chat-context.test.ts
//
// Tests for the pure functions of a chat's summary of its older turns.
//
// Tested:
// - summaryPoint: where the summary stops, or -1 when there is no usable one
// - summaryCut and needsSummary: when a summary is due and which messages it covers
// - contextTurns and contextLine: what the tutor receives
// - toContextSummary: the summary as saved
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/chat-context.test.ts
//
// SEE: apps/mobile/src/utils/chat-context.ts

import { describe, expect, it } from "@jest/globals";

import type { ChatMessage } from "@/utils/chat-conversation";
import {
  COMPACT_AFTER,
  KEEP_RECENT,
  SUMMARY_MAX,
  contextLine,
  contextTurns,
  needsSummary,
  summaryCut,
  summaryPoint,
  toContextSummary,
} from "@/utils/chat-context";
import { tutorTurns } from "@/utils/chat-reply";

function message(i: number, extra: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `m${i}`,
    role: i % 2 === 0 ? "tutor" : "user",
    text: `text ${i}`,
    corrections: [],
    explanation: null,
    newWords: [],
    threadReplies: 0,
    replyTo: null,
    savedId: `m${i}`,
    note: null,
    ...extra,
  };
}

// INFO: the opening (tutor) and learner/tutor pairs: m0 is the opening, odd indexes are learner messages.
function chat(n: number): ChatMessage[] {
  return Array.from({ length: n }, (_, i) => message(i));
}

describe("the constants", () => {
  it("compacts after 30 messages, keeps 12 and caps the summary at 1500", () => {
    expect([COMPACT_AFTER, KEEP_RECENT, SUMMARY_MAX]).toEqual([30, 12, 1500]);
  });
});

describe("summaryPoint", () => {
  it("finds the index of the covered message by its saved id", () => {
    expect(summaryPoint(chat(20), "Summary.", "m7")).toBe(7);
  });

  it("is -1 with no summary or no point", () => {
    expect(summaryPoint(chat(20), null, null)).toBe(-1);
    expect(summaryPoint([], null, null)).toBe(-1);
  });

  it("is -1 when the point is not in the list", () => {
    expect(summaryPoint(chat(20), "Summary.", "gone")).toBe(-1);
  });

  it("is -1 with a point but no summary", () => {
    expect(summaryPoint(chat(20), null, "m7")).toBe(-1);
  });

  it("is -1 with a summary but no point", () => {
    expect(summaryPoint(chat(20), "Summary.", null)).toBe(-1);
  });
});

describe("needsSummary and summaryCut", () => {
  it("needs no summary for an empty chat", () => {
    expect(needsSummary([], null, null)).toBe(false);
    expect(summaryCut([], null, null)).toBeNull();
  });

  it("needs no summary with 29 messages after the point", () => {
    expect(needsSummary(chat(29), null, null)).toBe(false);
  });

  it("needs a summary at exactly 30 messages after the point", () => {
    expect(needsSummary(chat(30), null, null)).toBe(true);
  });

  it("needs a summary at 31 messages", () => {
    expect(needsSummary(chat(31), null, null)).toBe(true);
  });

  it("counts only the messages after the point", () => {
    expect(needsSummary(chat(45), "Summary.", "m30")).toBe(false);
    expect(needsSummary(chat(61), "Summary.", "m30")).toBe(true);
  });

  it("covers everything after the point but the latest 12 when the 12th from the end is a learner message", () => {
    const cut = summaryCut(chat(31), null, null);
    expect(cut?.covered.map((m) => m.id)).toEqual(chat(19).map((m) => m.id));
  });

  it("keeps 13 when the 12th from the end is a tutor message, so the kept tail starts with the learner", () => {
    const cut = summaryCut(chat(30), null, null);
    expect(cut?.covered).toHaveLength(17);
    expect(chat(30)[17].role).toBe("user");
  });

  it("never covers any of the latest 12 messages", () => {
    for (let n = COMPACT_AFTER; n < COMPACT_AFTER + 6; n += 1) {
      const messages = chat(n);
      const cut = summaryCut(messages, null, null);
      const kept = messages.length - (cut?.covered.length ?? 0);
      expect(kept).toBeGreaterThanOrEqual(KEEP_RECENT);
      expect(messages[messages.length - kept].role).toBe("user");
    }
  });

  it("names the saved id of the last covered message as the new point", () => {
    expect(summaryCut(chat(31), null, null)?.throughId).toBe("m18");
  });

  it("needs no summary while the last covered message is unsaved", () => {
    const messages = chat(31);
    messages[18] = message(18, { savedId: null });
    expect(needsSummary(messages, null, null)).toBe(false);
  });

  it("counts from the first message when the point is not in the list", () => {
    expect(needsSummary(chat(30), "Summary.", "gone")).toBe(true);
    expect(needsSummary(chat(29), "Summary.", "gone")).toBe(false);
  });

  it("starts the covered messages right after the point", () => {
    const cut = summaryCut(chat(61), "Summary.", "m10");
    expect(cut?.covered[0].id).toBe("m11");
  });
});

describe("contextLine", () => {
  it("prefixes the summary with Earlier in this chat", () => {
    expect(contextLine("Lives in Lisbon.")).toBe("Earlier in this chat: Lives in Lisbon.");
  });
});

describe("contextTurns", () => {
  it("sends the whole history and no addition with no summary", () => {
    const messages = chat(5);
    expect(contextTurns(messages, null, null, "Hi", null)).toEqual({
      addition: null,
      turns: tutorTurns(messages, "Hi", null),
    });
  });

  it("sends the summary line and only the messages after the point, then the pending turn", () => {
    const result = contextTurns(chat(10), "Lives in Lisbon.", "m6", "Hi", null);
    expect(result.addition).toBe("Earlier in this chat: Lives in Lisbon.");
    expect(result.turns.map((t) => t.text)).toEqual(["text 7", "text 8", "text 9", "Hi"]);
  });

  it("sends the messages after the point word for word", () => {
    const messages = chat(14);
    const result = contextTurns(messages, "S.", "m1", "Hi", null);
    expect(result.turns.slice(0, -1)).toEqual(
      messages.slice(2).map((m) => ({ role: m.role, text: m.text })),
    );
  });

  it("keeps the quoted text of a reply to a message before the point", () => {
    const messages = chat(8);
    messages[5] = message(5, { replyTo: "m2" });
    const result = contextTurns(messages, "S.", "m4", "Hi", null);
    expect(result.turns[0]).toEqual({ role: "user", text: "> text 2\n\ntext 5" });
  });

  it("keeps the quoted text of a pending reply to a message before the point", () => {
    const result = contextTurns(chat(8), "S.", "m4", "Hi", "m2");
    expect(result.turns.at(-1)).toEqual({ role: "user", text: "> text 2\n\nHi" });
  });

  it("ignores a summary whose point is not in the list and sends the whole history", () => {
    const messages = chat(4);
    expect(contextTurns(messages, "S.", "gone", "Hi", null)).toEqual({
      addition: null,
      turns: tutorTurns(messages, "Hi", null),
    });
  });

  it("sends only the pending turn when the point is the last message", () => {
    expect(contextTurns(chat(4), "S.", "m3", "Hi", null)).toEqual({
      addition: "Earlier in this chat: S.",
      turns: [{ role: "user", text: "Hi" }],
    });
  });
});

describe("toContextSummary", () => {
  it("trims the summary", () => {
    expect(toContextSummary("  Lives in Lisbon.  ")).toBe("Lives in Lisbon.");
  });

  it("is null for an empty or blank summary", () => {
    expect(toContextSummary("")).toBeNull();
    expect(toContextSummary("  \n ")).toBeNull();
  });

  it("keeps a summary of exactly 1500 characters", () => {
    expect(toContextSummary("a".repeat(1500))).toBe("a".repeat(1500));
  });

  it("is null for 1501 characters", () => {
    expect(toContextSummary("a".repeat(1501))).toBeNull();
  });

  it("measures the length after trimming", () => {
    expect(toContextSummary(` ${"a".repeat(1500)} `)).toBe("a".repeat(1500));
  });
});
