// apps/mobile/test/utils/chat-items.test.ts
//
// Tests for the chat item helpers.
//
// Tested:
// - correctionsLabel
// - chatItems builds the list of the conversation: bubbles, corrections, new words, typing
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/chat-items.test.ts
//
// SEE: apps/mobile/src/utils/chat-items.ts

import { describe, expect, it } from "@jest/globals";

import { STARTERS, type Profile } from "@fluency-lab/shared";

import {
  conversationReducer,
  startConversation,
  type Conversation,
  type ChatMessage,
} from "@/utils/chat-conversation";
import { chatItems, correctionsLabel } from "@/utils/chat-items";

const profile: Profile = {
  id: "user-1",
  displayName: "Ada",
  level: null,
  goals: [],
  topics: [],
  provider: "claude",
  monthlyLimitUsd: null,
  onboardingCompletedAt: null,
  createdAt: "2026-11-05T09:00:00Z",
  updatedAt: "2026-11-05T09:00:00Z",
};

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    ...startConversation({
      origin: { kind: "starter", starter: STARTERS[0] },
      profile,
      spentUsd: 0,
    }),
    ...overrides,
  };
}

const designUser: ChatMessage = {
  id: "u1",
  role: "user",
  text: "I never been to Japan, but I want to go the next year.",
  corrections: [
    { original: "the next year", corrected: "next year" },
    { original: "I never been", corrected: "I've never been" },
  ],
  explanation: "No article before next year; use the present perfect.",
  newWords: ["definitely"],
};

describe("correctionsLabel", () => {
  it("is null for no corrections", () => {
    expect(correctionsLabel(0)).toBeNull();
  });

  it("is singular for one correction", () => {
    expect(correctionsLabel(1)).toBe("1 correction");
  });

  it("is plural for two corrections", () => {
    expect(correctionsLabel(2)).toBe("2 corrections");
  });
});

describe("chatItems", () => {
  it("is empty for a conversation with no messages", () => {
    expect(chatItems(conversation({ messages: [] }))).toEqual([]);
  });

  it("draws the opening as a tutor item", () => {
    expect(chatItems(conversation())).toEqual([
      { kind: "tutor", id: "opening", text: STARTERS[0].opener },
    ]);
  });

  it("gives the design's sample the design's order: bubble, corrections, new word, tutor", () => {
    const tutor: ChatMessage = {
      id: "t2",
      role: "tutor",
      text: "Japan is great! When would you go?",
      corrections: [],
      explanation: null,
      newWords: [],
    };
    const items = chatItems(conversation({ messages: [designUser, tutor] }));

    expect(items).toEqual([
      {
        kind: "user",
        id: "u1",
        text: designUser.text,
        corrections: designUser.corrections,
        explanation: designUser.explanation,
      },
      { kind: "new_word", id: "u1:word:0", word: "definitely" },
      { kind: "tutor", id: "t2", text: tutor.text },
    ]);
  });

  it("draws a user message with no corrections and no new words", () => {
    const plain: ChatMessage = {
      ...designUser,
      corrections: [],
      explanation: null,
      newWords: [],
    };
    expect(chatItems(conversation({ messages: [plain] }))).toEqual([
      { kind: "user", id: "u1", text: plain.text, corrections: [], explanation: null },
    ]);
  });

  it("draws one row per new word", () => {
    const items = chatItems(
      conversation({ messages: [{ ...designUser, newWords: ["one", "two"] }] }),
    );
    expect(items.map((item) => item.id)).toEqual(["u1", "u1:word:0", "u1:word:1"]);
  });

  it("draws the pending text as a user item and the typing indicator while asking", () => {
    const sent = conversationReducer(conversation(), { type: "draft_changed", text: "Hello" });
    const asking = conversationReducer(sent, { type: "send_started" });

    const items = chatItems(asking);

    expect(items.slice(-2)).toEqual([
      { kind: "user", id: "pending", text: "Hello", corrections: [], explanation: null },
      { kind: "typing", id: "typing" },
    ]);
  });

  it("draws no typing indicator when idle", () => {
    expect(chatItems(conversation()).some((item) => item.kind === "typing")).toBe(false);
  });

  it("gives every item a unique id", () => {
    const items = chatItems(
      conversation({
        messages: [designUser, { ...designUser, id: "u2", newWords: ["a", "b"] }],
        pending: "x",
        phase: "asking",
      }),
    );
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
