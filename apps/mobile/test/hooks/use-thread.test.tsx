// apps/mobile/test/hooks/use-thread.test.tsx
//
// Tests for the Thread hook.
//
// Tested:
// - The key, the profile, the month spend and the thread read from their ports; the expected empty, no key, and each failure
// - A question asks with only the thread turns, then saves the learner row, the tutor row and the usage, in order
// - A quick ask sends its text and keeps the draft
// - A withdrawal calls withdrawCorrections after the two rows and before the usage
// - The 100% limit calls nothing
// - An AI failure puts the text back and retry sends it again; a write failure resumes without asking again; a billed failure saves its usage
// - Regaining focus re-reads the context; the key gone turns into no_key
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/hooks/use-thread.test.tsx
//
// SEE: apps/mobile/src/hooks/use-thread.ts

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { router, useIsFocused } from "expo-router";
import { TUTOR_MODEL } from "@fluency-lab/shared";

import { useThread } from "@/hooks/use-thread";
import type { ThreadConversation } from "@/utils/thread-conversation";
import { dataFailureMessage, keyReadFailureMessage } from "@/utils/data-message";
import { threadNotFoundMessage } from "@/utils/thread-state";
import { fakeAi, resetFakeAi, threadReplyWith } from "../helpers/fake-ai";
import {
  fakeData,
  profileWith,
  resetFakeData,
  threadMessageWith,
  threadWith,
} from "../helpers/fake-data";
import { fakeKeys, resetFakeKeys } from "../helpers/fake-keys";
import { failThenHold } from "../helpers/fail-then-hold";

jest.mock("expo-router", () => ({
  useIsFocused: jest.fn(() => true),
  router: { push: jest.fn() },
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

function withKey(overrides: Parameters<typeof profileWith>[0] = {}) {
  fakeKeys.hasApiKey.mockResolvedValue({ ok: true, value: true });
  fakeData.getProfile.mockResolvedValue({
    ok: true,
    value: profileWith({
      displayName: "Ada",
      level: "intermediate",
      provider: "claude",
      onboardingCompletedAt: "2026-11-05T10:00:00Z",
      ...overrides,
    }),
  });
  fakeData.addThreadMessage.mockImplementation(async (messageId, input) => ({
    ok: true,
    value: threadMessageWith({ id: `saved-${input.text}`, messageId, role: input.role }),
  }));
  fakeData.addUsage.mockResolvedValue({ ok: true, value: threadWith().session });
}

async function ready() {
  const hook = await renderHook(() => useThread("message-1"));
  await waitFor(() => expect(hook.result.current.view.kind).toBe("ready"));
  return hook;
}

function conversationOf(view: ReturnType<typeof useThread>["view"]): ThreadConversation {
  if (view.kind !== "ready") throw new Error(`view is ${view.kind}`);
  return view.conversation;
}

async function sendText(hook: Awaited<ReturnType<typeof ready>>, text: string) {
  await act(async () => hook.result.current.setDraft(text));
  await act(async () => hook.result.current.send());
}

async function refocus(hook: Awaited<ReturnType<typeof ready>>) {
  jest.mocked(useIsFocused).mockReturnValue(false);
  await hook.rerender({});
  jest.mocked(useIsFocused).mockReturnValue(true);
  await hook.rerender({});
}

describe("useThread", () => {
  beforeEach(() => {
    resetFakeData();
    resetFakeKeys();
    resetFakeAi();
    jest.mocked(useIsFocused).mockReturnValue(true);
    jest.mocked(router.push).mockClear();
  });

  describe("loading", () => {
    it("starts loading", async () => {
      fakeKeys.hasApiKey.mockReturnValue(new Promise(() => {}));
      const { result } = await renderHook(() => useThread("message-1"));
      expect(result.current.view).toEqual({ kind: "loading" });
    });

    it("is ready with the thread, the profile level and the month spend", async () => {
      withKey({ monthlyLimitUsd: 10 });
      fakeData.getMonthSpend.mockResolvedValue({
        ok: true,
        value: { monthStart: "2026-11-01", spentUsd: 2 },
      });
      fakeData.openThread.mockResolvedValue({
        ok: true,
        value: threadWith({ messages: [threadMessageWith()] }),
      });
      const { result } = await ready();
      const t = conversationOf(result.current.view);
      expect(fakeData.openThread).toHaveBeenCalledWith("message-1");
      expect(t.messages.map((m) => m.text)).toEqual(["Why is it wrong?"]);
      expect(t.level).toBe("intermediate");
      expect(t.spentUsd).toBe(2);
    });

    it("is ready with an empty thread", async () => {
      withKey();
      const { result } = await ready();
      expect(conversationOf(result.current.view).messages).toEqual([]);
    });

    it("is no_key without a key and reads nothing else", async () => {
      const { result } = await renderHook(() => useThread("message-1"));
      await waitFor(() => expect(result.current.view).toEqual({ kind: "no_key" }));
      expect(fakeData.getMonthSpend).not.toHaveBeenCalled();
      expect(fakeData.openThread).not.toHaveBeenCalled();
    });

    it("fails with the key message when the key cannot be read", async () => {
      const cause = { name: "Error", detail: null };
      fakeKeys.hasApiKey.mockResolvedValue({ ok: false, failure: "not_read", cause });
      const { result } = await renderHook(() => useThread("message-1"));
      await waitFor(() =>
        expect(result.current.view).toEqual({
          kind: "failed",
          message: keyReadFailureMessage,
          cause,
        }),
      );
    });

    it("fails with the data message when the thread, the profile or the spend cannot be read", async () => {
      withKey();
      fakeData.openThread.mockResolvedValue({ ok: false, failure: "not_found" });
      const thread = await renderHook(() => useThread("message-1"));
      await waitFor(() =>
        expect(thread.result.current.view).toEqual({
          kind: "failed",
          message: dataFailureMessage("not_found"),
        }),
      );
      fakeData.openThread.mockResolvedValue({ ok: true, value: threadWith() });
      fakeData.getMonthSpend.mockResolvedValue({ ok: false, failure: "network" });
      const spend = await renderHook(() => useThread("message-1"));
      await waitFor(() =>
        expect(spend.result.current.view).toEqual({
          kind: "failed",
          message: dataFailureMessage("network"),
          network: true,
        }),
      );
      fakeData.getProfile.mockResolvedValue({ ok: false, failure: "unavailable" });
      const profile = await renderHook(() => useThread("message-1"));
      await waitFor(() =>
        expect(profile.result.current.view).toEqual({
          kind: "failed",
          message: dataFailureMessage("unavailable"),
        }),
      );
    });

    it("fails as not found without a message id and reads nothing", async () => {
      const { result } = await renderHook(() => useThread(null));
      await waitFor(() =>
        expect(result.current.view).toEqual({ kind: "failed", message: threadNotFoundMessage }),
      );
      expect(fakeData.openThread).not.toHaveBeenCalled();
    });

    it("reads everything again on retry from a failed view", async () => {
      fakeKeys.hasApiKey.mockResolvedValueOnce({ ok: false, failure: "not_read" });
      const { result } = await renderHook(() => useThread("message-1"));
      await waitFor(() => expect(result.current.view.kind).toBe("failed"));
      withKey();
      await act(async () => result.current.retry());
      expect(result.current.view.kind).toBe("ready");
    });

    it("keeps the network failure, retrying, while Try again reads again", async () => {
      withKey();
      const reread = failThenHold(fakeData.getProfile, { ok: false, failure: "network" });
      const { result } = await renderHook(() => useThread("message-1"));
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
  });

  describe("a question", () => {
    it("asks with only the thread turns, then saves the learner row, the tutor row and the usage in order", async () => {
      withKey();
      fakeData.openThread.mockResolvedValue({
        ok: true,
        value: threadWith({
          messages: [
            threadMessageWith(),
            threadMessageWith({ id: "t2", role: "tutor", text: "Because." }),
          ],
        }),
      });
      const hook = await ready();

      await sendText(hook, "And now?");

      expect(fakeAi.replyInThread).toHaveBeenCalledTimes(1);
      expect(fakeAi.replyInThread.mock.calls[0][0].turns).toEqual([
        { role: "user", text: "Why is it wrong?" },
        { role: "tutor", text: "Because." },
        { role: "user", text: "And now?" },
      ]);
      expect(fakeData.addThreadMessage.mock.calls.map(([id, input]) => [id, input.role])).toEqual([
        ["message-1", "user"],
        ["message-1", "tutor"],
      ]);
      expect(fakeData.addThreadMessage.mock.calls[0][1]).toEqual({
        role: "user",
        text: "And now?",
      });
      expect(fakeData.addUsage).toHaveBeenCalledWith("session-1", {
        model: TUTOR_MODEL,
        inputTokens: 500,
        outputTokens: 80,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      });
      const order = [
        fakeData.addThreadMessage.mock.invocationCallOrder[0],
        fakeData.addThreadMessage.mock.invocationCallOrder[1],
        fakeData.addUsage.mock.invocationCallOrder[0],
      ];
      expect(order).toEqual([...order].sort((a, b) => a - b));
      const t = conversationOf(hook.result.current.view);
      expect(t.phase).toBe("idle");
      expect(t.messages.map((m) => m.savedId)).toEqual([
        "thread-row-1",
        "t2",
        "saved-And now?",
        "saved-The article is not needed with next year.",
      ]);
    });

    it("saves the new words on the learner row", async () => {
      withKey();
      fakeAi.replyInThread.mockResolvedValue({
        ok: true,
        value: threadReplyWith({ newWords: ["laid-back"] }),
      });
      const hook = await ready();
      await sendText(hook, "Is laid-back right?");
      expect(fakeData.addThreadMessage.mock.calls[0][1]).toEqual({
        role: "user",
        text: "Is laid-back right?",
        newWords: ["laid-back"],
      });
    });

    it("sendQuick sends that text and keeps the draft", async () => {
      withKey();
      const hook = await ready();
      await act(async () => hook.result.current.setDraft("my own"));

      await act(async () => hook.result.current.sendQuick("Why is it wrong?"));

      expect(fakeAi.replyInThread.mock.calls[0][0].turns).toEqual([
        { role: "user", text: "Why is it wrong?" },
      ]);
      expect(conversationOf(hook.result.current.view).draft).toBe("my own");
    });

    it("sends nothing for an empty draft", async () => {
      withKey();
      const hook = await ready();
      await act(async () => hook.result.current.send());
      expect(fakeAi.replyInThread).not.toHaveBeenCalled();
    });

    it("withdraws a correction after the two rows and before the usage", async () => {
      withKey();
      fakeAi.replyInThread.mockResolvedValue({
        ok: true,
        value: threadReplyWith({ withdrawn: [1] }),
      });
      fakeData.withdrawCorrections.mockImplementation(async () => ({
        ok: true,
        value: threadWith(
          {},
          {
            corrections: {
              items: [
                {
                  original: "the next year",
                  corrected: "next year",
                  rule: "Articles with years",
                  withdrawn: true,
                },
                { original: "I never been", corrected: "I've never been", rule: "Present perfect" },
              ],
              explanation: null,
            },
          },
        ).message,
      }));
      const hook = await ready();

      await sendText(hook, "I think I was right");

      expect(fakeData.withdrawCorrections).toHaveBeenCalledWith("message-1", [0]);
      const calls = [
        fakeData.addThreadMessage.mock.invocationCallOrder[1],
        fakeData.withdrawCorrections.mock.invocationCallOrder[0],
        fakeData.addUsage.mock.invocationCallOrder[0],
      ];
      expect(calls).toEqual([...calls].sort((a, b) => a - b));
      expect(conversationOf(hook.result.current.view).message.corrections[0].withdrawn).toBe(true);
    });

    it("does not withdraw when the tutor names no valid correction", async () => {
      withKey();
      fakeAi.replyInThread.mockResolvedValue({
        ok: true,
        value: threadReplyWith({ withdrawn: [9] }),
      });
      const hook = await ready();
      await sendText(hook, "Q");
      expect(fakeData.withdrawCorrections).not.toHaveBeenCalled();
    });
  });

  describe("the limit", () => {
    it("calls nothing at 100% for send and sendQuick", async () => {
      withKey({ monthlyLimitUsd: 10 });
      fakeData.getMonthSpend.mockResolvedValue({
        ok: true,
        value: { monthStart: "2026-11-01", spentUsd: 10 },
      });
      const hook = await ready();
      await act(async () => hook.result.current.setDraft("Hello"));
      await act(async () => hook.result.current.send());
      await act(async () => hook.result.current.sendQuick("Other ways"));
      expect(fakeAi.replyInThread).not.toHaveBeenCalled();
      expect(fakeData.addThreadMessage).not.toHaveBeenCalled();
    });
  });

  describe("failures", () => {
    it("puts the text back on an AI failure and retry sends it again", async () => {
      withKey();
      fakeAi.replyInThread.mockResolvedValueOnce({ ok: false, failure: "rate_limited" });
      const hook = await ready();

      await sendText(hook, "Why?");

      let t = conversationOf(hook.result.current.view);
      expect(t.draft).toBe("Why?");
      expect(t.failure).toMatchObject({ source: "ai", failure: "rate_limited" });
      expect(fakeData.addThreadMessage).not.toHaveBeenCalled();

      await act(async () => hook.result.current.retry());

      expect(fakeAi.replyInThread).toHaveBeenCalledTimes(2);
      t = conversationOf(hook.result.current.view);
      expect(t.failure).toBeNull();
      expect(t.messages.map((m) => m.text)[0]).toBe("Why?");
    });

    it("resumes a failed write without asking the tutor again", async () => {
      withKey();
      fakeData.addUsage.mockResolvedValueOnce({ ok: false, failure: "network" });
      const hook = await ready();

      await sendText(hook, "Why?");

      expect(conversationOf(hook.result.current.view).failure).toEqual({
        source: "data",
        failure: "network",
      });
      await act(async () => hook.result.current.retry());

      expect(fakeAi.replyInThread).toHaveBeenCalledTimes(1);
      expect(fakeData.addUsage).toHaveBeenCalledTimes(2);
      expect(fakeData.addThreadMessage).toHaveBeenCalledTimes(2);
      expect(conversationOf(hook.result.current.view).failure).toBeNull();
    });

    it("saves the usage of a billed AI failure", async () => {
      withKey();
      const usage = {
        inputTokens: 100,
        outputTokens: 10,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      };
      fakeAi.replyInThread.mockResolvedValueOnce({ ok: false, failure: "bad_response", usage });
      const hook = await ready();

      await sendText(hook, "Why?");

      expect(fakeData.addUsage).toHaveBeenCalledWith("session-1", { model: TUTOR_MODEL, ...usage });
      expect(conversationOf(hook.result.current.view).draft).toBe("Why?");
    });
  });

  describe("refocus and the key", () => {
    it("re-reads the context and keeps the draft", async () => {
      withKey({ monthlyLimitUsd: 10 });
      const hook = await ready();
      await act(async () => hook.result.current.setDraft("Typing"));
      fakeData.getMonthSpend.mockResolvedValue({
        ok: true,
        value: { monthStart: "2026-11-01", spentUsd: 3 },
      });

      await refocus(hook);

      await waitFor(() => expect(conversationOf(hook.result.current.view).spentUsd).toBe(3));
      expect(conversationOf(hook.result.current.view).draft).toBe("Typing");
      expect(fakeData.openThread).toHaveBeenCalledTimes(1);
    });

    it("becomes no_key when the key is gone", async () => {
      withKey();
      const hook = await ready();
      fakeKeys.hasApiKey.mockResolvedValue({ ok: true, value: false });
      await refocus(hook);
      await waitFor(() => expect(hook.result.current.view).toEqual({ kind: "no_key" }));
    });

    it("updateKey opens the key step", async () => {
      withKey();
      const hook = await ready();
      hook.result.current.updateKey();
      expect(router.push).toHaveBeenCalledWith("/api-key");
    });
  });
});
