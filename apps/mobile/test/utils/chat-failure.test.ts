// apps/mobile/test/utils/chat-failure.test.ts
//
// Tests for the wording and the action of each chat failure.
//
// Tested:
// - chatFailureView for every AI failure, data failure and the spend limit
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/chat-failure.test.ts
//
// SEE: apps/mobile/src/utils/chat-failure.ts

import { describe, expect, it } from "@jest/globals";

import type { AiFailure } from "@/ai/ai-port";
import {
  chatFailureView,
  endedSessionMessage,
  unsupportedProviderMessage,
} from "@/utils/chat-failure";
import { dataFailureMessage, keyReadFailureMessage } from "@/utils/data-message";
import { limitReachedMessage } from "@/utils/spend-limit";

function ai(failure: AiFailure) {
  return chatFailureView({ source: "ai", failure });
}

describe("chatFailureView", () => {
  it("invalid_key offers Update key", () => {
    expect(ai("invalid_key")).toEqual({
      message: "Your API key was not accepted. Update it to keep chatting.",
      action: "update_key",
    });
  });

  it("missing_key offers Update key", () => {
    expect(ai("missing_key")).toEqual({
      message: "Your API key is missing. Add it to keep chatting.",
      action: "update_key",
    });
  });

  it("key_unreadable offers Try again", () => {
    expect(ai("key_unreadable")).toEqual({ message: keyReadFailureMessage, action: "retry" });
  });

  it("rate_limited offers Try again", () => {
    expect(ai("rate_limited")).toEqual({
      message: "Too many messages for your API key right now. Wait a moment and try again.",
      action: "retry",
    });
  });

  it("overloaded offers Try again", () => {
    expect(ai("overloaded")).toEqual({
      message: "The AI is busy right now. Try again in a moment.",
      action: "retry",
    });
  });

  it("network offers Try again", () => {
    expect(ai("network")).toEqual({
      message: "Could not reach the AI. Check your connection and try again.",
      action: "retry",
    });
  });

  it("refused offers Try again", () => {
    expect(ai("refused")).toEqual({
      message: "The tutor could not answer that. Try saying it another way.",
      action: "retry",
    });
  });

  it("rejected, unavailable and bad_response share one message", () => {
    for (const failure of ["rejected", "unavailable", "bad_response"] as const) {
      expect(ai(failure)).toEqual({
        message: "The tutor could not answer. Try again.",
        action: "retry",
      });
    }
  });

  it("passes the cause of an AI failure through", () => {
    const cause = { name: "HttpError", code: "authentication_error", detail: null };
    expect(chatFailureView({ source: "ai", failure: "invalid_key", cause })).toMatchObject({
      cause,
    });
  });

  it("a data failure offers Try again with the data message", () => {
    expect(chatFailureView({ source: "data", failure: "network" })).toEqual({
      message: dataFailureMessage("network"),
      action: "retry",
    });
  });

  it("the limit has no action and a SpendLimit cause", () => {
    expect(chatFailureView({ source: "limit" })).toEqual({
      message: limitReachedMessage,
      action: null,
      cause: { name: "SpendLimit", detail: null },
    });
  });

  it("states the OpenAI and ended-session messages", () => {
    expect(unsupportedProviderMessage).toBe("OpenAI is coming soon. Use a Claude key for now.");
    expect(endedSessionMessage).toBe("This conversation has ended.");
  });
});
