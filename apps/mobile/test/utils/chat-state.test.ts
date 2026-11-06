// apps/mobile/test/utils/chat-state.test.ts
//
// Tests for the Chat key view.
//
// Tested:
// - chatKeyView
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/chat-state.test.ts
//
// SEE: apps/mobile/src/utils/chat-state.ts

import { describe, expect, it } from "@jest/globals";

import { chatKeyView } from "@/utils/chat-state";

describe("chatKeyView", () => {
  it("is ready when a key is saved", () => {
    expect(chatKeyView({ ok: true, value: true })).toEqual({ kind: "ready" });
  });

  it("is no_key when no key is saved", () => {
    expect(chatKeyView({ ok: true, value: false })).toEqual({ kind: "no_key" });
  });

  it("is failed with the cause when the read fails", () => {
    const cause = { name: "Error", detail: null };
    expect(chatKeyView({ ok: false, failure: "not_read", cause })).toEqual({
      kind: "failed",
      cause,
    });
  });
});
