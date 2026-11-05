// apps/mobile/test/components/has-text.test.ts
//
// Tests for hasText.
//
// Tested:
// - A message counts as text only when it has visible characters
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/has-text.test.ts
//
// SEE: apps/mobile/src/components/has-text.ts

import { describe, expect, it } from "@jest/globals";

import { hasText } from "@/components/has-text";

describe("hasText", () => {
  it("is true for a non-empty message", () => {
    expect(hasText("Required")).toBe(true);
  });

  it("is false for undefined", () => {
    expect(hasText(undefined)).toBe(false);
  });

  it("is false for an empty string", () => {
    expect(hasText("")).toBe(false);
  });

  it("is false for a string of only spaces", () => {
    expect(hasText("   ")).toBe(false);
  });

  it("is true for a single character", () => {
    expect(hasText("x")).toBe(true);
  });
});
