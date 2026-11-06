// apps/mobile/test/utils/chat-items.test.ts
//
// Tests for the chat item helpers.
//
// Tested:
// - correctionsLabel
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/chat-items.test.ts
//
// SEE: apps/mobile/src/utils/chat-items.ts

import { describe, expect, it } from "@jest/globals";

import { correctionsLabel } from "@/utils/chat-items";

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
