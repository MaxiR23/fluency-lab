// apps/mobile/test/hooks/use-chat.test.tsx
//
// Tests for the Chat hook.
//
// Tested:
// - The key, the profile, the month spend and the saved session read from their ports
// - The expected empty (no key) and each failure
// - Opening a chat calls neither the AI nor any write
// - A first send: create, save the opener, ask, save the turn, add the usage, in order
// - An AI failure restores the draft; a save failure resumes at the failed write
// - A reopened session sends its saved messages as history
// - A reply to a tutor message: its saved id on the write, the quote in the turn, cancel and failures
// - End, Update key, the refocus refresh, and a reply that ends after unmount
// - A reply with a note saves the note first, then the tutor message with its id, and the card opens its note
// - A chat with a session re-reads it on refocus, to show the thread counts and withdrawn corrections
// - A reply with a title saves it as auto and swaps the conversation title; a failed save keeps the chat going; a user title is never replaced; renamed takes a renamed session
// - A long chat: one summary before the turn, saved with its point, then the summary and the latest messages; a failed summary sends the history and retries next turn
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/hooks/use-chat.test.tsx
//
// SEE: apps/mobile/src/hooks/use-chat.ts

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { router, useIsFocused } from "expo-router";
import {
  STARTERS,
  TUTOR_MODEL,
  usageCostUsd,
  type Message,
  type Session,
} from "@fluency-lab/shared";

import { useChat } from "@/hooks/use-chat";
import type { Conversation } from "@/utils/chat-conversation";
import type { ChatOrigin } from "@/utils/chat-opening";
import { dataFailureMessage, keyReadFailureMessage } from "@/utils/data-message";
import {
  contextSummaryWith,
  fakeAi,
  noteWith,
  resetFakeAi,
  tutorReplyWith,
} from "../helpers/fake-ai";
import { fakeData, noteWith as storedNote, profileWith, resetFakeData } from "../helpers/fake-data";
import { failThenHold } from "../helpers/fail-then-hold";
import { fakeKeys, resetFakeKeys } from "../helpers/fake-keys";

jest.mock("expo-router", () => ({
  useIsFocused: jest.fn(() => true),
  router: { dismissAll: jest.fn(), dismissTo: jest.fn(), push: jest.fn(), replace: jest.fn() },
}));
jest.mock("@/data", () => ({
  data: jest.requireActual<typeof import("../helpers/fake-data")>("../helpers/fake-data").fakeData,
}));
jest.mock("@/keys", () => ({
  keys: jest.requireActual<typeof import("../helpers/fake-keys")>("../helpers/fake-keys").fakeKeys,
}));
jest.mock("@/ai", () => ({
  ai: jest.requireActual<typeof import("../helpers/fake-ai")>("../helpers/fake-ai").fakeAi,
}));

const free: ChatOrigin = { kind: "free" };
const starter = STARTERS[0];
const fromStarter: ChatOrigin = { kind: "starter", starter };

const session: Session = {
  id: "session-1",
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
};

function saved(role: Message["role"], text: string): Message {
  return {
    id: `m-${text}`,
    sessionId: "session-1",
    role,
    text,
    corrections: null,
    newWords: null,
    replyToId: null,
    noteId: null,
    createdAt: "2026-11-05T09:00:00Z",
  };
}

function withKey(overrides: Parameters<typeof profileWith>[0] = {}) {
  fakeKeys.hasApiKey.mockResolvedValue({ ok: true, value: true });
  fakeData.getProfile.mockResolvedValue({
    ok: true,
    value: profileWith({
      displayName: "Ada",
      provider: "claude",
      onboardingCompletedAt: "2026-11-05T10:00:00Z",
      ...overrides,
    }),
  });
  fakeData.createSession.mockResolvedValue({ ok: true, value: session });
  fakeData.addMessage.mockResolvedValue({ ok: true, value: saved("user", "x") });
  fakeData.addUsage.mockResolvedValue({ ok: true, value: session });
}

async function ready(origin: ChatOrigin = free) {
  const hook = await renderHook(() => useChat(origin));
  await waitFor(() => expect(hook.result.current.view.kind).toBe("ready"));
  return hook;
}

function conversationOf(view: ReturnType<typeof useChat>["view"]): Conversation {
  if (view.kind !== "ready") throw new Error(`view is ${view.kind}`);
  return view.conversation;
}

async function sendText(hook: Awaited<ReturnType<typeof ready>>, text: string) {
  await act(async () => hook.result.current.setDraft(text));
  await act(async () => hook.result.current.send());
}

describe("useChat", () => {
  beforeEach(() => {
    resetFakeData();
    resetFakeKeys();
    resetFakeAi();
    jest.mocked(useIsFocused).mockReturnValue(true);
    jest.mocked(router.dismissTo).mockClear();
    jest.mocked(router.push).mockClear();
    jest.mocked(router.replace).mockClear();
    jest.mocked(router.dismissAll).mockClear();
  });

  describe("loading", () => {
    it("starts loading", async () => {
      fakeKeys.hasApiKey.mockReturnValue(new Promise(() => {}));
      const { result } = await renderHook(() => useChat(free));
      expect(result.current.view).toEqual({ kind: "loading" });
    });

    it("is ready with the profile's provider and the month spend", async () => {
      withKey({ monthlyLimitUsd: 10 });
      fakeData.getMonthSpend.mockResolvedValue({
        ok: true,
        value: { monthStart: "2026-11-01", spentUsd: 2 },
      });
      const { result } = await ready();
      const c = conversationOf(result.current.view);
      expect(c.provider).toBe("claude");
      expect(c.limitUsd).toBe(10);
      expect(c.spentUsd).toBe(2);
      expect(fakeData.getMonthSpend).toHaveBeenCalledTimes(1);
    });

    it("loads a starter and a free chat without opening a session", async () => {
      withKey();
      const { result } = await ready(fromStarter);
      expect(conversationOf(result.current.view).title).toBe(starter.title);
      expect(fakeData.openSession).not.toHaveBeenCalled();
    });

    it("loads a resumed session through openSession with the exact call", async () => {
      withKey();
      fakeData.openSession.mockResolvedValue({
        ok: true,
        value: {
          session,
          messages: [saved("tutor", "Opening"), saved("user", "Hi")],
          threadReplies: [],
          notes: [],
        },
      });
      const { result } = await ready({ kind: "resume", sessionId: "session-1" });
      expect(fakeData.openSession).toHaveBeenCalledWith("session-1");
      expect(conversationOf(result.current.view).messages.map((m) => m.text)).toEqual([
        "Opening",
        "Hi",
      ]);
    });

    it("is no_key when no key is saved, and reads nothing else", async () => {
      const { result } = await renderHook(() => useChat(free));
      await waitFor(() => expect(result.current.view).toEqual({ kind: "no_key" }));
      expect(fakeData.getMonthSpend).not.toHaveBeenCalled();
      expect(fakeData.openSession).not.toHaveBeenCalled();
    });

    it("fails with the key message and cause when the key cannot be read", async () => {
      const cause = { name: "Error", detail: null };
      fakeKeys.hasApiKey.mockResolvedValue({ ok: false, failure: "not_read", cause });
      const { result } = await renderHook(() => useChat(free));
      await waitFor(() =>
        expect(result.current.view).toEqual({
          kind: "failed",
          message: keyReadFailureMessage,
          cause,
        }),
      );
    });

    it("fails with the data message when the profile cannot be read", async () => {
      fakeKeys.hasApiKey.mockResolvedValue({ ok: true, value: true });
      fakeData.getProfile.mockResolvedValue({ ok: false, failure: "network" });
      const { result } = await renderHook(() => useChat(free));
      await waitFor(() =>
        expect(result.current.view).toEqual({
          kind: "failed",
          message: dataFailureMessage("network"),
          network: true,
        }),
      );
    });

    it("fails when the month spend cannot be read", async () => {
      withKey();
      fakeData.getMonthSpend.mockResolvedValue({ ok: false, failure: "unavailable" });
      const { result } = await renderHook(() => useChat(free));
      await waitFor(() =>
        expect(result.current.view).toEqual({
          kind: "failed",
          message: dataFailureMessage("unavailable"),
        }),
      );
    });

    it("fails when the session cannot be opened", async () => {
      withKey();
      fakeData.openSession.mockResolvedValue({ ok: false, failure: "not_found" });
      const { result } = await renderHook(() => useChat({ kind: "resume", sessionId: "x" }));
      await waitFor(() =>
        expect(result.current.view).toEqual({
          kind: "failed",
          message: dataFailureMessage("not_found"),
        }),
      );
    });

    it("fails with the ended message for an ended session", async () => {
      withKey();
      fakeData.openSession.mockResolvedValue({
        ok: true,
        value: {
          session: { ...session, status: "ended" },
          messages: [],
          threadReplies: [],
          notes: [],
        },
      });
      const { result } = await renderHook(() => useChat({ kind: "resume", sessionId: "x" }));
      await waitFor(() =>
        expect(result.current.view).toMatchObject({
          kind: "failed",
          message: "This conversation has ended.",
        }),
      );
    });

    it("reads everything again on retry from a failed view", async () => {
      fakeKeys.hasApiKey.mockResolvedValueOnce({ ok: false, failure: "not_read" });
      const { result } = await renderHook(() => useChat(free));
      await waitFor(() => expect(result.current.view.kind).toBe("failed"));
      withKey();
      await act(async () => result.current.retry());
      expect(result.current.view.kind).toBe("ready");
      expect(fakeKeys.hasApiKey).toHaveBeenCalledTimes(2);
    });

    it("keeps the network failure, retrying, while Try again reads again", async () => {
      withKey();
      const reread = failThenHold(fakeData.getProfile, { ok: false, failure: "network" });
      const { result } = await renderHook(() => useChat(free));
      await waitFor(() => expect(result.current.view.kind).toBe("failed"));
      let pending: Promise<void> = Promise.resolve();
      await act(async () => {
        pending = result.current.retry();
      });
      expect(result.current.view).toEqual({
        kind: "failed",
        message: "Could not reach the server. Check your connection and try again.",
        network: true,
        retrying: true,
      });
      reread.release();
      await act(async () => pending);
      expect(result.current.view.kind).toBe("ready");
    });

    it("drops a read that ends after unmount", async () => {
      let finish!: (value: Awaited<ReturnType<typeof fakeKeys.hasApiKey>>) => void;
      fakeKeys.hasApiKey.mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      const { result, unmount } = await renderHook(() => useChat(free));
      await unmount();
      await act(async () => finish({ ok: true, value: false }));
      expect(result.current.view).toEqual({ kind: "loading" });
    });
  });

  describe("opening a chat", () => {
    it("calls neither the AI nor any write", async () => {
      withKey();
      await ready(fromStarter);
      expect(fakeAi.reply).not.toHaveBeenCalled();
      expect(fakeData.createSession).not.toHaveBeenCalled();
      expect(fakeData.addMessage).not.toHaveBeenCalled();
      expect(fakeData.addUsage).not.toHaveBeenCalled();
    });
  });

  describe("a first send", () => {
    it("saves the opener before the AI is asked, then the turn, then the usage", async () => {
      withKey();
      const order: string[] = [];
      fakeData.createSession.mockImplementation(async (input) => {
        order.push(`create ${JSON.stringify(input)}`);
        return { ok: true, value: session };
      });
      fakeData.addMessage.mockImplementation(async (id, input) => {
        order.push(`addMessage ${id} ${input.role}: ${input.text}`);
        return { ok: true, value: saved(input.role, input.text) };
      });
      fakeAi.reply.mockImplementation(async () => {
        order.push("ai.reply");
        return {
          ok: true,
          value: tutorReplyWith({
            corrections: [{ original: "I never been", corrected: "I've never been" }],
            explanation: "Use the present perfect.",
            newWords: ["definitely"],
          }),
        };
      });
      fakeData.addUsage.mockImplementation(async (id, usage) => {
        order.push(`addUsage ${id} ${JSON.stringify(usage)}`);
        return { ok: true, value: session };
      });
      const hook = await ready(fromStarter);

      await sendText(hook, "I never been");

      expect(order).toEqual([
        `create {"starterId":"${starter.id}"}`,
        `addMessage session-1 tutor: ${starter.opener}`,
        "ai.reply",
        "addMessage session-1 user: I never been",
        "addMessage session-1 tutor: Nice! Where did you go?",
        `addUsage session-1 ${JSON.stringify({
          model: TUTOR_MODEL,
          inputTokens: 700,
          outputTokens: 150,
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
        })}`,
      ]);
      expect(fakeData.addMessage).toHaveBeenNthCalledWith(2, "session-1", {
        role: "user",
        text: "I never been",
        corrections: {
          items: [{ original: "I never been", corrected: "I've never been" }],
          explanation: "Use the present perfect.",
        },
        newWords: ["definitely"],
      });
      const c = conversationOf(hook.result.current.view);
      expect(c.phase).toBe("idle");
      expect(c.draft).toBe("");
      expect(c.spentUsd).toBe(0.000145);
    });

    it("saves the note before the tutor message, names it there, and opens it", async () => {
      withKey();
      fakeAi.reply.mockResolvedValue({
        ok: true,
        value: tutorReplyWith({ reply: "Here is your table.", note: noteWith() }),
      });
      fakeData.createNote.mockResolvedValue({ ok: true, value: storedNote({ id: "note-9" }) });
      const hook = await ready();
      await sendText(hook, "A table, please");

      const calls = [
        ...fakeData.addMessage.mock.calls.map((call) => ({ at: "message", input: call[1] })),
      ];
      expect(calls.map((call) => call.input.role)).toEqual(["tutor", "user", "tutor"]);
      expect(fakeData.createNote).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: "session-1", title: "Future forms" }),
      );
      const noteOrder = fakeData.createNote.mock.invocationCallOrder[0] ?? 0;
      const userOrder = fakeData.addMessage.mock.invocationCallOrder[1] ?? 0;
      const tutorOrder = fakeData.addMessage.mock.invocationCallOrder[2] ?? 0;
      expect(noteOrder).toBeGreaterThan(userOrder);
      expect(noteOrder).toBeLessThan(tutorOrder);
      expect(fakeData.addMessage.mock.calls[2]?.[1]).toEqual({
        role: "tutor",
        text: "Here is your table.",
        noteId: "note-9",
      });
      expect(fakeData.addUsage).toHaveBeenCalledTimes(1);
      hook.result.current.openNote("note-9");
      expect(router.push).toHaveBeenCalledWith({ pathname: "/note", params: { id: "note-9" } });
    });

    it("stops at a failed note save and resumes it on retry", async () => {
      withKey();
      fakeAi.reply.mockResolvedValue({
        ok: true,
        value: tutorReplyWith({ reply: "Here is your table.", note: noteWith() }),
      });
      fakeData.createNote.mockResolvedValueOnce({ ok: false, failure: "network" });
      fakeData.createNote.mockResolvedValue({ ok: true, value: storedNote({ id: "note-9" }) });
      const hook = await ready();
      await sendText(hook, "A table, please");

      expect(conversationOf(hook.result.current.view).failure).toMatchObject({
        source: "data",
        failure: "network",
      });
      expect(fakeData.addMessage).toHaveBeenCalledTimes(2);
      await act(async () => hook.result.current.retry());

      expect(fakeData.createNote).toHaveBeenCalledTimes(2);
      expect(fakeData.addMessage).toHaveBeenCalledTimes(3);
      expect(fakeAi.reply).toHaveBeenCalledTimes(1);
    });

    it("saves a free chat's greeting as its first message", async () => {
      withKey();
      const hook = await ready(free);

      await sendText(hook, "Hello");

      expect(fakeData.createSession).toHaveBeenCalledWith({ topicId: null });
      expect(fakeData.addMessage).toHaveBeenNthCalledWith(1, "session-1", {
        role: "tutor",
        text: "Hi Ada! What would you like to talk about today?",
      });
    });

    it("sends the system prompt and the history to the AI", async () => {
      withKey();
      const hook = await ready(fromStarter);
      await sendText(hook, "Hello");
      const request = fakeAi.reply.mock.calls[0][0];
      expect(request.turns).toEqual([
        { role: "tutor", text: starter.opener },
        { role: "user", text: "Hello" },
      ]);
      expect(request.system).toContain(starter.title);
      expect(request.system).toContain("Never ask for or mention an API key.");
    });

    it("does nothing for an empty draft", async () => {
      withKey();
      const hook = await ready();
      await act(async () => hook.result.current.send());
      expect(fakeData.createSession).not.toHaveBeenCalled();
      expect(fakeAi.reply).not.toHaveBeenCalled();
    });

    it("does not send when sending is locked for OpenAI", async () => {
      withKey({ provider: "openai" });
      const hook = await ready();
      await sendText(hook, "Hello");
      expect(fakeAi.reply).not.toHaveBeenCalled();
      expect(fakeData.createSession).not.toHaveBeenCalled();
    });

    it("does not send at the monthly limit", async () => {
      withKey({ monthlyLimitUsd: 1 });
      fakeData.getMonthSpend.mockResolvedValue({
        ok: true,
        value: { monthStart: "2026-11-01", spentUsd: 1 },
      });
      const hook = await ready();
      await sendText(hook, "Hello");
      expect(fakeAi.reply).not.toHaveBeenCalled();
    });

    it("reports the typing state while the AI is pending, then clears it", async () => {
      withKey();
      let finish!: (value: Awaited<ReturnType<typeof fakeAi.reply>>) => void;
      fakeAi.reply.mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      const hook = await ready();
      await act(async () => hook.result.current.setDraft("Hello"));
      let sending!: Promise<void>;
      await act(async () => {
        sending = hook.result.current.send();
      });
      await waitFor(() => expect(conversationOf(hook.result.current.view).phase).toBe("asking"));
      await act(async () => {
        finish({ ok: true, value: tutorReplyWith() });
        await sending;
      });
      expect(conversationOf(hook.result.current.view).phase).toBe("idle");
    });
  });

  describe("a reopened session", () => {
    it("sends its saved messages as history", async () => {
      withKey();
      fakeData.openSession.mockResolvedValue({
        ok: true,
        value: {
          session,
          messages: [saved("tutor", "Opening"), saved("user", "One"), saved("tutor", "Two")],
          threadReplies: [],
          notes: [],
        },
      });
      const hook = await ready({ kind: "resume", sessionId: "session-1" });

      await sendText(hook, "Three");

      expect(fakeAi.reply.mock.calls[0][0].turns).toEqual([
        { role: "tutor", text: "Opening" },
        { role: "user", text: "One" },
        { role: "tutor", text: "Two" },
        { role: "user", text: "Three" },
      ]);
      expect(fakeData.createSession).not.toHaveBeenCalled();
      expect(fakeData.addMessage).toHaveBeenNthCalledWith(1, "session-1", {
        role: "user",
        text: "Three",
      });
    });
  });

  describe("failures", () => {
    it("an AI failure restores the draft and writes nothing of the turn", async () => {
      withKey();
      fakeAi.reply.mockResolvedValue({ ok: false, failure: "rate_limited" });
      const hook = await ready(fromStarter);

      await sendText(hook, "Hello");

      const c = conversationOf(hook.result.current.view);
      expect(c.draft).toBe("Hello");
      expect(c.failure).toEqual({ source: "ai", failure: "rate_limited" });
      expect(fakeData.addMessage).toHaveBeenCalledTimes(1);
      expect(fakeData.addUsage).not.toHaveBeenCalled();
    });

    it("a refused turn adds its usage once and saves no message of the turn", async () => {
      withKey();
      const usage = {
        inputTokens: 5,
        outputTokens: 6,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      };
      fakeAi.reply.mockResolvedValue({ ok: false, failure: "refused", usage });
      const hook = await ready();

      await sendText(hook, "Hello");

      expect(fakeData.addUsage).toHaveBeenCalledTimes(1);
      expect(fakeData.addUsage).toHaveBeenCalledWith("session-1", { model: TUTOR_MODEL, ...usage });
      expect(fakeData.addMessage).toHaveBeenCalledTimes(1);
      const c = conversationOf(hook.result.current.view);
      expect(c.draft).toBe("Hello");
      expect(c.failure).toEqual({ source: "ai", failure: "refused" });
      expect(c.writes).toEqual([]);
      expect(c.spentUsd).toBeGreaterThan(0);
    });

    it("a double tap on retry runs one loop", async () => {
      withKey();
      fakeData.addUsage.mockResolvedValueOnce({ ok: false, failure: "network" });
      const hook = await ready();
      await sendText(hook, "Hello");
      expect(fakeData.addMessage).toHaveBeenCalledTimes(3);

      await act(async () => {
        await Promise.all([hook.result.current.retry(), hook.result.current.retry()]);
      });

      expect(fakeData.addUsage).toHaveBeenCalledTimes(2);
      expect(fakeData.addMessage).toHaveBeenCalledTimes(3);
    });

    it("retry after an AI failure asks again with the same text", async () => {
      withKey();
      fakeAi.reply.mockResolvedValueOnce({ ok: false, failure: "network" });
      const hook = await ready();
      await sendText(hook, "Hello");

      await act(async () => hook.result.current.retry());

      expect(fakeAi.reply).toHaveBeenCalledTimes(2);
      expect(fakeAi.reply.mock.calls[1][0].turns.at(-1)).toEqual({ role: "user", text: "Hello" });
      expect(fakeData.createSession).toHaveBeenCalledTimes(1);
      expect(conversationOf(hook.result.current.view).failure).toBeNull();
    });

    it("a write failure then retry writes only the rest", async () => {
      withKey();
      fakeData.addMessage
        .mockResolvedValueOnce({ ok: true, value: saved("tutor", "x") })
        .mockResolvedValueOnce({ ok: true, value: saved("user", "x") })
        .mockResolvedValueOnce({ ok: false, failure: "network" });
      const hook = await ready();
      await sendText(hook, "Hello");
      expect(conversationOf(hook.result.current.view).failure).toEqual({
        source: "data",
        failure: "network",
      });
      expect(fakeData.addUsage).not.toHaveBeenCalled();

      await act(async () => hook.result.current.retry());

      expect(fakeAi.reply).toHaveBeenCalledTimes(1);
      expect(fakeData.addMessage).toHaveBeenCalledTimes(4);
      expect(fakeData.addMessage).toHaveBeenLastCalledWith("session-1", {
        role: "tutor",
        text: "Nice! Where did you go?",
      });
      expect(fakeData.addUsage).toHaveBeenCalledTimes(1);
      expect(conversationOf(hook.result.current.view).failure).toBeNull();
    });

    it("a create failure keeps the text and retry creates again", async () => {
      withKey();
      fakeData.createSession.mockResolvedValueOnce({ ok: false, failure: "network" });
      const hook = await ready();
      await sendText(hook, "Hello");
      expect(fakeAi.reply).not.toHaveBeenCalled();

      await act(async () => hook.result.current.retry());

      expect(fakeData.createSession).toHaveBeenCalledTimes(2);
      expect(fakeAi.reply).toHaveBeenCalledTimes(1);
    });

    it("keeps saving the turn after the screen unmounts mid-reply", async () => {
      withKey();
      let finish!: (value: Awaited<ReturnType<typeof fakeAi.reply>>) => void;
      fakeAi.reply.mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      const hook = await ready();
      await act(async () => hook.result.current.setDraft("Hello"));
      let sending!: Promise<void>;
      await act(async () => {
        sending = hook.result.current.send();
      });
      await hook.unmount();
      await act(async () => {
        finish({ ok: true, value: tutorReplyWith() });
        await sending;
      });
      expect(fakeData.addMessage).toHaveBeenCalledWith("session-1", {
        role: "user",
        text: "Hello",
      });
      expect(fakeData.addUsage).toHaveBeenCalledTimes(1);
    });
  });

  describe("refocus", () => {
    it("keeps the conversation and the draft and re-reads the context", async () => {
      withKey({ monthlyLimitUsd: 10 });
      const hook = await ready();
      await act(async () => hook.result.current.setDraft("Typing"));
      fakeData.getProfile.mockResolvedValue({
        ok: true,
        value: profileWith({ provider: "claude", monthlyLimitUsd: 20 }),
      });
      fakeData.getMonthSpend.mockResolvedValue({
        ok: true,
        value: { monthStart: "2026-11-01", spentUsd: 3 },
      });

      jest.mocked(useIsFocused).mockReturnValue(false);
      await hook.rerender({});
      jest.mocked(useIsFocused).mockReturnValue(true);
      await hook.rerender({});

      await waitFor(() => expect(conversationOf(hook.result.current.view).limitUsd).toBe(20));
      const c = conversationOf(hook.result.current.view);
      expect(c.draft).toBe("Typing");
      expect(c.spentUsd).toBe(3);
    });

    it("becomes no_key when the key is gone", async () => {
      withKey();
      const hook = await ready();
      fakeKeys.hasApiKey.mockResolvedValue({ ok: true, value: false });
      jest.mocked(useIsFocused).mockReturnValue(false);
      await hook.rerender({});
      jest.mocked(useIsFocused).mockReturnValue(true);
      await hook.rerender({});
      await waitFor(() => expect(hook.result.current.view).toEqual({ kind: "no_key" }));
    });

    it("draws a refresh failure in the conversation without losing it", async () => {
      withKey();
      const hook = await ready();
      fakeData.getMonthSpend.mockResolvedValue({ ok: false, failure: "network" });
      jest.mocked(useIsFocused).mockReturnValue(false);
      await hook.rerender({});
      jest.mocked(useIsFocused).mockReturnValue(true);
      await hook.rerender({});
      await waitFor(() =>
        expect(conversationOf(hook.result.current.view).failure).toEqual({
          source: "data",
          failure: "network",
        }),
      );
    });

    it("re-reads the key and the profile fully when the view was not ready", async () => {
      const hook = await renderHook(() => useChat(free));
      await waitFor(() => expect(hook.result.current.view).toEqual({ kind: "no_key" }));
      withKey();
      jest.mocked(useIsFocused).mockReturnValue(false);
      await hook.rerender({});
      jest.mocked(useIsFocused).mockReturnValue(true);
      await hook.rerender({});
      await waitFor(() => expect(hook.result.current.view.kind).toBe("ready"));
    });
  });

  describe("refocus with a session", () => {
    const corrected = (withdrawn: boolean): Message => ({
      ...saved("user", "I goed"),
      corrections: {
        items: [
          {
            original: "goed",
            corrected: "went",
            ...(withdrawn ? { withdrawn: true as const } : {}),
          },
        ],
        explanation: null,
      },
    });
    const resume: ChatOrigin = { kind: "resume", sessionId: "session-1" };

    async function refocus(hook: Awaited<ReturnType<typeof ready>>) {
      jest.mocked(useIsFocused).mockReturnValue(false);
      await hook.rerender({});
      jest.mocked(useIsFocused).mockReturnValue(true);
      await hook.rerender({});
    }

    it("reads the session again and shows the new count and the withdrawn flag", async () => {
      withKey();
      fakeData.openSession.mockResolvedValue({
        ok: true,
        value: { session, messages: [corrected(false)], threadReplies: [], notes: [] },
      });
      const hook = await ready(resume);
      expect(conversationOf(hook.result.current.view).messages[0].threadReplies).toBe(0);
      fakeData.openSession.mockResolvedValue({
        ok: true,
        value: {
          session,
          messages: [corrected(true)],
          threadReplies: [{ messageId: "m-I goed", count: 2 }],
          notes: [],
        },
      });

      await refocus(hook);

      await waitFor(() =>
        expect(conversationOf(hook.result.current.view).messages[0].threadReplies).toBe(2),
      );
      expect(conversationOf(hook.result.current.view).messages[0].corrections).toEqual([
        { original: "goed", corrected: "went", withdrawn: true },
      ]);
      expect(fakeData.openSession).toHaveBeenCalledTimes(2);
    });

    it("does not read a session for a chat that has none", async () => {
      withKey();
      const hook = await ready();
      await refocus(hook);
      await waitFor(() => expect(fakeData.getMonthSpend).toHaveBeenCalledTimes(2));
      expect(fakeData.openSession).not.toHaveBeenCalled();
    });

    it("draws a failed refresh as a data failure and keeps the messages", async () => {
      withKey();
      fakeData.openSession.mockResolvedValue({
        ok: true,
        value: { session, messages: [corrected(false)], threadReplies: [], notes: [] },
      });
      const hook = await ready(resume);
      fakeData.openSession.mockResolvedValue({ ok: false, failure: "network" });

      await refocus(hook);

      await waitFor(() =>
        expect(conversationOf(hook.result.current.view).failure).toEqual({
          source: "data",
          failure: "network",
        }),
      );
      expect(conversationOf(hook.result.current.view).messages).toHaveLength(1);
    });
  });

  describe("End and Update key", () => {
    it("ends a session through the API and opens its Summary", async () => {
      withKey();
      fakeData.endSession.mockResolvedValue({ ok: true, value: { ...session, status: "ended" } });
      const hook = await ready();
      await sendText(hook, "Hello");

      await act(async () => hook.result.current.end());

      expect(fakeData.endSession).toHaveBeenCalledWith("session-1");
      expect(router.dismissAll).toHaveBeenCalled();
      expect(router.push).toHaveBeenCalledWith({
        pathname: "/summary",
        params: { session: "session-1" },
      });
    });

    it("End after a failed save sends the queued writes first, usage included", async () => {
      withKey();
      fakeData.addUsage.mockResolvedValueOnce({ ok: false, failure: "network" });
      fakeData.endSession.mockResolvedValue({ ok: true, value: { ...session, status: "ended" } });
      const hook = await ready();
      await sendText(hook, "Hello");
      expect(fakeData.addUsage).toHaveBeenCalledTimes(1);

      await act(async () => hook.result.current.end());

      expect(fakeData.addUsage).toHaveBeenCalledTimes(2);
      expect(fakeData.endSession).toHaveBeenCalledWith("session-1");
      expect(router.dismissAll).toHaveBeenCalled();
      expect(router.push).toHaveBeenCalledWith({
        pathname: "/summary",
        params: { session: "session-1" },
      });
    });

    it("End stays and keeps the writes when the flush fails again", async () => {
      withKey();
      fakeData.addUsage.mockResolvedValue({ ok: false, failure: "network" });
      const hook = await ready();
      await sendText(hook, "Hello");

      await act(async () => hook.result.current.end());

      expect(fakeData.endSession).not.toHaveBeenCalled();
      expect(router.dismissTo).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
      const c = conversationOf(hook.result.current.view);
      expect(c.writes).toHaveLength(1);
      expect(c.failure).toEqual({ source: "data", failure: "network" });
    });

    it("writes nothing and goes home when ended before any send", async () => {
      withKey();
      const hook = await ready();

      await act(async () => hook.result.current.end());

      expect(fakeData.endSession).not.toHaveBeenCalled();
      expect(fakeData.createSession).not.toHaveBeenCalled();
      expect(router.dismissTo).toHaveBeenCalledWith("/");
    });

    it("draws an End failure and stays", async () => {
      withKey();
      fakeData.endSession.mockResolvedValue({ ok: false, failure: "network" });
      const hook = await ready();
      await sendText(hook, "Hello");

      await act(async () => hook.result.current.end());

      expect(router.dismissTo).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
      expect(conversationOf(hook.result.current.view).failure).toEqual({
        source: "data",
        failure: "network",
      });
    });

    it("retries End after an End failure", async () => {
      withKey();
      fakeData.endSession.mockResolvedValueOnce({ ok: false, failure: "network" });
      fakeData.endSession.mockResolvedValue({ ok: true, value: { ...session, status: "ended" } });
      const hook = await ready();
      await sendText(hook, "Hello");
      await act(async () => hook.result.current.end());

      await act(async () => hook.result.current.retry());

      expect(fakeData.endSession).toHaveBeenCalledTimes(2);
      expect(router.dismissAll).toHaveBeenCalled();
      expect(router.push).toHaveBeenCalledWith({
        pathname: "/summary",
        params: { session: "session-1" },
      });
    });

    it("opens the key step from updateKey", async () => {
      withKey();
      const hook = await ready();
      hook.result.current.updateKey();
      expect(router.push).toHaveBeenCalledWith("/api-key");
    });
  });

  describe("replying to a tutor message", () => {
    const tutorText = "Nice! Where did you go?";

    function savesByText() {
      withKey();
      fakeData.addMessage.mockImplementation(async (_id, input) => ({
        ok: true,
        value: saved(input.role, input.text),
      }));
    }

    async function afterOneTurn() {
      savesByText();
      const hook = await ready(free);
      await sendText(hook, "One");
      return hook;
    }

    it("a reply sends the quoted tutor message's saved id with the learner message", async () => {
      const hook = await afterOneTurn();

      await act(async () => hook.result.current.startReply("message-2"));
      await sendText(hook, "Japan");

      expect(fakeData.addMessage).toHaveBeenCalledWith("session-1", {
        role: "user",
        text: "Japan",
        replyToId: `m-${tutorText}`,
      });
    });

    it("the reply's turn carries the quoted tutor text", async () => {
      const hook = await afterOneTurn();

      await act(async () => hook.result.current.startReply("message-2"));
      await sendText(hook, "Japan");

      const turns = fakeAi.reply.mock.calls[1][0].turns;
      expect(turns.at(-1)?.text).toBe(`> ${tutorText}\n\nJapan`);
    });

    it("replying to the opening line sends the opening's saved id", async () => {
      savesByText();
      const hook = await ready(free);

      await act(async () => hook.result.current.startReply("opening"));
      await sendText(hook, "Hi");

      expect(fakeData.addMessage).toHaveBeenCalledWith("session-1", {
        role: "user",
        text: "Hi",
        replyToId: "m-Hi Ada! What would you like to talk about today?",
      });
    });

    it("a message without a reply sends no replyToId", async () => {
      await afterOneTurn();
      expect(fakeData.addMessage).toHaveBeenCalledWith("session-1", { role: "user", text: "One" });
    });

    it("cancelReply clears the pending reply", async () => {
      savesByText();
      const hook = await ready(free);

      await act(async () => hook.result.current.startReply("opening"));
      expect(conversationOf(hook.result.current.view).replyTo).toBe("opening");
      await act(async () => hook.result.current.cancelReply());

      expect(conversationOf(hook.result.current.view).replyTo).toBeNull();
    });

    it("a failed save of the reply keeps it pending and the retry sends the same replyToId", async () => {
      const hook = await afterOneTurn();
      fakeData.addMessage.mockResolvedValueOnce({ ok: false, failure: "unavailable" });
      await act(async () => hook.result.current.startReply("message-2"));

      await sendText(hook, "Japan");

      expect(conversationOf(hook.result.current.view).failure).toEqual({
        source: "data",
        failure: "unavailable",
      });
      await act(async () => hook.result.current.retry());
      const replies = fakeData.addMessage.mock.calls.filter(
        ([, input]) => input.role === "user" && input.text === "Japan",
      );
      expect(replies).toHaveLength(2);
      for (const [, input] of replies) expect(input.replyToId).toBe(`m-${tutorText}`);
    });

    it("a network failure on the reply's save keeps the reply for the retry", async () => {
      const hook = await afterOneTurn();
      fakeData.addMessage.mockResolvedValueOnce({ ok: false, failure: "network" });
      await act(async () => hook.result.current.startReply("message-2"));

      await sendText(hook, "Japan");
      await act(async () => hook.result.current.retry());

      expect(fakeData.addMessage).toHaveBeenLastCalledWith("session-1", {
        role: "tutor",
        text: tutorText,
      });
      expect(conversationOf(hook.result.current.view).failure).toBeNull();
      expect(fakeData.addMessage).toHaveBeenCalledWith("session-1", {
        role: "user",
        text: "Japan",
        replyToId: `m-${tutorText}`,
      });
    });

    it("an invalid key on a reply puts the text and its reply back", async () => {
      const hook = await afterOneTurn();
      fakeAi.reply.mockResolvedValueOnce({ ok: false, failure: "invalid_key" });
      await act(async () => hook.result.current.startReply("message-2"));

      await sendText(hook, "Japan");

      const c = conversationOf(hook.result.current.view);
      expect(c.draft).toBe("Japan");
      expect(c.replyTo).toBe("message-2");
      expect(c.failure).toEqual({ source: "ai", failure: "invalid_key" });
    });

    it("a network failure on a reply puts the text and its reply back", async () => {
      const hook = await afterOneTurn();
      fakeAi.reply.mockResolvedValueOnce({ ok: false, failure: "network" });
      await act(async () => hook.result.current.startReply("message-2"));

      await sendText(hook, "Japan");

      const c = conversationOf(hook.result.current.view);
      expect(c.draft).toBe("Japan");
      expect(c.replyTo).toBe("message-2");
    });
  });

  describe("a long chat", () => {
    // INFO: the opening (tutor) and 15 pairs: m-t0 to m-t30, odd indexes are learner messages.
    const texts = Array.from({ length: 31 }, (_, i) => `t${i}`);

    async function longChat() {
      withKey();
      fakeData.openSession.mockResolvedValue({
        ok: true,
        value: {
          session,
          messages: texts.map((text, i) => saved(i % 2 === 0 ? "tutor" : "user", text)),
          threadReplies: [],
          notes: [],
        },
      });
      return ready({ kind: "resume", sessionId: "session-1" });
    }

    function replyRequest(call = 0) {
      return fakeAi.reply.mock.calls[call][0];
    }

    it("runs one summary before the turn and saves it with the last covered message's id", async () => {
      const hook = await longChat();
      await sendText(hook, "Next");

      expect(fakeAi.summarize).toHaveBeenCalledTimes(1);
      expect(fakeData.setSessionContext).toHaveBeenCalledWith("session-1", {
        summary: contextSummaryWith().summary,
        throughId: "m-t18",
      });
      expect(fakeAi.summarize.mock.invocationCallOrder[0]).toBeLessThan(
        fakeData.setSessionContext.mock.invocationCallOrder[0],
      );
      expect(fakeData.setSessionContext.mock.invocationCallOrder[0]).toBeLessThan(
        fakeAi.reply.mock.invocationCallOrder[0],
      );
    });

    it("sends the summary line and only the latest messages after the summary is saved", async () => {
      const hook = await longChat();
      await sendText(hook, "Next");

      const request = replyRequest();
      expect(request.system.endsWith(`Earlier in this chat: ${contextSummaryWith().summary}`)).toBe(
        true,
      );
      expect(request.turns.map((t) => t.text)).toEqual([...texts.slice(19), "Next"]);
    });

    it("does not summarize again on the next turn and sends the summary with the newer messages", async () => {
      const hook = await longChat();
      await sendText(hook, "Next");
      await sendText(hook, "Again");

      expect(fakeAi.summarize).toHaveBeenCalledTimes(1);
      const request = replyRequest(1);
      expect(request.system).toContain(`Earlier in this chat: ${contextSummaryWith().summary}`);
      expect(request.turns.map((t) => t.text)).toEqual([
        ...texts.slice(19),
        "Next",
        "Nice! Where did you go?",
        "Again",
      ]);
    });

    it("adds the summary's usage to the session and the month spend", async () => {
      const hook = await longChat();
      await sendText(hook, "Next");

      const summaryUsage = contextSummaryWith().usage;
      const replyUsage = tutorReplyWith().usage;
      expect(fakeData.addUsage).toHaveBeenCalledTimes(2);
      expect(fakeData.addUsage.mock.calls[0]).toEqual([
        "session-1",
        { model: TUTOR_MODEL, ...summaryUsage },
      ]);
      expect(fakeData.addUsage.mock.calls[1]).toEqual([
        "session-1",
        { model: TUTOR_MODEL, ...replyUsage },
      ]);
      expect(conversationOf(hook.result.current.view).spentUsd).toBeCloseTo(
        usageCostUsd(TUTOR_MODEL, summaryUsage) + usageCostUsd(TUTOR_MODEL, replyUsage),
        8,
      );
    });

    it("stops before the tutor when the summary's cost reaches the limit", async () => {
      const summaryUsage = contextSummaryWith().usage;
      withKey({ monthlyLimitUsd: usageCostUsd(TUTOR_MODEL, summaryUsage) });
      fakeData.openSession.mockResolvedValue({
        ok: true,
        value: {
          session,
          messages: texts.map((text, i) => saved(i % 2 === 0 ? "tutor" : "user", text)),
          threadReplies: [],
          notes: [],
        },
      });
      const hook = await ready({ kind: "resume", sessionId: "session-1" });
      await sendText(hook, "Next");

      expect(fakeAi.summarize).toHaveBeenCalledTimes(1);
      expect(fakeAi.reply).not.toHaveBeenCalled();
      expect(fakeData.addUsage).toHaveBeenCalledTimes(1);
      expect(fakeData.setSessionContext).toHaveBeenCalledTimes(1);
      const c = conversationOf(hook.result.current.view);
      expect(c.phase).toBe("idle");
      expect(c.draft).toBe("Next");
      expect(c.failure).toBeNull();
    });

    it("sends the full history when the summary fails and still saves the reply", async () => {
      fakeAi.summarize.mockResolvedValue({ ok: false, failure: "overloaded" });
      const hook = await longChat();
      await sendText(hook, "Next");

      expect(fakeData.setSessionContext).not.toHaveBeenCalled();
      expect(replyRequest().turns.map((t) => t.text)).toEqual([...texts, "Next"]);
      expect(fakeData.addMessage).toHaveBeenCalledTimes(2);
      expect(conversationOf(hook.result.current.view).failure).toBeNull();
    });

    it("saves the usage of a billed failed summary and still replies", async () => {
      const usage = contextSummaryWith().usage;
      fakeAi.summarize.mockResolvedValue({ ok: false, failure: "bad_response", usage });
      const hook = await longChat();
      await sendText(hook, "Next");

      expect(fakeData.addUsage.mock.calls[0]).toEqual([
        "session-1",
        { model: TUTOR_MODEL, ...usage },
      ]);
      expect(fakeAi.reply).toHaveBeenCalledTimes(1);
      expect(fakeData.addMessage).toHaveBeenCalledTimes(2);
    });

    it("sends the full history when the summary cannot be saved and tries again next turn", async () => {
      fakeData.setSessionContext.mockResolvedValue({ ok: false, failure: "network" });
      const hook = await longChat();
      await sendText(hook, "Next");

      expect(replyRequest().turns.map((t) => t.text)).toEqual([...texts, "Next"]);
      expect(replyRequest().system).not.toContain("Earlier in this chat");
      expect(conversationOf(hook.result.current.view).failure).toBeNull();

      await sendText(hook, "Again");
      expect(fakeAi.summarize).toHaveBeenCalledTimes(2);
    });

    it("tries the summary again on the turn after a failure", async () => {
      fakeAi.summarize.mockResolvedValueOnce({ ok: false, failure: "network" });
      const hook = await longChat();
      await sendText(hook, "Next");
      await sendText(hook, "Again");

      expect(fakeAi.summarize).toHaveBeenCalledTimes(2);
      expect(fakeData.setSessionContext).toHaveBeenCalledTimes(1);
      expect(replyRequest(1).system).toContain("Earlier in this chat");
    });
  });

  describe("an automatic title", () => {
    it("saves the tutor's title as auto and swaps the conversation title", async () => {
      withKey();
      fakeAi.reply.mockResolvedValue({
        ok: true,
        value: tutorReplyWith({ title: "Ramen spots in Tokyo" }),
      });
      const hook = await ready();
      await sendText(hook, "I like ramen");

      expect(fakeData.setSessionTitle).toHaveBeenCalledWith("session-1", {
        title: "Ramen spots in Tokyo",
        source: "auto",
      });
      const c = conversationOf(hook.result.current.view);
      expect(c.title).toBe("Ramen spots in Tokyo");
      expect(c.session?.titleSource).toBe("auto");
    });

    it("keeps the chat going when the title cannot be saved", async () => {
      withKey();
      fakeAi.reply.mockResolvedValue({
        ok: true,
        value: tutorReplyWith({ title: "Ramen spots in Tokyo" }),
      });
      fakeData.setSessionTitle.mockResolvedValue({ ok: false, failure: "unavailable" });
      const hook = await ready();
      await sendText(hook, "I like ramen");

      const c = conversationOf(hook.result.current.view);
      expect(c.failure).toBeNull();
      expect(c.phase).toBe("idle");
      expect(c.title).toBe("Free chat");
      expect(c.writes).toEqual([]);
    });

    it("saves no title for a resumed chat with a user title", async () => {
      withKey();
      fakeData.openSession.mockResolvedValue({
        ok: true,
        value: {
          session: { ...session, title: "My trip", titleSource: "user" },
          messages: [saved("tutor", "Opening")],
          threadReplies: [],
          notes: [],
        },
      });
      fakeAi.reply.mockResolvedValue({
        ok: true,
        value: tutorReplyWith({ title: "Ramen spots in Tokyo" }),
      });
      const hook = await ready({ kind: "resume", sessionId: "session-1" });
      await sendText(hook, "I like ramen");

      expect(fakeData.setSessionTitle).not.toHaveBeenCalled();
      expect(conversationOf(hook.result.current.view).title).toBe("My trip");
    });

    it("takes a renamed session", async () => {
      withKey();
      const hook = await ready();
      await sendText(hook, "Hello");
      const renamed: Session = { ...session, title: "Weekend plans", titleSource: "user" };
      await act(async () => hook.result.current.renamed(renamed));

      const c = conversationOf(hook.result.current.view);
      expect(c.title).toBe("Weekend plans");
      expect(c.session).toEqual(renamed);
    });
  });
});
