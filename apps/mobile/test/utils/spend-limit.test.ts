// apps/mobile/test/utils/spend-limit.test.ts
//
// Tests for the monthly spend thresholds.
//
// Tested:
// - spendLevel: ok, warning at 80% and blocked at 100% of the limit
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/spend-limit.test.ts
//
// SEE: apps/mobile/src/utils/spend-limit.ts

import { describe, expect, it } from "@jest/globals";

import { limitReachedMessage, spendLevel, spendWarningText } from "@/utils/spend-limit";

describe("spendLevel", () => {
  it("zero spend is ok", () => {
    expect(spendLevel(0, 10)).toBe("ok");
  });

  it("warns when the month's spend reaches 80% of the limit", () => {
    expect(spendLevel(8, 10)).toBe("warning");
  });

  it("does not warn one unit under 80%", () => {
    expect(spendLevel(7.99999999, 10)).toBe("ok");
  });

  it("blocks at exactly the limit", () => {
    expect(spendLevel(10, 10)).toBe("blocked");
  });

  it("warns one unit under the limit", () => {
    expect(spendLevel(9.99999999, 10)).toBe("warning");
  });

  it("blocks over the limit", () => {
    expect(spendLevel(12, 10)).toBe("blocked");
  });

  it("never blocks without a limit", () => {
    expect(spendLevel(1000, null)).toBe("ok");
  });

  it("warns at 0.056 of 0.07", () => {
    expect(spendLevel(0.056, 0.07)).toBe("warning");
  });

  it("states the messages", () => {
    expect(spendWarningText).toBe("You're close to your monthly limit.");
    expect(limitReachedMessage).toBe("You reached your monthly limit.");
  });
});
