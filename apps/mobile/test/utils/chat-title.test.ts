// apps/mobile/test/utils/chat-title.test.ts
//
// Tests for the automatic title of a chat.
//
// Tested:
// - toChatTitle cleans the tutor's title and drops one that is empty, over six words or over 60 characters
// - wantsTitle asks for a title only while the session has its default title and the learner has written
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/chat-title.test.ts
//
// SEE: apps/mobile/src/utils/chat-title.ts

import { describe, expect, it } from "@jest/globals";
import type { Session } from "@fluency-lab/shared";

import type { ChatMessage } from "@/utils/chat-conversation";
import { toChatTitle, wantsTitle } from "@/utils/chat-title";

describe("toChatTitle", () => {
  it("keeps a title of up to six words", () => {
    expect(toChatTitle("Ramen spots in Tokyo")).toBe("Ramen spots in Tokyo");
  });

  it("collapses whitespace and trims", () => {
    expect(toChatTitle("  Ramen \n  spots\tin Tokyo  ")).toBe("Ramen spots in Tokyo");
  });

  it("removes wrapping quotes and a final period", () => {
    expect(toChatTitle('"Ramen spots in Tokyo."')).toBe("Ramen spots in Tokyo");
    expect(toChatTitle("“Ramen spots in Tokyo”")).toBe("Ramen spots in Tokyo");
    expect(toChatTitle("Ramen spots in Tokyo.")).toBe("Ramen spots in Tokyo");
  });

  it("returns null for an empty or blank title", () => {
    expect(toChatTitle("")).toBeNull();
    expect(toChatTitle("   \n ")).toBeNull();
  });

  it("returns null for a title of only quotes and a period", () => {
    expect(toChatTitle('"."')).toBeNull();
    expect(toChatTitle('""')).toBeNull();
    expect(toChatTitle(".")).toBeNull();
  });

  it("keeps exactly six words", () => {
    expect(toChatTitle("one two three four five six")).toBe("one two three four five six");
  });

  it("returns null for seven words", () => {
    expect(toChatTitle("one two three four five six seven")).toBeNull();
  });

  it("keeps exactly 60 characters", () => {
    const title = "a".repeat(60);
    expect(toChatTitle(title)).toBe(title);
  });

  it("returns null for 61 characters", () => {
    expect(toChatTitle("a".repeat(61))).toBeNull();
  });
});

function sessionWith(titleSource: Session["titleSource"]): Session {
  return {
    id: "s1",
    topicId: null,
    title: "Free chat",
    status: "active",
    summary: null,
    contextSummary: null,
    contextThroughId: null,
    titleSource,
    costUsd: 0,
    createdAt: "2026-11-05T09:00:00Z",
    updatedAt: "2026-11-05T09:00:00Z",
  };
}

function messageWith(role: ChatMessage["role"]): ChatMessage {
  return {
    id: `${role}-1`,
    role,
    text: "Hello",
    corrections: [],
    explanation: null,
    newWords: [],
    threadReplies: 0,
    replyTo: null,
    savedId: null,
    note: null,
  };
}

describe("wantsTitle", () => {
  it("wants a title for a default session with a learner message", () => {
    expect(wantsTitle(sessionWith("default"), [messageWith("user")], null)).toBe(true);
  });

  it("wants none without a session", () => {
    expect(wantsTitle(null, [messageWith("user")], "Hi")).toBe(false);
  });

  it("wants none with no learner message and no pending text", () => {
    expect(wantsTitle(sessionWith("default"), [messageWith("tutor")], null)).toBe(false);
    expect(wantsTitle(sessionWith("default"), [], "   ")).toBe(false);
  });

  it("wants none once the title is auto", () => {
    expect(wantsTitle(sessionWith("auto"), [messageWith("user")], null)).toBe(false);
  });

  it("wants none once the title is the user's", () => {
    expect(wantsTitle(sessionWith("user"), [messageWith("user")], null)).toBe(false);
  });

  it("wants one when the only learner text is the pending one", () => {
    expect(wantsTitle(sessionWith("default"), [messageWith("tutor")], "I like ramen")).toBe(true);
  });
});
