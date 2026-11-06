// apps/mobile/test/utils/thread-conversation.test.ts
//
// Tests for the conversation state machine of a correction thread.
//
// Tested:
// - startThread builds the thread from the saved rows, the profile and the month spend
// - threadReducer and threadNextStep: the order of the outside calls of a question
// - A chip sends its text and keeps the draft; the ask holds only the thread and the new question
// - A reply queues the learner row, the tutor row, the withdrawal and the usage, in that order
// - A withdrawal marks the correction right away; an invalid number queues nothing
// - Failures: an AI failure restores the text, a save failure resumes at the failed write
// - threadItems, pinnedCard, threadRetryKind and the spend lock of a thread
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/thread-conversation.test.ts
//
// SEE: apps/mobile/src/utils/thread-conversation.ts

import { describe, expect, it } from "@jest/globals";
import {
  TUTOR_MODEL,
  usageCostUsd,
  type CorrectionThread,
  type Message,
  type Profile,
  type Session,
} from "@fluency-lab/shared";

import type { ThreadReply } from "@/ai/ai-port";
import { sendState } from "@/utils/chat-conversation";
import {
  pinnedCard,
  startThread,
  threadItems,
  threadNextStep,
  threadReducer,
  threadRetryKind,
  type ThreadConversation,
  type ThreadEvent,
} from "@/utils/thread-conversation";
import { threadPrompt } from "@/utils/thread-prompt";

const profile: Profile = {
  id: "user-1",
  displayName: "Ada",
  level: "intermediate",
  goals: [],
  topics: [],
  provider: "claude",
  monthlyLimitUsd: 10,
  onboardingCompletedAt: "2026-11-05T10:00:00Z",
  createdAt: "2026-11-05T09:00:00Z",
  updatedAt: "2026-11-05T09:00:00Z",
};

const session: Session = {
  id: "s1",
  topicId: null,
  title: "Travel",
  status: "active",
  summary: null,
  costUsd: 0,
  createdAt: "2026-11-05T09:00:00Z",
  updatedAt: "2026-11-05T09:00:00Z",
};

const message: Message = {
  id: "m1",
  sessionId: "s1",
  role: "user",
  text: "I never been to Japan, but I want to go the next year.",
  corrections: {
    items: [
      { original: "the next year", corrected: "next year", rule: "Articles with years" },
      { original: "I never been", corrected: "I've never been", rule: "Present perfect" },
    ],
    explanation: "Two fixes.",
  },
  newWords: null,
  replyToId: null,
  createdAt: "2026-11-05T09:00:00Z",
};

function thread(messages: CorrectionThread["messages"] = []): CorrectionThread {
  return { session, message, messages };
}

function start(spentUsd = 0, rows: CorrectionThread["messages"] = [], p = profile) {
  return startThread({ thread: thread(rows), profile: p, spentUsd });
}

const usage = {
  inputTokens: 700,
  outputTokens: 150,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
};

function reply(overrides: Partial<ThreadReply> = {}): ThreadReply {
  return {
    reply: "Because of the article.",
    newWords: [],
    withdrawn: [],
    model: TUTOR_MODEL,
    usage,
    ...overrides,
  };
}

function apply(c: ThreadConversation, ...events: ThreadEvent[]): ThreadConversation {
  return events.reduce(threadReducer, c);
}

function asked(c: ThreadConversation, text: string): ThreadConversation {
  return apply(c, { type: "draft_changed", text }, { type: "send_started" });
}

describe("startThread", () => {
  it("builds the thread from the saved rows with their saved ids", () => {
    const c = start(0, [
      { id: "t1", messageId: "m1", role: "user", text: "Why?", newWords: ["a"], createdAt: "x" },
      {
        id: "t2",
        messageId: "m1",
        role: "tutor",
        text: "Because.",
        newWords: null,
        createdAt: "y",
      },
    ]);
    expect(c.messages).toEqual([
      { id: "t1", role: "user", text: "Why?", newWords: ["a"], savedId: "t1" },
      { id: "t2", role: "tutor", text: "Because.", newWords: [], savedId: "t2" },
    ]);
    expect(c.message.id).toBe("m1");
    expect(c.message.corrections).toHaveLength(2);
    expect(c.session.id).toBe("s1");
  });

  it("has no messages for an empty thread and starts idle with the profile context", () => {
    const c = start(2.5);
    expect(c.messages).toEqual([]);
    expect(c).toMatchObject({
      phase: "idle",
      draft: "",
      pending: null,
      writes: [],
      failure: null,
      level: "intermediate",
      provider: "claude",
      limitUsd: 10,
      spentUsd: 2.5,
    });
  });

  it("reads a message with no corrections as having none", () => {
    const c = startThread({
      thread: { session, message: { ...message, corrections: null }, messages: [] },
      profile,
      spentUsd: 0,
    });
    expect(c.message.corrections).toEqual([]);
    expect(c.message.explanation).toBeNull();
  });
});

describe("sending a question", () => {
  it("moves the draft to pending and clears it, asking", () => {
    const c = asked(start(), "  Why is it wrong?  ");
    expect(c).toMatchObject({ pending: "Why is it wrong?", draft: "", phase: "asking" });
  });

  it("a chip sends its text and keeps the draft", () => {
    const typing = apply(start(), { type: "draft_changed", text: "my own" });
    const c = threadReducer(typing, { type: "send_started", text: "Why is it wrong?" });
    expect(c).toMatchObject({ pending: "Why is it wrong?", draft: "my own", phase: "asking" });
  });

  it("is ignored when not idle", () => {
    const busy = asked(start(), "One");
    expect(asked(busy, "Two")).toEqual({ ...busy, draft: "Two" });
    expect(threadReducer(busy, { type: "send_started", text: "x" })).toEqual(busy);
  });

  it("is ignored for an empty text", () => {
    const c = start();
    expect(threadReducer(c, { type: "send_started" })).toEqual(c);
  });
});

describe("threadNextStep", () => {
  it("the ask sends only the thread and the new question", () => {
    const c = asked(
      start(0, [
        { id: "t1", messageId: "m1", role: "user", text: "Why?", newWords: null, createdAt: "x" },
        {
          id: "t2",
          messageId: "m1",
          role: "tutor",
          text: "Because.",
          newWords: null,
          createdAt: "y",
        },
      ]),
      "And now?",
    );
    expect(threadNextStep(c)).toEqual({
      kind: "ask",
      request: {
        system: threadPrompt({
          level: "intermediate",
          sentence: message.text,
          corrections: message.corrections?.items ?? [],
          explanation: "Two fixes.",
        }),
        turns: [
          { role: "user", text: "Why?" },
          { role: "tutor", text: "Because." },
          { role: "user", text: "And now?" },
        ],
      },
    });
  });

  it("does nothing when idle", () => {
    expect(threadNextStep(start())).toEqual({ kind: "none" });
  });
});

describe("a reply", () => {
  it("queues the learner row, the tutor row, the withdrawal and the usage in that order", () => {
    const c = apply(asked(start(), "I think I was right"), {
      type: "reply_received",
      reply: reply({ newWords: ["laid-back"], withdrawn: [2] }),
    });
    expect(c.writes).toEqual([
      {
        kind: "message",
        localId: "thread-0",
        input: { role: "user", text: "I think I was right", newWords: ["laid-back"] },
      },
      {
        kind: "message",
        localId: "thread-1",
        input: { role: "tutor", text: "Because of the article." },
      },
      { kind: "withdraw", items: [1] },
      {
        kind: "usage",
        usage: { model: TUTOR_MODEL, ...usage },
      },
    ]);
    expect(c.phase).toBe("saving");
    expect(c.pending).toBeNull();
  });

  it("appends the learner row with its words and the tutor row", () => {
    const c = apply(asked(start(), "Q"), {
      type: "reply_received",
      reply: reply({ newWords: ["w"] }),
    });
    expect(c.messages).toEqual([
      { id: "thread-0", role: "user", text: "Q", newWords: ["w"], savedId: null },
      {
        id: "thread-1",
        role: "tutor",
        text: "Because of the article.",
        newWords: [],
        savedId: null,
      },
    ]);
  });

  it("marks the withdrawn correction right away and leaves the other", () => {
    const c = apply(asked(start(), "Q"), {
      type: "reply_received",
      reply: reply({ withdrawn: [2] }),
    });
    expect(c.message.corrections[1].withdrawn).toBe(true);
    expect(c.message.corrections[0].withdrawn).toBeUndefined();
  });

  it("queues no withdrawal for none or only invalid numbers", () => {
    for (const withdrawn of [[], [0], [3], [1.5]]) {
      const c = apply(asked(start(), "Q"), { type: "reply_received", reply: reply({ withdrawn }) });
      expect(c.writes.map((w) => w.kind)).toEqual(["message", "message", "usage"]);
      expect(c.message.corrections.every((item) => item.withdrawn === undefined)).toBe(true);
    }
  });

  it("queues no words when there are none", () => {
    const c = apply(asked(start(), "Q"), { type: "reply_received", reply: reply() });
    expect(c.writes[0]).toMatchObject({ input: { role: "user", text: "Q" } });
    expect(c.writes[0]).not.toHaveProperty("input.newWords");
  });

  it("adds the cost to the spend", () => {
    const c = apply(asked(start(1), "Q"), { type: "reply_received", reply: reply() });
    expect(c.spentUsd).toBeCloseTo(1 + usageCostUsd(TUTOR_MODEL, usage), 8);
  });

  it("numbers the rows after the ones already in the thread", () => {
    const first = apply(asked(start(), "A"), { type: "reply_received", reply: reply() });
    const second = apply(
      first,
      { type: "write_done" },
      { type: "write_done" },
      { type: "write_done" },
    );
    const next = apply(asked(second, "B"), { type: "reply_received", reply: reply() });
    expect(next.writes[0]).toMatchObject({ localId: "thread-2" });
  });
});

describe("saving", () => {
  it("write_done sets the saved id of a row write and goes idle after the last write", () => {
    const received = apply(asked(start(), "Q"), {
      type: "reply_received",
      reply: reply(),
    });
    const c = apply(
      received,
      { type: "write_done", savedId: "db-q" },
      { type: "write_done", savedId: "db-a" },
    );
    expect(c.messages.map((m) => m.savedId)).toEqual(["db-q", "db-a"]);
    expect(c.phase).toBe("saving");
    expect(apply(c, { type: "write_done" }).phase).toBe("idle");
  });

  it("write_done replaces the corrections with the ones the withdrawal returned", () => {
    const received = apply(asked(start(), "Q"), {
      type: "reply_received",
      reply: reply({ withdrawn: [1] }),
    });
    const saved = [
      { original: "the next year", corrected: "next year", withdrawn: true as const },
      { original: "I never been", corrected: "I've never been" },
    ];
    const c = apply(
      received,
      { type: "write_done", savedId: "a" },
      { type: "write_done", savedId: "b" },
      { type: "write_done", corrections: saved },
    );
    expect(c.message.corrections).toEqual(saved);
  });

  it("write_failed stops with the data failure and retry resumes the writes left", () => {
    const received = apply(asked(start(), "Q"), { type: "reply_received", reply: reply() });
    const failed = apply(received, {
      type: "write_failed",
      failure: { source: "data", failure: "network" },
    });
    expect(failed).toMatchObject({ phase: "idle", failure: { source: "data" } });
    expect(threadRetryKind(failed)).toBe("resume");
    const retried = threadReducer(failed, { type: "retry" });
    expect(retried).toMatchObject({ failure: null, phase: "saving" });
    expect(threadNextStep(retried)).toMatchObject({ kind: "write" });
  });
});

describe("failures", () => {
  it("reply_failed puts the pending text back in the draft and sets the failure", () => {
    const c = apply(asked(start(), "Why?"), {
      type: "reply_failed",
      failure: { source: "ai", failure: "rate_limited" },
    });
    expect(c).toMatchObject({
      draft: "Why?",
      pending: null,
      phase: "idle",
      failure: { source: "ai", failure: "rate_limited" },
    });
    expect(threadRetryKind(c)).toBe("resend");
  });

  it("keeps what the learner typed meanwhile after the restored text", () => {
    const typing = apply(asked(start(), "Why?"), { type: "draft_changed", text: "more" });
    const c = threadReducer(typing, {
      type: "reply_failed",
      failure: { source: "ai", failure: "network" },
    });
    expect(c.draft).toBe("Why? more");
  });

  it("a billed failure queues the usage and adds the cost", () => {
    const c = apply(asked(start(1), "Why?"), {
      type: "reply_failed",
      failure: { source: "ai", failure: "bad_response" },
      usage,
    });
    expect(c.writes).toEqual([{ kind: "usage", usage: { model: TUTOR_MODEL, ...usage } }]);
    expect(c.spentUsd).toBeCloseTo(1 + usageCostUsd(TUTOR_MODEL, usage), 8);
    expect(c.phase).toBe("saving");
  });

  it("retry after an AI failure goes back to idle with the text in the draft", () => {
    const failed = apply(asked(start(), "Why?"), {
      type: "reply_failed",
      failure: { source: "ai", failure: "network" },
    });
    expect(threadReducer(failed, { type: "retry" })).toMatchObject({
      failure: null,
      phase: "idle",
    });
  });

  it("context_refreshed and context_failed behave as in the chat", () => {
    const failed = apply(asked(start(), "Hello"), {
      type: "reply_failed",
      failure: { source: "ai", failure: "invalid_key" },
    });
    const refreshed = threadReducer(failed, {
      type: "context_refreshed",
      provider: "claude",
      limitUsd: 20,
      spentUsd: 2,
    });
    expect(refreshed).toMatchObject({ failure: null, draft: "Hello", limitUsd: 20, spentUsd: 2 });
    const failure = { source: "data", failure: "network" } as const;
    expect(threadReducer(start(), { type: "context_failed", failure }).failure).toEqual(failure);
  });
});

describe("threadItems", () => {
  it("is empty for an empty idle thread", () => {
    expect(threadItems(start())).toEqual([]);
  });

  it("draws user, new word and tutor items in order, with no corrections or thread", () => {
    const c = start(0, [
      { id: "t1", messageId: "m1", role: "user", text: "Why?", newWords: ["w"], createdAt: "x" },
      {
        id: "t2",
        messageId: "m1",
        role: "tutor",
        text: "Because.",
        newWords: null,
        createdAt: "y",
      },
    ]);
    expect(threadItems(c)).toEqual([
      {
        kind: "user",
        id: "t1",
        text: "Why?",
        corrections: [],
        explanation: null,
        quote: null,
        thread: null,
      },
      { kind: "new_word", id: "t1:word:0", word: "w" },
      { kind: "tutor", id: "t2", text: "Because." },
    ]);
  });

  it("draws the pending row and the typing item while asking", () => {
    const items = threadItems(asked(start(), "Why?"));
    expect(items).toEqual([
      {
        kind: "user",
        id: "thread-0",
        text: "Why?",
        corrections: [],
        explanation: null,
        quote: null,
        thread: null,
      },
      { kind: "typing", id: "typing" },
    ]);
  });

  it("gives the pending message the id its row takes when the reply arrives", () => {
    const asking = asked(start(), "Why?");
    const answered = apply(asking, { type: "reply_received", reply: reply() });
    expect(threadItems(asking)[0].id).toBe(threadItems(answered)[0].id);
  });
});

describe("pinnedCard", () => {
  it("holds the sentence, the corrections and the rule", () => {
    expect(pinnedCard(start())).toEqual({
      sentence: message.text,
      corrections: message.corrections?.items,
      rule: "Articles with years · Present perfect",
    });
  });

  it("has no rule when the corrections have none", () => {
    const c = startThread({
      thread: {
        session,
        message: {
          ...message,
          corrections: { items: [{ original: "a", corrected: "b" }], explanation: null },
        },
        messages: [],
      },
      profile,
      spentUsd: 0,
    });
    expect(pinnedCard(c).rule).toBeNull();
  });
});

describe("the spend lock of a thread", () => {
  it("locks at exactly the limit with the limit notice", () => {
    expect(sendState(start(10))).toEqual({ locked: true, notice: "limit" });
  });

  it("warns under the limit without locking", () => {
    expect(sendState(start(8))).toEqual({ locked: false, notice: "warning" });
  });

  it("never locks without a limit", () => {
    const c = start(1000, [], { ...profile, monthlyLimitUsd: null });
    expect(sendState(c)).toEqual({ locked: false, notice: null });
  });
});
