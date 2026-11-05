// apps/mobile/test/components/font-load.test.ts
//
// Tests for isFontLoadSettled.
//
// Tested:
// - The app waits for the fonts until they load or fail
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/font-load.test.ts
//
// SEE: apps/mobile/src/components/font-load.ts

import { describe, expect, it } from "@jest/globals";

import { isFontLoadSettled } from "@/components/font-load";

describe("isFontLoadSettled", () => {
  it("is settled when the fonts loaded", () => {
    expect(isFontLoadSettled(true, null)).toBe(true);
  });

  it("is settled when the load failed", () => {
    expect(isFontLoadSettled(false, new Error("no font"))).toBe(true);
  });

  it("is not settled while nothing has loaded and nothing failed", () => {
    expect(isFontLoadSettled(false, null)).toBe(false);
  });

  it("is settled when loaded and error are both set", () => {
    expect(isFontLoadSettled(true, new Error("no font"))).toBe(true);
  });
});
