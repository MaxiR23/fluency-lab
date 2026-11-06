// apps/mobile/test/utils/chat-reply.test.ts
//
// Tests for the pure functions of a reply to a tutor message.
//
// Tested:
// - tutorName and replyingLabel
// - quotedText, quoteFor and replyPreview: what the preview and the quote draw
// - replyTargetId: the saved id the message write needs
// - learnerTurn and tutorTurns: the quote as the model receives it
// - quoteScrollY: where the list scrolls when a quote is tapped
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/chat-reply.test.ts
//
// SEE: apps/mobile/src/utils/chat-reply.ts

import { describe, expect, it } from "@jest/globals";

import type { ChatMessage, Conversation } from "@/utils/chat-conversation";
import {
  learnerTurn,
  quoteFor,
  quoteScrollY,
  quotedText,
  replyPreview,
  replyTargetId,
  replyingLabel,
  tutorName,
  tutorTurns,
} from "@/utils/chat-reply";

function chatMessage(
  id: string,
  role: ChatMessage["role"],
  text: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id,
    role,
    text,
    corrections: [],
    explanation: null,
    newWords: [],
    threadReplies: 0,
    replyTo: null,
    savedId: null,
    ...extra,
  };
}

const messages: ChatMessage[] = [
  chatMessage("opening", "tutor", "Hi! What did you do today?", { savedId: "db-1" }),
  chatMessage("message-1", "user", "I went to the park."),
  chatMessage("message-2", "tutor", "Nice!\nWas it sunny?"),
];

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  const base: Conversation = {
    origin: { kind: "free" },
    session: null,
    title: "Free chat",
    topicTitle: null,
    learner: { displayName: null, level: null, goals: [], topics: [] },
    opening: null,
    messages,
    draft: "",
    pending: null,
    replyTo: null,
    pendingReplyTo: null,
    phase: "idle",
    writes: [],
    failure: null,
    endFailed: false,
    provider: "claude",
    limitUsd: null,
    spentUsd: 0,
  };
  return { ...base, ...overrides };
}

describe("tutorName", () => {
  it("names Claude for the claude provider", () => {
    expect(tutorName("claude")).toBe("Claude");
  });

  it("names OpenAI for the openai provider", () => {
    expect(tutorName("openai")).toBe("OpenAI");
  });

  it("falls back to Tutor with no provider", () => {
    expect(tutorName(null)).toBe("Tutor");
  });
});

describe("replyingLabel", () => {
  it("reads Replying to and the tutor's name", () => {
    expect(replyingLabel("Claude")).toBe("Replying to Claude");
  });

  it("keeps a name with spaces as is", () => {
    expect(replyingLabel("My Tutor")).toBe("Replying to My Tutor");
  });
});

describe("quotedText", () => {
  it("returns the text of a tutor message", () => {
    expect(quotedText(messages, "message-2")).toBe("Nice!\nWas it sunny?");
  });

  it("returns null for no id", () => {
    expect(quotedText(messages, null)).toBeNull();
  });

  it("returns null for a learner message", () => {
    expect(quotedText(messages, "message-1")).toBeNull();
  });

  it("returns null for an id that is not in the chat", () => {
    expect(quotedText(messages, "nope")).toBeNull();
  });
});

describe("quoteFor", () => {
  it("builds the quote with the target id, the tutor's name and the text", () => {
    expect(quoteFor(conversation(), "opening")).toEqual({
      targetId: "opening",
      author: "Claude",
      text: "Hi! What did you do today?",
    });
  });

  it("returns null with no reply", () => {
    expect(quoteFor(conversation(), null)).toBeNull();
  });

  it("returns null when the original is missing", () => {
    expect(quoteFor(conversation(), "gone")).toBeNull();
  });
});

describe("replyPreview", () => {
  it("previews the draft's reply", () => {
    expect(replyPreview(conversation({ replyTo: "message-2" }))).toEqual({
      label: "Replying to Claude",
      text: "Nice!\nWas it sunny?",
    });
  });

  it("returns null with no reply pending", () => {
    expect(replyPreview(conversation())).toBeNull();
  });

  it("returns null when the reply points to a learner message", () => {
    expect(replyPreview(conversation({ replyTo: "message-1" }))).toBeNull();
  });

  it("names the tutor Tutor with no provider", () => {
    expect(replyPreview(conversation({ replyTo: "opening", provider: null }))?.label).toBe(
      "Replying to Tutor",
    );
  });
});

describe("replyTargetId", () => {
  it("returns the saved id of the quoted message", () => {
    const saved = [chatMessage("message-2", "tutor", "Hi", { savedId: "db-9" })];
    expect(replyTargetId(saved, "message-2")).toBe("db-9");
  });

  it("returns null with no reply", () => {
    expect(replyTargetId(messages, null)).toBeNull();
  });

  it("returns null while the quoted message is not saved yet", () => {
    expect(replyTargetId(messages, "message-2")).toBeNull();
  });

  it("returns the server id of a resumed message", () => {
    expect(replyTargetId(messages, "opening")).toBe("db-1");
  });

  it("returns null for an id that is not in the chat", () => {
    expect(replyTargetId(messages, "gone")).toBeNull();
  });
});

describe("learnerTurn", () => {
  it("puts the quote as > lines, then a blank line, then the text", () => {
    expect(learnerTurn("Yes, it was.", "Was it sunny?")).toBe("> Was it sunny?\n\nYes, it was.");
  });

  it("returns the text alone with no quote", () => {
    expect(learnerTurn("Hello", null)).toBe("Hello");
  });

  it("quotes every line of a multi-line message", () => {
    expect(learnerTurn("Yes", "Nice!\nWas it sunny?")).toBe("> Nice!\n> Was it sunny?\n\nYes");
  });

  it("treats a blank quote as none", () => {
    expect(learnerTurn("Yes", "  \n ")).toBe("Yes");
  });
});

describe("tutorTurns", () => {
  it("builds the history and the pending turn", () => {
    expect(tutorTurns(messages, "Yes", null)).toEqual([
      { role: "tutor", text: "Hi! What did you do today?" },
      { role: "user", text: "I went to the park." },
      { role: "tutor", text: "Nice!\nWas it sunny?" },
      { role: "user", text: "Yes" },
    ]);
  });

  it("quotes the pending turn's reply", () => {
    const turns = tutorTurns(messages, "Yes", "message-2");
    expect(turns.at(-1)).toEqual({ role: "user", text: "> Nice!\n> Was it sunny?\n\nYes" });
  });

  it("keeps the quote of an earlier reply in the history", () => {
    const history = [
      chatMessage("a", "tutor", "Where?"),
      chatMessage("b", "user", "The park", { replyTo: "a" }),
    ];
    expect(tutorTurns(history, "More", null)).toEqual([
      { role: "tutor", text: "Where?" },
      { role: "user", text: "> Where?\n\nThe park" },
      { role: "user", text: "More" },
    ]);
  });

  it("an empty history gives only the pending turn", () => {
    expect(tutorTurns([], "Hello", null)).toEqual([{ role: "user", text: "Hello" }]);
  });

  it("a reply to a missing message sends the text alone", () => {
    expect(tutorTurns(messages, "Yes", "gone").at(-1)).toEqual({ role: "user", text: "Yes" });
  });
});

describe("quoteScrollY", () => {
  it("puts the row under the list's top padding", () => {
    expect(quoteScrollY(400, 24)).toBe(376);
  });

  it("returns null for a row that has not laid out", () => {
    expect(quoteScrollY(undefined, 24)).toBeNull();
  });

  it("clamps a row nearer the top than the padding to 0", () => {
    expect(quoteScrollY(10, 24)).toBe(0);
  });

  it("a row exactly at the padding scrolls to 0", () => {
    expect(quoteScrollY(24, 24)).toBe(0);
  });
});
