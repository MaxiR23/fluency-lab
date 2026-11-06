// apps/mobile/test/utils/chat-state.test.ts
//
// Tests for the Chat view and its small pure helpers.
//
// Tested:
// - chatView, chatTitle, providerLine, noKeyProviderLine, canSend
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/chat-state.test.ts
//
// SEE: apps/mobile/src/utils/chat-state.ts

import { describe, expect, it } from "@jest/globals";

import { canSend, chatTitle, chatView, noKeyProviderLine, providerLine } from "@/utils/chat-state";
import { dataFailureMessage, keyReadFailureMessage } from "@/utils/data-message";
import { completedProfile, profileWith } from "../helpers/fake-data";

describe("chatView", () => {
  it("is ready with the profile's provider when a key is saved and the profile reads", () => {
    expect(
      chatView({ ok: true, value: true }, { ok: true, value: profileWith({ provider: "claude" }) }),
    ).toEqual({ kind: "ready", provider: "claude" });
  });

  it("is ready with no provider when the profile has none", () => {
    expect(chatView({ ok: true, value: true }, { ok: true, value: completedProfile() })).toEqual({
      kind: "ready",
      provider: null,
    });
  });

  it("is no_key when no key is saved, even if the profile read fails", () => {
    expect(chatView({ ok: true, value: false }, { ok: false, failure: "network" })).toEqual({
      kind: "no_key",
    });
  });

  it("is failed with the key message and cause when the key read fails, even if the profile reads", () => {
    const cause = { name: "Error", detail: null };
    expect(
      chatView({ ok: false, failure: "not_read", cause }, { ok: true, value: completedProfile() }),
    ).toEqual({ kind: "failed", message: keyReadFailureMessage, cause });
  });

  it("is failed with the network message when the key is saved and the profile cannot be reached", () => {
    expect(chatView({ ok: true, value: true }, { ok: false, failure: "network" })).toEqual({
      kind: "failed",
      message: dataFailureMessage("network"),
    });
  });

  it("is failed with the session-ended message when the profile read is unauthorized", () => {
    expect(chatView({ ok: true, value: true }, { ok: false, failure: "unauthorized" })).toEqual({
      kind: "failed",
      message: dataFailureMessage("unauthorized"),
    });
  });
});

describe("chatTitle", () => {
  it("uses the topic when one is passed", () => {
    expect(chatTitle("Travel plans")).toBe("Travel plans");
  });

  it("is Free chat when no topic is passed", () => {
    expect(chatTitle(undefined)).toBe("Free chat");
  });

  it("is Free chat for a blank topic", () => {
    expect(chatTitle("   ")).toBe("Free chat");
  });

  it("trims the topic", () => {
    expect(chatTitle("  Travel plans ")).toBe("Travel plans");
  });

  it("uses the first value of a repeated topic", () => {
    expect(chatTitle(["Travel plans", "Food"])).toBe("Travel plans");
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
});
