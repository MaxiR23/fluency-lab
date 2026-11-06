// apps/mobile/test/utils/chat-conversation.test.ts
//
// Tests for the conversation state machine of the chat.
//
// Tested:
// - startConversation for a free chat, a starter, a topic and a resumed session
// - conversationReducer and nextStep: the order of the outside calls of a turn
// - Failures: an AI failure restores the draft, a save failure resumes at the failed write
// - retryKind, sendState and busy
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/chat-conversation.test.ts
//
// SEE: apps/mobile/src/utils/chat-conversation.ts

import { describe, expect, it } from "@jest/globals";
import {
  STARTERS,
  TUTOR_MODEL,
  usageCostUsd,
  type Message,
  type Profile,
  type Session,
} from "@fluency-lab/shared";

import type { TutorReply } from "@/ai/ai-port";
import {
  busy,
  conversationReducer,
  nextStep,
  retryKind,
  sendState,
  startConversation,
  type Conversation,
  MAX_MESSAGE_LENGTH,
  type ConversationEvent,
} from "@/utils/chat-conversation";
import { freeChatGreeting, topicGreeting } from "@/utils/chat-opening";
import { tutorPrompt } from "@/utils/tutor-prompt";

const starter = STARTERS[0];

const profile: Profile = {
  id: "user-1",
  displayName: "Ada",
  level: "intermediate",
  goals: ["work"],
  topics: ["food"],
  provider: "claude",
  monthlyLimitUsd: 10,
  onboardingCompletedAt: "2026-11-05T10:00:00Z",
  createdAt: "2026-11-05T09:00:00Z",
  updatedAt: "2026-11-05T09:00:00Z",
};

const session: Session = {
  id: "s1",
  topicId: null,
  title: "Free chat",
  status: "active",
  summary: null,
  costUsd: 0,
  createdAt: "2026-11-05T09:00:00Z",
  updatedAt: "2026-11-05T09:00:00Z",
};

const reply: TutorReply = {
  reply: "Nice! Where did you go?",
  corrections: [{ original: "I never been", corrected: "I've never been" }],
  explanation: "Use the present perfect.",
  newWords: ["definitely"],
  model: TUTOR_MODEL,
  usage: {
    inputTokens: 700,
    outputTokens: 150,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
  },
};

function message(role: Message["role"], text: string, extra: Partial<Message> = {}): Message {
  return {
    id: `m-${text}`,
    sessionId: "s1",
    role,
    text,
    corrections: null,
    newWords: null,
    createdAt: "2026-11-05T09:00:00Z",
    ...extra,
  };
}

function free(overrides: Partial<Profile> = {}, spentUsd = 0): Conversation {
  return startConversation({
    origin: { kind: "free" },
    profile: { ...profile, ...overrides },
    spentUsd,
  });
}

function fromStarter(): Conversation {
  return startConversation({
    origin: { kind: "starter", starter },
    profile,
    spentUsd: 0,
  });
}

function apply(c: Conversation, ...events: ConversationEvent[]): Conversation {
  return events.reduce(conversationReducer, c);
}

function typed(c: Conversation, text: string): Conversation {
  return apply(c, { type: "draft_changed", text }, { type: "send_started" });
}

// Plays the steps the hook would run, answering each outside call, and records them.
function play(
  start: Conversation,
  answers: { ask?: ConversationEvent; failAt?: { step: string; event: ConversationEvent } } = {},
) {
  const steps: string[] = [];
  let c = start;
  for (let guard = 0; guard < 20; guard += 1) {
    const step = nextStep(c);
    if (step.kind === "none") break;
    let event: ConversationEvent;
    if (step.kind === "create") {
      steps.push(`create ${JSON.stringify(step.body)}`);
      event = { type: "session_created", session };
    } else if (step.kind === "write") {
      const w = step.write;
      steps.push(w.kind === "usage" ? "write usage" : `write ${w.input.role}: ${w.input.text}`);
      event = { type: "write_done" };
    } else {
      steps.push("ask");
      event = answers.ask ?? { type: "reply_received", reply };
    }
    const failure = answers.failAt;
    if (failure !== undefined && steps.at(-1)?.startsWith(failure.step)) {
      c = conversationReducer(c, failure.event);
      return { c, steps };
    }
    c = conversationReducer(c, event);
  }
  return { c, steps };
}

describe("startConversation", () => {
  it("opens a free chat with the greeting, saved nothing", () => {
    const c = free();
    expect(c.title).toBe("Free chat");
    expect(c.topicTitle).toBeNull();
    expect(c.opening).toBe(freeChatGreeting("Ada"));
    expect(c.messages).toEqual([
      {
        id: "opening",
        role: "tutor",
        text: "Hi Ada! What would you like to talk about today?",
        corrections: [],
        explanation: null,
        newWords: [],
      },
    ]);
    expect(c.session).toBeNull();
    expect(c.phase).toBe("idle");
    expect(nextStep(c)).toEqual({ kind: "none" });
  });

  it("greets without a name", () => {
    expect(free({ displayName: null }).opening).toBe(
      "Hi! What would you like to talk about today?",
    );
  });

  it("opens a starter with its opener and title", () => {
    const c = fromStarter();
    expect(c.title).toBe(starter.title);
    expect(c.topicTitle).toBe(starter.title);
    expect(c.opening).toBe(starter.opener);
    expect(c.messages.map((m) => m.text)).toEqual([starter.opener]);
  });

  it("starts a topic chat titled by the topic, with the topic in the prompt and the topic greeting", () => {
    const c = startConversation({
      origin: { kind: "topic", topicId: "job_interviews" },
      profile,
      spentUsd: 0,
    });
    const greeting = topicGreeting("Ada", "job_interviews");
    expect(c.title).toBe("Job interviews");
    expect(c.topicTitle).toBe("Job interviews");
    expect(c.opening).toBe(greeting);
    expect(c.messages.map((m) => m.text)).toEqual([greeting]);
    const step = nextStep(
      apply(typed(c, "Hello"), { type: "session_created", session }, { type: "write_done" }),
    );
    if (step.kind !== "ask") throw new Error("expected ask");
    expect(step.request.system).toContain("Job interviews");
  });

  it("creates a topic chat's session with its topic id", () => {
    const c = typed(
      startConversation({
        origin: { kind: "topic", topicId: "job_interviews" },
        profile,
        spentUsd: 0,
      }),
      "Hello",
    );
    expect(nextStep(c)).toEqual({ kind: "create", body: { topicId: "job_interviews" } });
  });

  it("resumes a saved session with its messages, corrections and new words", () => {
    const saved = [
      message("tutor", "Opening"),
      message("user", "I never been", {
        corrections: {
          items: [{ original: "I never been", corrected: "I've never been" }],
          explanation: "Because.",
        },
        newWords: ["word"],
      }),
    ];
    const c = startConversation({
      origin: { kind: "resume", sessionId: "s1" },
      profile,
      spentUsd: 1,
      opened: { session: { ...session, title: "Travel", topicId: "travel" }, messages: saved },
    });
    expect(c.title).toBe("Travel");
    expect(c.topicTitle).toBe("Travel");
    expect(c.opening).toBe("Opening");
    expect(c.session?.id).toBe("s1");
    expect(c.messages[1]).toEqual({
      id: "m-I never been",
      role: "user",
      text: "I never been",
      corrections: [{ original: "I never been", corrected: "I've never been" }],
      explanation: "Because.",
      newWords: ["word"],
    });
    expect(c.spentUsd).toBe(1);
  });

  it("resumes a free chat with no topic title", () => {
    const c = startConversation({
      origin: { kind: "resume", sessionId: "s1" },
      profile,
      spentUsd: 0,
      opened: { session, messages: [] },
    });
    expect(c.topicTitle).toBeNull();
  });

  it("resumes a session with no messages: no opening and no messages", () => {
    const c = startConversation({
      origin: { kind: "resume", sessionId: "s1" },
      profile,
      spentUsd: 0,
      opened: { session, messages: [] },
    });
    expect(c.opening).toBeNull();
    expect(c.messages).toEqual([]);
  });
});

describe("a first turn", () => {
  it("creates, saves the opener, asks, then saves the user message, the tutor message and the usage", () => {
    const { c, steps } = play(typed(fromStarter(), "I never been to Japan"));

    expect(steps).toEqual([
      'create {"starterId":"' + starter.id + '"}',
      `write tutor: ${starter.opener}`,
      "ask",
      "write user: I never been to Japan",
      "write tutor: Nice! Where did you go?",
      "write usage",
    ]);
    expect(nextStep(c)).toEqual({ kind: "none" });
    expect(c.phase).toBe("idle");
    expect(c.pending).toBeNull();
    expect(c.writes).toEqual([]);
  });

  it("creates a free chat with a null topic and saves the greeting exactly", () => {
    const { steps } = play(typed(free(), "Hello"));
    expect(steps[0]).toBe('create {"topicId":null}');
    expect(steps[1]).toBe("write tutor: Hi Ada! What would you like to talk about today?");
  });

  it("queues the user message with its corrections and new words, and the usage", () => {
    const afterReply = apply(
      typed(free(), "I never been"),
      { type: "session_created", session },
      { type: "write_done" },
      { type: "reply_received", reply },
    );
    expect(afterReply.writes).toEqual([
      {
        kind: "message",
        input: {
          role: "user",
          text: "I never been",
          corrections: {
            items: [{ original: "I never been", corrected: "I've never been" }],
            explanation: "Use the present perfect.",
          },
          newWords: ["definitely"],
        },
      },
      { kind: "message", input: { role: "tutor", text: "Nice! Where did you go?" } },
      {
        kind: "usage",
        usage: {
          model: TUTOR_MODEL,
          inputTokens: 700,
          outputTokens: 150,
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
        },
      },
    ]);
    expect(afterReply.phase).toBe("saving");
  });

  it("omits corrections and new words when the reply has none", () => {
    const c = apply(
      typed(free(), "Hello"),
      { type: "session_created", session },
      { type: "write_done" },
      {
        type: "reply_received",
        reply: { ...reply, corrections: [], explanation: null, newWords: [] },
      },
    );
    expect(c.writes[0]).toEqual({ kind: "message", input: { role: "user", text: "Hello" } });
  });

  it("shows the user message, the corrections and the tutor reply after the reply", () => {
    const { c } = play(typed(free(), "I never been"));
    expect(c.messages.slice(1)).toEqual([
      {
        id: "message-1",
        role: "user",
        text: "I never been",
        corrections: [{ original: "I never been", corrected: "I've never been" }],
        explanation: "Use the present perfect.",
        newWords: ["definitely"],
      },
      {
        id: "message-2",
        role: "tutor",
        text: "Nice! Where did you go?",
        corrections: [],
        explanation: null,
        newWords: [],
      },
    ]);
  });

  it("asks with the history ending in the user's text and the prompt from tutorPrompt", () => {
    const c = apply(
      typed(fromStarter(), "Hello"),
      { type: "session_created", session },
      { type: "write_done" },
    );
    const step = nextStep(c);
    if (step.kind !== "ask") throw new Error("expected ask");
    expect(step.request.turns).toEqual([
      { role: "tutor", text: starter.opener },
      { role: "user", text: "Hello" },
    ]);
    expect(step.request.system).toBe(
      tutorPrompt({
        displayName: "Ada",
        level: "intermediate",
        goals: ["work"],
        topics: ["food"],
        topicTitle: starter.title,
        openingLine: starter.opener,
      }),
    );
  });

  it("grows spentUsd by exactly usageCostUsd", () => {
    const { c } = play(typed(free({}, 1), "Hello"));
    expect(c.spentUsd).toBe(1 + usageCostUsd(reply.model, reply.usage));
    const { c: fresh } = play(typed(free(), "Hello"));
    expect(fresh.spentUsd).toBe(0.000145);
  });

  it("keeps the draft and ignores a send while busy", () => {
    const busyConversation = typed(free(), "Hello");
    expect(conversationReducer(busyConversation, { type: "send_started" })).toBe(busyConversation);
  });
});

describe("a second turn", () => {
  it("skips create and the opening", () => {
    const first = play(typed(free(), "One")).c;
    const { steps } = play(typed(first, "Two"));
    expect(steps).toEqual([
      "ask",
      "write user: Two",
      "write tutor: Nice! Where did you go?",
      "write usage",
    ]);
  });

  it("sends the saved history plus the new text", () => {
    const first = play(typed(free(), "One")).c;
    const step = nextStep(typed(first, "Two"));
    if (step.kind !== "ask") throw new Error("expected ask");
    expect(step.request.turns.map((t) => `${t.role}:${t.text}`)).toEqual([
      "tutor:Hi Ada! What would you like to talk about today?",
      "user:One",
      "tutor:Nice! Where did you go?",
      "user:Two",
    ]);
  });
});

describe("failures", () => {
  it("an AI failure puts the text back into the draft and keeps the session", () => {
    const { c } = play(typed(free(), "Hello"), {
      failAt: {
        step: "ask",
        event: { type: "reply_failed", failure: { source: "ai", failure: "rate_limited" } },
      },
    });
    expect(c.draft).toBe("Hello");
    expect(c.pending).toBeNull();
    expect(c.session).toEqual(session);
    expect(c.failure).toEqual({ source: "ai", failure: "rate_limited" });
    expect(c.phase).toBe("idle");
    expect(c.writes).toEqual([]);
    expect(retryKind(c)).toBe("resend");
  });

  it("resending after an AI failure asks again with the same text", () => {
    const failed = play(typed(free(), "Hello"), {
      failAt: {
        step: "ask",
        event: { type: "reply_failed", failure: { source: "ai", failure: "network" } },
      },
    }).c;
    const { steps, c } = play(apply(failed, { type: "retry" }, { type: "send_started" }));
    expect(steps).toEqual([
      "ask",
      "write user: Hello",
      "write tutor: Nice! Where did you go?",
      "write usage",
    ]);
    expect(c.failure).toBeNull();
  });

  it("a write failure then retry resumes at the failed write", () => {
    const failed = play(typed(free(), "Hello"), {
      failAt: {
        step: "write tutor: Nice",
        event: { type: "write_failed", failure: { source: "data", failure: "network" } },
      },
    }).c;
    expect(failed.phase).toBe("idle");
    expect(retryKind(failed)).toBe("resume");
    expect(failed.writes.map((w) => (w.kind === "usage" ? "usage" : w.input.role))).toEqual([
      "tutor",
      "usage",
    ]);
    const { steps, c } = play(conversationReducer(failed, { type: "retry" }));
    expect(steps).toEqual(["write tutor: Nice! Where did you go?", "write usage"]);
    expect(c.failure).toBeNull();
    expect(c.phase).toBe("idle");
  });

  it("a create failure keeps the text pending and a retry creates again", () => {
    const failed = play(typed(free(), "Hello"), {
      failAt: {
        step: "create",
        event: { type: "create_failed", failure: { source: "data", failure: "unavailable" } },
      },
    }).c;
    expect(failed.pending).toBe("Hello");
    expect(failed.session).toBeNull();
    const { steps } = play(conversationReducer(failed, { type: "retry" }));
    expect(steps[0]).toBe('create {"topicId":null}');
    expect(steps).toContain("ask");
  });

  it("an opening write failure retries the write, then asks", () => {
    const failed = play(typed(free(), "Hello"), {
      failAt: {
        step: "write tutor: Hi",
        event: { type: "write_failed", failure: { source: "data", failure: "network" } },
      },
    }).c;
    const { steps } = play(conversationReducer(failed, { type: "retry" }));
    expect(steps.slice(0, 2)).toEqual([
      "write tutor: Hi Ada! What would you like to talk about today?",
      "ask",
    ]);
  });

  it("keeps the pending text when a send is started with a text already pending", () => {
    const failed = play(typed(free(), "First"), {
      failAt: {
        step: "create",
        event: { type: "create_failed", failure: { source: "data", failure: "network" } },
      },
    }).c;
    const again = apply(
      failed,
      { type: "draft_changed", text: "Second" },
      { type: "send_started" },
    );
    expect(again.pending).toBe("First");
    expect(again.draft).toBe("Second");
  });

  it("joins the pending text with a newer draft when the AI fails", () => {
    const c = apply(
      typed(free(), "First"),
      { type: "draft_changed", text: "Second" },
      { type: "reply_failed", failure: { source: "ai", failure: "network" } },
    );
    expect(c.draft).toBe("First Second");
  });

  it("a failed reply caps the merged draft at the longest message", () => {
    const pending = "a".repeat(3000);
    const c = apply(
      typed(free(), pending),
      { type: "draft_changed", text: "b".repeat(1500) },
      { type: "reply_failed", failure: { source: "ai", failure: "network" } },
    );
    expect(c.draft).toHaveLength(MAX_MESSAGE_LENGTH);
    expect(c.draft.startsWith(pending)).toBe(true);
  });

  it("a failed reply that was billed queues the usage write and grows the spend", () => {
    const usage = {
      inputTokens: 1000,
      outputTokens: 1024,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    };
    const start = typed(free({}, 1), "Hello");
    const failed = apply(start, {
      type: "reply_failed",
      failure: { source: "ai", failure: "bad_response" },
      usage,
    });
    expect(failed.writes).toEqual([{ kind: "usage", usage: { model: TUTOR_MODEL, ...usage } }]);
    expect(failed.spentUsd).toBe(Math.round((1 + usageCostUsd(TUTOR_MODEL, usage)) * 1e8) / 1e8);
    expect(failed.draft).toBe("Hello");
    expect(failed.failure).toEqual({ source: "ai", failure: "bad_response" });
    expect(failed.phase).toBe("saving");
    expect(nextStep(failed)).toEqual({ kind: "write", write: failed.writes[0] });
    expect(retryKind(failed)).toBe("resend");
  });

  it("a failed reply without usage queues nothing and keeps the spend", () => {
    const failed = apply(typed(free({}, 1), "Hello"), {
      type: "reply_failed",
      failure: { source: "ai", failure: "network" },
    });
    expect(failed.writes).toEqual([]);
    expect(failed.spentUsd).toBe(1);
    expect(failed.phase).toBe("idle");
  });

  it("flush_started sends the queued writes only, without asking again", () => {
    const failed = play(typed(free(), "Hello"), {
      failAt: {
        step: "write usage",
        event: { type: "write_failed", failure: { source: "data", failure: "network" } },
      },
    }).c;
    expect(failed.writes).toHaveLength(1);
    const flushing = apply(failed, { type: "flush_started" });
    expect(flushing.phase).toBe("saving");
    expect(flushing.failure).toBeNull();
    expect(nextStep(flushing).kind).toBe("write");
    const done = apply(flushing, { type: "write_done" });
    expect(done.phase).toBe("idle");
    expect(apply(free(), { type: "flush_started" }).phase).toBe("idle");
  });

  it("an end failure shows the failure, and retry clears it", () => {
    const ended = apply(free(), { type: "end_started" });
    expect(ended.phase).toBe("ending");
    expect(busy(ended)).toBe(true);
    const failed = conversationReducer(ended, {
      type: "end_failed",
      failure: { source: "data", failure: "network" },
    });
    expect(failed.phase).toBe("idle");
    expect(retryKind(failed)).toBe("end");
    expect(conversationReducer(failed, { type: "retry" }).failure).toBeNull();
  });

  it("context_refreshed clears a key failure and keeps the draft", () => {
    const failed = apply(typed(free(), "Hello"), {
      type: "reply_failed",
      failure: { source: "ai", failure: "invalid_key" },
    });
    const refreshed = conversationReducer(failed, {
      type: "context_refreshed",
      provider: "claude",
      limitUsd: 20,
      spentUsd: 2,
    });
    expect(refreshed.failure).toBeNull();
    expect(refreshed.draft).toBe("Hello");
    expect(refreshed.limitUsd).toBe(20);
    expect(refreshed.spentUsd).toBe(2);
  });

  it("context_failed sets a failure when there is none and keeps an existing one", () => {
    const failure = { source: "data", failure: "network" } as const;
    const failed = conversationReducer(free(), { type: "context_failed", failure });
    expect(failed.failure).toEqual(failure);
    const other = { source: "ai", failure: "rate_limited" } as const;
    const kept = conversationReducer(
      apply(typed(free(), "Hi"), { type: "reply_failed", failure: other }),
      { type: "context_failed", failure },
    );
    expect(kept.failure).toEqual(other);
  });

  it("context_refreshed keeps any other failure", () => {
    const failed = apply(typed(free(), "Hello"), {
      type: "reply_failed",
      failure: { source: "ai", failure: "rate_limited" },
    });
    const refreshed = conversationReducer(failed, {
      type: "context_refreshed",
      provider: "claude",
      limitUsd: 20,
      spentUsd: 2,
    });
    expect(refreshed.failure).toEqual({ source: "ai", failure: "rate_limited" });
  });
});

describe("sendState and busy", () => {
  it("locks sending for OpenAI", () => {
    expect(sendState(free({ provider: "openai" }))).toEqual({
      locked: true,
      notice: "unsupported",
    });
  });

  it("locks sending at the limit", () => {
    expect(sendState(free({}, 10))).toEqual({ locked: true, notice: "limit" });
  });

  it("warns at 80% without locking", () => {
    expect(sendState(free({}, 8))).toEqual({ locked: false, notice: "warning" });
  });

  it("has no notice under the threshold", () => {
    expect(sendState(free({}, 1))).toEqual({ locked: false, notice: null });
  });

  it("treats a null provider as the supported one", () => {
    expect(sendState(free({ provider: null }))).toEqual({ locked: false, notice: null });
  });

  it("has no notice without a limit", () => {
    expect(sendState(free({ monthlyLimitUsd: null }, 1000))).toEqual({
      locked: false,
      notice: null,
    });
  });

  it("prefers the unsupported notice over the limit", () => {
    expect(sendState(free({ provider: "openai" }, 10)).notice).toBe("unsupported");
  });

  it("is busy unless idle", () => {
    expect(busy(free())).toBe(false);
    expect(busy(typed(free(), "Hi"))).toBe(true);
  });
});
