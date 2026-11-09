// apps/mobile/test/utils/chat-opening.test.ts
//
// Tests for where a chat comes from and how it opens.
//
// Tested:
// - chatOrigin reads the route params
// - freeChatGreeting greets with or without a name
// - chatOrigin reads a topic, and topicGreeting greets by topic
// - promptTopic gives the topic title for the prompt, null for a free chat, and ignores a title the tutor or the owner wrote, keeping a goal starter's title by its opener
// - openingOf reads the opening line of a saved conversation
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/chat-opening.test.ts
//
// SEE: apps/mobile/src/utils/chat-opening.ts

import { describe, expect, it } from "@jest/globals";
import { STARTERS, starterById, type Message, type Session } from "@fluency-lab/shared";

import {
  chatOrigin,
  freeChatGreeting,
  openingOf,
  promptTopic,
  topicGreeting,
} from "@/utils/chat-opening";

const starter = STARTERS[0];

function sessionWith(overrides: Partial<Session>): Session {
  return {
    id: "s1",
    topicId: null,
    title: "Free chat",
    status: "active",
    summary: null,
    contextSummary: null,
    contextThroughId: null,
    titleSource: "default",
    costUsd: 0,
    createdAt: "2026-11-05T09:00:00Z",
    updatedAt: "2026-11-05T09:00:00Z",
    ...overrides,
  };
}

function messageWith(role: Message["role"], text: string): Message {
  return {
    id: text,
    sessionId: "s1",
    role,
    text,
    corrections: null,
    newWords: null,
    replyToId: null,
    noteId: null,
    createdAt: "2026-11-05T09:00:00Z",
  };
}

describe("chatOrigin", () => {
  it("is free with no params", () => {
    expect(chatOrigin({})).toEqual({ kind: "free" });
  });

  it("is a starter for a known starter id", () => {
    expect(chatOrigin({ starter: starter.id })).toEqual({ kind: "starter", starter });
  });

  it("falls back to free for an unknown starter", () => {
    expect(chatOrigin({ starter: "nope" })).toEqual({ kind: "free" });
  });

  it("is a resume for a session id, and the session wins over a starter", () => {
    expect(chatOrigin({ session: "s1" })).toEqual({ kind: "resume", sessionId: "s1" });
    expect(chatOrigin({ session: "s1", starter: starter.id })).toEqual({
      kind: "resume",
      sessionId: "s1",
    });
  });

  it("uses the first item of an array param", () => {
    expect(chatOrigin({ starter: [starter.id, "x"] })).toEqual({ kind: "starter", starter });
    expect(chatOrigin({ session: ["s1", "s2"] })).toEqual({ kind: "resume", sessionId: "s1" });
  });

  it("ignores an empty session param", () => {
    expect(chatOrigin({ session: "" })).toEqual({ kind: "free" });
    expect(chatOrigin({ session: [] })).toEqual({ kind: "free" });
  });

  it("reads a known topic as a topic chat", () => {
    expect(chatOrigin({ topic: "job_interviews" })).toEqual({
      kind: "topic",
      topicId: "job_interviews",
    });
    expect(chatOrigin({ topic: ["travel", "food"] })).toEqual({ kind: "topic", topicId: "travel" });
  });

  it("reads an unknown or empty topic as a free chat", () => {
    expect(chatOrigin({ topic: "nope" })).toEqual({ kind: "free" });
    expect(chatOrigin({ topic: "" })).toEqual({ kind: "free" });
    expect(chatOrigin({ topic: [] })).toEqual({ kind: "free" });
  });

  it("lets a session or a starter win over a topic", () => {
    expect(chatOrigin({ session: "s1", topic: "travel" })).toEqual({
      kind: "resume",
      sessionId: "s1",
    });
    expect(chatOrigin({ starter: starter.id, topic: "travel" })).toEqual({
      kind: "starter",
      starter,
    });
  });

  it("finds the starter with starterById", () => {
    expect(starterById(starter.id)).toBe(starter);
  });
});

describe("freeChatGreeting", () => {
  it("greets by name", () => {
    expect(freeChatGreeting("Ada")).toBe("Hi Ada! What would you like to talk about today?");
  });

  it("greets without a name", () => {
    expect(freeChatGreeting(null)).toBe("Hi! What would you like to talk about today?");
  });

  it("greets without a blank name and trims a name", () => {
    expect(freeChatGreeting("   ")).toBe("Hi! What would you like to talk about today?");
    expect(freeChatGreeting(" Ada ")).toBe("Hi Ada! What would you like to talk about today?");
  });
});

describe("topicGreeting", () => {
  it("greets a topic chat by name and topic", () => {
    expect(topicGreeting(" Ada ", "job_interviews")).toBe(
      "Hi Ada! Today's topic: Job interviews. What would you like to talk about?",
    );
  });

  it("greets a topic chat without a name", () => {
    expect(topicGreeting(null, "travel")).toBe(
      "Hi! Today's topic: Travel. What would you like to talk about?",
    );
    expect(topicGreeting("  ", "travel")).toBe(topicGreeting(null, "travel"));
  });
});

describe("promptTopic", () => {
  it("is null for a free chat", () => {
    expect(promptTopic(sessionWith({}), null)).toBeNull();
  });

  it("is the title of a topic session", () => {
    expect(promptTopic(sessionWith({ topicId: "food", title: "Food" }), null)).toBe("Food");
  });

  it("is the title of a goal starter session (no topic, a starter title)", () => {
    expect(promptTopic(sessionWith({ topicId: null, title: "Your next interview" }), null)).toBe(
      "Your next interview",
    );
  });
});

describe("promptTopic with a written title", () => {
  it("gives no topic for a free chat with an automatic or a user title", () => {
    for (const titleSource of ["auto", "user"] as const) {
      expect(
        promptTopic(
          sessionWith({ topicId: null, title: "Ramen spots in Tokyo", titleSource }),
          null,
        ),
      ).toBeNull();
    }
  });

  it("gives the topic label for a topic chat with a written title", () => {
    expect(
      promptTopic(
        sessionWith({ topicId: "food", title: "My grandma's soup", titleSource: "user" }),
        null,
      ),
    ).toBe("Food");
  });
});

describe("promptTopic for a goal starter with a written title", () => {
  it("keeps the starter title, found by its opener, for an automatic or a user title", () => {
    for (const titleSource of ["auto", "user"] as const) {
      expect(
        promptTopic(
          sessionWith({ topicId: null, title: "Ramen spots in Tokyo", titleSource }),
          starter.opener,
        ),
      ).toBe(starter.title);
    }
  });

  it("gives no topic when the opening is not a starter's", () => {
    expect(
      promptTopic(
        sessionWith({ topicId: null, title: "Ramen", titleSource: "auto" }),
        "Hi! What would you like to talk about today?",
      ),
    ).toBeNull();
  });
});

describe("openingOf", () => {
  it("is null for no messages", () => {
    expect(openingOf([])).toBeNull();
  });

  it("is null when the first message is the user's", () => {
    expect(openingOf([messageWith("user", "Hi"), messageWith("tutor", "Hello")])).toBeNull();
  });

  it("is the text of a first tutor message", () => {
    expect(openingOf([messageWith("tutor", "Opening"), messageWith("user", "Hi")])).toBe("Opening");
  });
});
