// apps/mobile/test/utils/thread-state.test.ts
//
// Tests for the thread screen's view and its small pure helpers.
//
// Tested:
// - threadParams reads the message id from the route params
// - threadView: the failed, no key, not found and ready states
// - threadHref, QUICK_ASKS and the thread texts
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/thread-state.test.ts
//
// SEE: apps/mobile/src/utils/thread-state.ts

import { describe, expect, it } from "@jest/globals";
import type { CorrectionThread, MonthSpend } from "@fluency-lab/shared";

import { dataFailureMessage, keyReadFailureMessage } from "@/utils/data-message";
import {
  QUICK_ASKS,
  threadBackLabel,
  threadHref,
  threadNotFoundMessage,
  threadParams,
  threadPlaceholder,
  threadTitle,
  threadView,
} from "@/utils/thread-state";
import { completedProfile } from "../helpers/fake-data";

const hasKey = { ok: true, value: true } as const;
const spent: { ok: true; value: MonthSpend } = {
  ok: true,
  value: { monthStart: "2026-11-01", spentUsd: 1 },
};

function opened(overrides: Partial<CorrectionThread["message"]> = {}): {
  ok: true;
  value: CorrectionThread;
} {
  return {
    ok: true,
    value: {
      session: {
        id: "s1",
        topicId: null,
        title: "Travel",
        status: "active",
        summary: null,
        costUsd: 0,
        createdAt: "2026-11-05T09:00:00Z",
        updatedAt: "2026-11-05T09:00:00Z",
      },
      message: {
        id: "m1",
        sessionId: "s1",
        role: "user",
        text: "I never been",
        corrections: {
          items: [{ original: "I never been", corrected: "I've never been" }],
          explanation: null,
        },
        newWords: null,
        replyToId: null,
        createdAt: "2026-11-05T09:00:00Z",
        ...overrides,
      },
      messages: [],
    },
  };
}

const profile = { ok: true, value: completedProfile() } as const;

describe("threadParams", () => {
  it("reads the message id from a string", () => {
    expect(threadParams({ message: "m1" })).toBe("m1");
  });

  it("reads the first of a list", () => {
    expect(threadParams({ message: ["m1", "m2"] })).toBe("m1");
  });

  it("is null when there is none or it is empty", () => {
    expect(threadParams({})).toBeNull();
    expect(threadParams({ message: "" })).toBeNull();
    expect(threadParams({ message: [] })).toBeNull();
  });
});

describe("threadView", () => {
  it("fails with the key message when the key cannot be read", () => {
    const cause = { name: "Error", detail: null };
    expect(
      threadView({
        key: { ok: false, failure: "not_read", cause },
        profile,
        spend: spent,
        thread: opened(),
      }),
    ).toEqual({ kind: "failed", message: keyReadFailureMessage, cause });
  });

  it("is no_key without a key and reads nothing else", () => {
    expect(
      threadView({
        key: { ok: true, value: false },
        profile: { ok: false, failure: "network" },
        spend: null,
        thread: null,
      }),
    ).toEqual({ kind: "no_key" });
  });

  it("fails with the data message when the profile, the spend or the thread fails", () => {
    expect(
      threadView({
        key: hasKey,
        profile: { ok: false, failure: "network" },
        spend: spent,
        thread: opened(),
      }),
    ).toEqual({ kind: "failed", message: dataFailureMessage("network") });
    expect(
      threadView({
        key: hasKey,
        profile,
        spend: { ok: false, failure: "unavailable" },
        thread: opened(),
      }),
    ).toEqual({ kind: "failed", message: dataFailureMessage("unavailable") });
    expect(
      threadView({
        key: hasKey,
        profile,
        spend: spent,
        thread: { ok: false, failure: "bad_response" },
      }),
    ).toEqual({ kind: "failed", message: dataFailureMessage("bad_response") });
  });

  it("fails as not found for a message without corrections or from the tutor", () => {
    const none = threadView({
      key: hasKey,
      profile,
      spend: spent,
      thread: opened({ corrections: null }),
    });
    expect(none).toEqual({ kind: "failed", message: threadNotFoundMessage });
    const tutor = threadView({
      key: hasKey,
      profile,
      spend: spent,
      thread: opened({ role: "tutor" }),
    });
    expect(tutor).toEqual({ kind: "failed", message: threadNotFoundMessage });
    const empty = threadView({
      key: hasKey,
      profile,
      spend: spent,
      thread: opened({ corrections: { items: [], explanation: null } }),
    });
    expect(empty).toEqual({ kind: "failed", message: threadNotFoundMessage });
  });

  it("is ready with a conversation otherwise", () => {
    const view = threadView({ key: hasKey, profile, spend: spent, thread: opened() });
    expect(view.kind).toBe("ready");
    if (view.kind === "ready") {
      expect(view.conversation.message.id).toBe("m1");
      expect(view.conversation.spentUsd).toBe(1);
    }
  });
});

describe("the thread constants", () => {
  it("builds the href of a thread", () => {
    expect(threadHref("m1")).toEqual({ pathname: "/thread", params: { message: "m1" } });
  });

  it("has the three quick asks of the design, in order", () => {
    expect(QUICK_ASKS).toEqual(["Why is it wrong?", "I think I was right", "Other ways"]);
  });

  it("names the title, the back label and the placeholder of the design", () => {
    expect(threadTitle).toBe("Correction");
    expect(threadBackLabel).toBe("Back to the chat");
    expect(threadPlaceholder).toBe("Ask about this correction…");
  });
});
