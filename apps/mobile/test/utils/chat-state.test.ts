// apps/mobile/test/utils/chat-state.test.ts
//
// Tests for the Chat view and its small pure helpers.
//
// Tested:
// - chatView, originTitle, providerLine, noKeyProviderLine, canSend
// - chatSubtitle and chatTopicId: the header's type and tutor line
// - endPromptTitle, endPromptButtons
// - chatNotice accepts any state that has the context fields; threadsRefresh turns a session read into an event
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/chat-state.test.ts
//
// SEE: apps/mobile/src/utils/chat-state.ts

import { describe, expect, it } from "@jest/globals";

import {
  STARTERS,
  type MonthSpend,
  type Session,
  type SessionWithMessages,
} from "@fluency-lab/shared";

import type { ChatOrigin } from "@/utils/chat-opening";

import { conversationReducer, startConversation } from "@/utils/chat-conversation";
import { limitReachedMessage, spendWarningText } from "@/utils/spend-limit";

import {
  MAX_MESSAGE_LENGTH,
  canSend,
  chatNotice,
  chatSubtitle,
  chatTopicId,
  chatView,
  contextRefresh,
  endPromptButtons,
  endPromptTitle,
  noKeyProviderLine,
  originTitle,
  providerLine,
  threadsRefresh,
} from "@/utils/chat-state";
import { endedSessionMessage, unsupportedProviderMessage } from "@/utils/chat-failure";
import { dataFailureMessage, keyReadFailureMessage } from "@/utils/data-message";
import { completedProfile, profileWith } from "../helpers/fake-data";

const free = { kind: "free" } as const;
function sessionOf(topicId: string | null): Session {
  return {
    id: "s1",
    topicId,
    title: "T",
    status: "active",
    summary: null,
    contextSummary: null,
    contextThroughId: null,
    titleSource: "default",
    costUsd: 0,
    createdAt: "2026-11-05T09:00:00Z",
    updatedAt: "2026-11-05T09:00:00Z",
  };
}
function conversationOf(origin: ChatOrigin) {
  return { session: null, origin };
}
const hasKey = { ok: true, value: true } as const;
const spent = (spentUsd: number): { ok: true; value: MonthSpend } => ({
  ok: true,
  value: { monthStart: "2026-11-01", spentUsd },
});
const opened = (
  status: "active" | "ended",
  messages = 0,
): { ok: true; value: SessionWithMessages } => ({
  ok: true,
  value: {
    session: {
      id: "s1",
      topicId: null,
      title: "Travel",
      status,
      summary: null,
      contextSummary: null,
      contextThroughId: null,
      titleSource: "default",
      costUsd: 0,
      createdAt: "2026-11-05T09:00:00Z",
      updatedAt: "2026-11-05T09:00:00Z",
    },
    threadReplies: [],
    notes: [],
    messages: Array.from({ length: messages }, (_, n) => ({
      id: `m${n}`,
      sessionId: "s1",
      role: "tutor" as const,
      text: `t${n}`,
      corrections: null,
      newWords: null,
      replyToId: null,
      noteId: null,
      createdAt: "2026-11-05T09:00:00Z",
    })),
  },
});

describe("chatView", () => {
  it("is ready with a conversation from the profile and the month spend", () => {
    const view = chatView({
      key: hasKey,
      profile: { ok: true, value: profileWith({ provider: "claude", monthlyLimitUsd: 10 }) },
      spend: spent(2.5),
      origin: free,
      opened: null,
    });
    expect(view.kind).toBe("ready");
    if (view.kind !== "ready") return;
    expect(view.conversation.provider).toBe("claude");
    expect(view.conversation.limitUsd).toBe(10);
    expect(view.conversation.spentUsd).toBe(2.5);
    expect(view.conversation.title).toBe("Free chat");
  });

  it("is ready with no provider when the profile has none", () => {
    const view = chatView({
      key: hasKey,
      profile: { ok: true, value: completedProfile() },
      spend: spent(0),
      origin: free,
      opened: null,
    });
    expect(view.kind === "ready" && view.conversation.provider).toBeNull();
  });

  it("is ready with the starter as its title", () => {
    const view = chatView({
      key: hasKey,
      profile: { ok: true, value: completedProfile() },
      spend: spent(0),
      origin: { kind: "starter", starter: STARTERS[0] },
      opened: null,
    });
    expect(view.kind === "ready" && view.conversation.title).toBe(STARTERS[0].title);
  });

  it("is ready with the saved messages of a resumed session", () => {
    const view = chatView({
      key: hasKey,
      profile: { ok: true, value: completedProfile() },
      spend: spent(0),
      origin: { kind: "resume", sessionId: "s1" },
      opened: opened("active", 2),
    });
    expect(view.kind === "ready" && view.conversation.messages).toHaveLength(2);
  });

  it("is no_key when no key is saved, even if the profile read fails", () => {
    expect(
      chatView({
        key: { ok: true, value: false },
        profile: { ok: false, failure: "network" },
        spend: null,
        origin: free,
        opened: null,
      }),
    ).toEqual({ kind: "no_key" });
  });

  it("is failed with the key message and cause when the key read fails, even if the profile reads", () => {
    const cause = { name: "Error", detail: null };
    expect(
      chatView({
        key: { ok: false, failure: "not_read", cause },
        profile: { ok: true, value: completedProfile() },
        spend: null,
        origin: free,
        opened: null,
      }),
    ).toEqual({ kind: "failed", message: keyReadFailureMessage, cause });
  });

  it("is failed with the network message when the key is saved and the profile cannot be reached", () => {
    expect(
      chatView({
        key: hasKey,
        profile: { ok: false, failure: "network" },
        spend: null,
        origin: free,
        opened: null,
      }),
    ).toEqual({ kind: "failed", message: dataFailureMessage("network") });
  });

  it("is failed with the session-ended message when the profile read is unauthorized", () => {
    expect(
      chatView({
        key: hasKey,
        profile: { ok: false, failure: "unauthorized" },
        spend: null,
        origin: free,
        opened: null,
      }),
    ).toEqual({ kind: "failed", message: dataFailureMessage("unauthorized") });
  });

  it("is failed when the month spend cannot be read", () => {
    expect(
      chatView({
        key: hasKey,
        profile: { ok: true, value: completedProfile() },
        spend: { ok: false, failure: "unavailable" },
        origin: free,
        opened: null,
      }),
    ).toEqual({ kind: "failed", message: dataFailureMessage("unavailable") });
  });

  it("is failed when the session cannot be opened", () => {
    expect(
      chatView({
        key: hasKey,
        profile: { ok: true, value: completedProfile() },
        spend: spent(0),
        origin: { kind: "resume", sessionId: "s1" },
        opened: { ok: false, failure: "not_found" },
      }),
    ).toEqual({ kind: "failed", message: dataFailureMessage("not_found") });
  });

  it("is failed with the ended message for an ended session", () => {
    expect(
      chatView({
        key: hasKey,
        profile: { ok: true, value: completedProfile() },
        spend: spent(0),
        origin: { kind: "resume", sessionId: "s1" },
        opened: opened("ended"),
      }),
    ).toEqual({ kind: "failed", message: endedSessionMessage });
  });
});

describe("contextRefresh", () => {
  it("gives the new provider, limit and spend", () => {
    expect(
      contextRefresh({
        key: hasKey,
        profile: { ok: true, value: profileWith({ provider: "openai", monthlyLimitUsd: 5 }) },
        spend: spent(1),
      }),
    ).toEqual({
      kind: "event",
      event: { type: "context_refreshed", provider: "openai", limitUsd: 5, spentUsd: 1 },
    });
  });

  it("is no_key when the key is gone", () => {
    expect(
      contextRefresh({
        key: { ok: true, value: false },
        profile: { ok: false, failure: "network" },
        spend: { ok: false, failure: "network" },
      }),
    ).toEqual({ kind: "no_key" });
  });

  it("reports a key read failure as key_unreadable with its cause", () => {
    const cause = { name: "Error", detail: null };
    expect(
      contextRefresh({
        key: { ok: false, failure: "not_read", cause },
        profile: { ok: true, value: completedProfile() },
        spend: spent(0),
      }),
    ).toEqual({
      kind: "event",
      event: {
        type: "context_failed",
        failure: { source: "ai", failure: "key_unreadable", cause },
      },
    });
  });

  it("reports a profile or spend failure as a data failure", () => {
    expect(
      contextRefresh({
        key: hasKey,
        profile: { ok: false, failure: "unauthorized" },
        spend: spent(0),
      }),
    ).toEqual({
      kind: "event",
      event: { type: "context_failed", failure: { source: "data", failure: "unauthorized" } },
    });
    expect(
      contextRefresh({
        key: hasKey,
        profile: { ok: true, value: completedProfile() },
        spend: { ok: false, failure: "unavailable" },
      }),
    ).toEqual({
      kind: "event",
      event: { type: "context_failed", failure: { source: "data", failure: "unavailable" } },
    });
  });
});

describe("chatNotice", () => {
  function conversation(provider: "claude" | "openai", spentUsd: number) {
    return startConversation({
      origin: free,
      profile: profileWith({ provider, monthlyLimitUsd: 10 }),
      spentUsd,
    });
  }

  it("is null with nothing to say", () => {
    expect(chatNotice(conversation("claude", 1))).toBeNull();
  });

  it("warns near the limit", () => {
    expect(chatNotice(conversation("claude", 8))).toEqual({
      kind: "warning",
      message: spendWarningText,
    });
  });

  it("blocks at the limit with the limit message and its cause", () => {
    expect(chatNotice(conversation("claude", 10))).toEqual({
      kind: "limit",
      view: {
        message: limitReachedMessage,
        action: null,
        cause: { name: "SpendLimit", detail: null },
      },
    });
  });

  it("says OpenAI is coming soon", () => {
    expect(chatNotice(conversation("openai", 0))).toEqual({
      kind: "unsupported",
      message: unsupportedProviderMessage,
    });
  });

  it("shows a failure before any notice, with its action", () => {
    const failed = conversationReducer(conversation("claude", 8), {
      type: "context_failed",
      failure: { source: "ai", failure: "invalid_key" },
    });
    expect(chatNotice(failed)).toEqual({
      kind: "failure",
      view: {
        message: "Your API key was not accepted. Update it to keep chatting.",
        action: "update_key",
      },
    });
  });
});

describe("chatNotice for any state with the context fields", () => {
  it("accepts a plain context", () => {
    const context = { failure: null, provider: "claude", limitUsd: 10, spentUsd: 8 } as const;
    expect(chatNotice(context)).toEqual({ kind: "warning", message: spendWarningText });
    expect(chatNotice({ ...context, spentUsd: 10 })).toMatchObject({ kind: "limit" });
    expect(chatNotice({ ...context, provider: "openai" })).toMatchObject({ kind: "unsupported" });
    expect(chatNotice({ ...context, spentUsd: 0 })).toBeNull();
  });
});

describe("threadsRefresh", () => {
  it("turns a session read into threads_refreshed", () => {
    expect(threadsRefresh(opened("active", 1))).toEqual({
      type: "threads_refreshed",
      opened: opened("active", 1).value,
    });
  });

  it("turns a failure into a context failure with the data failure", () => {
    expect(threadsRefresh({ ok: false, failure: "network" })).toEqual({
      type: "context_failed",
      failure: { source: "data", failure: "network" },
    });
  });
});

describe("chatSubtitle", () => {
  it("draws the subtitle as the type and the tutor", () => {
    expect(chatSubtitle(null, "claude")).toBe("Free chat · Claude");
    expect(chatSubtitle("food", "claude")).toBe("Food · Claude");
  });

  it("names the tutor Tutor when there is no provider", () => {
    expect(chatSubtitle(null, null)).toBe("Free chat · Tutor");
  });
});

describe("chatTopicId", () => {
  const base = conversationOf(free);

  it("takes the topic from the session, else from the origin", () => {
    const session = { ...sessionOf("food"), id: "s1" };
    expect(chatTopicId({ session, origin: { kind: "topic", topicId: "music" } })).toBe("food");
    expect(chatTopicId({ session: null, origin: { kind: "topic", topicId: "music" } })).toBe(
      "music",
    );
    expect(chatTopicId({ session: null, origin: { kind: "starter", starter: STARTERS[0] } })).toBe(
      STARTERS[0].topicId,
    );
    expect(chatTopicId({ session: null, origin: free })).toBeNull();
    expect(chatTopicId({ session: null, origin: { kind: "resume", sessionId: "s1" } })).toBeNull();
    expect(chatTopicId({ session: sessionOf(null), origin: base.origin })).toBeNull();
  });
});

describe("originTitle", () => {
  it("is the starter's title", () => {
    expect(originTitle({ kind: "starter", starter: STARTERS[0] })).toBe(STARTERS[0].title);
  });

  it("is the topic's label for a topic chat before it opens", () => {
    expect(originTitle({ kind: "topic", topicId: "job_interviews" })).toBe("Job interviews");
  });

  it("is Free chat for a free chat", () => {
    expect(originTitle(free)).toBe("Free chat");
  });

  it("is Chat for a session whose title is not known", () => {
    expect(originTitle({ kind: "resume", sessionId: "s1" })).toBe("Chat");
  });
});

describe("providerLine", () => {
  it("is Claude for claude", () => {
    expect(providerLine("claude")).toBe("Claude");
  });

  it("is OpenAI for openai", () => {
    expect(providerLine("openai")).toBe("OpenAI");
  });

  it("is AI connected when no provider is recorded", () => {
    expect(providerLine(null)).toBe("AI connected");
  });

  it("keeps the no-key line fixed", () => {
    expect(noKeyProviderLine).toBe("No AI connected");
  });
});

describe("canSend", () => {
  it("allows sending text with a key", () => {
    expect(canSend("Hello", false)).toBe(true);
  });

  it("blocks an empty draft", () => {
    expect(canSend("", false)).toBe(false);
  });

  it("blocks a draft of only spaces", () => {
    expect(canSend("   ", false)).toBe(false);
  });

  it("blocks one character when locked", () => {
    expect(canSend("a", true)).toBe(false);
  });

  it("allows a single character", () => {
    expect(canSend("a", false)).toBe(true);
  });

  it("blocks sending while busy", () => {
    expect(canSend("Hello", false, true)).toBe(false);
  });

  it("allows sending when not busy", () => {
    expect(canSend("Hello", false, false)).toBe(true);
  });
});

describe("MAX_MESSAGE_LENGTH", () => {
  it("is the longest message the API saves", () => {
    expect(MAX_MESSAGE_LENGTH).toBe(4000);
  });
});

describe("endPromptButtons", () => {
  it("asks End this session? with Cancel first and End as destructive", () => {
    const buttons = endPromptButtons(() => {});

    expect(endPromptTitle).toBe("End this session?");
    expect(buttons.map((button) => [button.text, button.style])).toEqual([
      ["Cancel", "cancel"],
      ["End", "destructive"],
    ]);
  });

  it("End runs the given end action", () => {
    const calls: string[] = [];
    const buttons = endPromptButtons(() => calls.push("end"));

    buttons[1].onPress?.();

    expect(calls).toEqual(["end"]);
  });

  it("Cancel runs nothing", () => {
    const calls: string[] = [];
    const buttons = endPromptButtons(() => calls.push("end"));

    expect(buttons[0].onPress).toBeUndefined();
    expect(calls).toEqual([]);
  });
});
