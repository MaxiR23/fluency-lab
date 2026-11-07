// apps/mobile/test/utils/chat-items.test.ts
//
// Tests for the chat item helpers.
//
// Tested:
// - correctionsLabel, threadRepliesLabel, correctionRows and pinnedRule
// - chatItems builds the list of the conversation: bubbles, corrections, new words, typing
// - chatItems gives a tutor item its note card, saved only once the note has an id
// - chatItems opens a thread only on a saved message with corrections, with its reply count
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/chat-items.test.ts
//
// SEE: apps/mobile/src/utils/chat-items.ts

import { describe, expect, it } from "@jest/globals";

import { STARTERS, TUTOR_MODEL, type Profile } from "@fluency-lab/shared";

import type { TutorReply } from "@/ai/ai-port";
import {
  conversationReducer,
  startConversation,
  type Conversation,
  type ChatMessage,
} from "@/utils/chat-conversation";
import {
  chatItems,
  correctionRows,
  correctionsLabel,
  pinnedRule,
  threadAskLabel,
  threadRepliesLabel,
} from "@/utils/chat-items";

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
  replyTo: null,
  savedId: null,
  threadReplies: 0,
  note: null,
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

describe("threadRepliesLabel", () => {
  it("is null for no replies", () => {
    expect(threadRepliesLabel(0)).toBeNull();
  });

  it("is singular for one reply", () => {
    expect(threadRepliesLabel(1)).toBe("1 reply");
  });

  it("is plural for two replies", () => {
    expect(threadRepliesLabel(2)).toBe("2 replies");
  });

  it("is null for a negative count", () => {
    expect(threadRepliesLabel(-1)).toBeNull();
  });
});

describe("threadAskLabel", () => {
  it("names the row with its reply count", () => {
    expect(threadAskLabel("2 replies")).toBe("Ask about this, 2 replies");
  });

  it("names the row alone without replies", () => {
    expect(threadAskLabel(null)).toBe("Ask about this");
  });
});

describe("correctionRows", () => {
  it("marks a withdrawn item and keeps an active one", () => {
    const rows = correctionRows([
      { original: "a", corrected: "b" },
      { original: "c", corrected: "d", withdrawn: true },
    ]);
    expect(
      rows.map(({ original, corrected, withdrawn }) => ({ original, corrected, withdrawn })),
    ).toEqual([
      { original: "a", corrected: "b", withdrawn: false },
      { original: "c", corrected: "d", withdrawn: true },
    ]);
  });

  it("gives two identical items distinct keys", () => {
    const rows = correctionRows([
      { original: "a", corrected: "b" },
      { original: "a", corrected: "b" },
    ]);
    expect(new Set(rows.map((row) => row.key)).size).toBe(2);
  });

  it("is empty for no corrections", () => {
    expect(correctionRows([])).toEqual([]);
  });
});

describe("pinnedRule", () => {
  it("joins the distinct rules in order", () => {
    expect(
      pinnedRule([
        { original: "a", corrected: "b", rule: "Spelling" },
        { original: "c", corrected: "d", rule: "Articles" },
      ]),
    ).toBe("Spelling · Articles");
  });

  it("treats rules that differ only in case and spaces as one", () => {
    expect(
      pinnedRule([
        { original: "a", corrected: "b", rule: "Spelling" },
        { original: "c", corrected: "d", rule: " spelling " },
      ]),
    ).toBe("Spelling");
  });

  it("is null when no correction has a rule", () => {
    expect(pinnedRule([{ original: "a", corrected: "b" }])).toBeNull();
    expect(pinnedRule([])).toBeNull();
  });

  it("is the rule alone when only one has one", () => {
    expect(
      pinnedRule([
        { original: "a", corrected: "b" },
        { original: "c", corrected: "d", rule: "Tense" },
      ]),
    ).toBe("Tense");
  });
});

describe("chatItems", () => {
  it("is empty for a conversation with no messages", () => {
    expect(chatItems(conversation({ messages: [] }))).toEqual([]);
  });

  it("draws the opening as a tutor item", () => {
    expect(chatItems(conversation())).toEqual([
      { kind: "tutor", id: "opening", text: STARTERS[0].opener, note: null },
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
      replyTo: null,
      savedId: null,
      threadReplies: 0,
      note: null,
    };
    const items = chatItems(conversation({ messages: [designUser, tutor] }));

    expect(items).toEqual([
      {
        kind: "user",
        id: "u1",
        text: designUser.text,
        corrections: designUser.corrections,
        explanation: designUser.explanation,
        quote: null,
        thread: null,
      },
      { kind: "new_word", id: "u1:word:0", word: "definitely" },
      { kind: "tutor", id: "t2", text: tutor.text, note: null },
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
      {
        kind: "user",
        id: "u1",
        text: plain.text,
        corrections: [],
        explanation: null,
        quote: null,
        thread: null,
      },
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
      {
        kind: "user",
        id: "message-1",
        text: "Hello",
        corrections: [],
        explanation: null,
        quote: null,
        thread: null,
      },
      { kind: "typing", id: "typing" },
    ]);
  });

  it("gives the pending message the id its saved message takes when the reply arrives", () => {
    const base = conversation({ messages: [designUser] });
    const sent = conversationReducer(base, { type: "draft_changed", text: "Hello" });
    const asking = conversationReducer(sent, { type: "send_started" });
    const reply: TutorReply = {
      reply: "Nice!",
      corrections: [],
      explanation: null,
      note: null,
      newWords: [],
      model: TUTOR_MODEL,
      usage: {
        inputTokens: 1,
        outputTokens: 1,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      },
    };

    const before = chatItems(asking).find((item) => item.kind === "user" && item.text === "Hello");
    const answered = conversationReducer(asking, { type: "reply_received", reply });
    const after = chatItems(answered).find((item) => item.kind === "user" && item.text === "Hello");

    expect(before?.id).toBe("message-1");
    expect(after?.id).toBe(before?.id);
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

  describe("threads", () => {
    const saved: ChatMessage = { ...designUser, savedId: "db-1", threadReplies: 2 };

    it("a saved message with corrections can be asked about, with its reply count", () => {
      const item = chatItems(conversation({ messages: [saved] }))[0];
      expect(item).toMatchObject({ thread: { messageId: "db-1", replies: "2 replies" } });
    });

    it("a saved message with no replies has no count", () => {
      const item = chatItems(conversation({ messages: [{ ...saved, threadReplies: 0 }] }))[0];
      expect(item).toMatchObject({ thread: { messageId: "db-1", replies: null } });
    });

    it("a message without corrections cannot be asked about", () => {
      const plain: ChatMessage = { ...saved, corrections: [], explanation: null };
      expect(chatItems(conversation({ messages: [plain] }))[0]).toMatchObject({ thread: null });
    });

    it("a message not saved yet cannot be asked about", () => {
      const local: ChatMessage = { ...saved, savedId: null };
      expect(chatItems(conversation({ messages: [local] }))[0]).toMatchObject({ thread: null });
    });

    it("the pending row cannot be asked about", () => {
      const items = chatItems(conversation({ pending: "Hi", phase: "asking" }));
      expect(items.find((i) => i.kind === "user")).toMatchObject({ thread: null });
    });

    it("a message whose corrections are all withdrawn can still be asked about", () => {
      const withdrawn: ChatMessage = {
        ...saved,
        corrections: [{ original: "a", corrected: "b", withdrawn: true }],
      };
      expect(chatItems(conversation({ messages: [withdrawn] }))[0]).toMatchObject({
        thread: { messageId: "db-1" },
      });
    });
  });

  describe("quotes", () => {
    const tutor: ChatMessage = {
      id: "t1",
      role: "tutor",
      text: "Where did you go?",
      corrections: [],
      explanation: null,
      newWords: [],
      replyTo: null,
      savedId: null,
      threadReplies: 0,
      note: null,
    };

    it("a learner reply carries the quote with the tutor's name and text", () => {
      const reply: ChatMessage = { ...designUser, newWords: [], replyTo: "t1" };
      const item = chatItems(conversation({ messages: [tutor, reply] })).find(
        (i) => i.kind === "user",
      );
      expect(item).toMatchObject({
        quote: { targetId: "t1", author: "Claude", text: "Where did you go?" },
      });
    });

    it("the pending row carries its quote while the tutor answers", () => {
      const items = chatItems(
        conversation({
          messages: [tutor],
          pending: "To Rome",
          pendingReplyTo: "t1",
          phase: "asking",
        }),
      );
      expect(items.find((i) => i.kind === "user")).toMatchObject({
        text: "To Rome",
        quote: { targetId: "t1", author: "Claude", text: "Where did you go?" },
      });
    });

    it("a message with no reply has no quote", () => {
      const items = chatItems(conversation({ messages: [tutor, designUser] }));
      expect(items.find((i) => i.kind === "user")).toMatchObject({ quote: null });
    });

    it("a reply whose original is missing has no quote", () => {
      const reply: ChatMessage = { ...designUser, replyTo: "gone" };
      const items = chatItems(conversation({ messages: [reply] }));
      expect(items.find((i) => i.kind === "user")).toMatchObject({ quote: null });
    });
  });
});

describe("chatItems with a study note", () => {
  const draft = {
    kind: "table" as const,
    title: "Future forms",
    topic: "Going to, will",
    content: {
      columns: ["Form", "When", "Example"] as [string, string, string],
      rows: [
        ["going to", "plans", "I'm going to study."],
        ["will", "decisions now", "I'll help."],
        ["present simple", "timetables", "The train leaves at 5."],
        ["present continuous", "arrangements", "I'm meeting Ana."],
      ] as [string, string, string][],
      remember: "Plans use going to.",
    },
  };
  const tutor = (note: ChatMessage["note"]): ChatMessage => ({
    id: "t1",
    role: "tutor",
    text: "Your table is ready.",
    corrections: [],
    explanation: null,
    newWords: [],
    replyTo: null,
    savedId: null,
    threadReplies: 0,
    note,
  });

  it("gives a tutor item its note card with the preview", () => {
    const [item] = chatItems(conversation({ messages: [tutor({ draft, savedId: "n1" })] }));
    expect(item).toEqual({
      kind: "tutor",
      id: "t1",
      text: "Your table is ready.",
      note: {
        noteId: "n1",
        title: "Future forms",
        topic: "Going to, will",
        icon: "table",
        preview: [
          { lead: "going to", text: "plans" },
          { lead: "will", text: "decisions now" },
          { lead: "present simple", text: "timetables" },
        ],
      },
    });
  });

  it("draws a list icon on the card of a summary", () => {
    const summary = {
      kind: "summary" as const,
      title: "Present perfect",
      topic: "Have + past participle",
      content: { points: ["Use it for experience."], remember: "r" },
    };
    const [item] = chatItems(
      conversation({ messages: [tutor({ draft: summary, savedId: "n2" })] }),
    );
    expect(item).toMatchObject({ note: { icon: "list", preview: [{ lead: null }] } });
  });

  it("marks the card saved only once the note has an id", () => {
    const [item] = chatItems(conversation({ messages: [tutor({ draft, savedId: null })] }));
    expect(item).toMatchObject({ note: { noteId: null, title: "Future forms" } });
  });

  it("gives a tutor item with no note a null card", () => {
    const [item] = chatItems(conversation({ messages: [tutor(null)] }));
    expect(item).toMatchObject({ kind: "tutor", note: null });
  });
});
