// packages/shared/test/model-price.test.ts
//
// Tests for the tutor model constant and the usage price.
//
// Tested:
// - TUTOR_MODEL is the single model constant
// - The writer, solver and review models of the practice checks
// - usageCostUsd prices the usage of a request in USD
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec vitest run packages/shared/test/model-price.test.ts
//
// SEE: packages/shared/src/model-price.ts

import { describe, expect, it } from "vitest";
import {
  MODEL_IDS,
  MODEL_PRICES,
  PRACTICE_REVIEW_MODEL,
  PRACTICE_SOLVER_MODEL,
  PRACTICE_WRITER_MODEL,
  TUTOR_MODEL,
  usageCostUsd,
} from "../src/model-price";

const zero = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
};

describe("TUTOR_MODEL", () => {
  it("is the one model of the price table", () => {
    expect(TUTOR_MODEL).toBe("claude-haiku-5-5");
    expect(MODEL_IDS).toEqual([TUTOR_MODEL]);
    expect(Object.keys(MODEL_PRICES)).toEqual([TUTOR_MODEL]);
  });
});

describe("usageCostUsd", () => {
  it("prices 700 input and 150 output tokens at 0.000145", () => {
    expect(usageCostUsd(TUTOR_MODEL, { ...zero, inputTokens: 700, outputTokens: 150 })).toBe(
      0.000145,
    );
  });

  it("zero usage costs 0", () => {
    expect(usageCostUsd(TUTOR_MODEL, zero)).toBe(0);
  });

  it("a prompt of exactly 100,000 tokens uses the standard tier", () => {
    expect(usageCostUsd(TUTOR_MODEL, { ...zero, inputTokens: 100000 })).toBe(0.01);
  });

  it("100,001 tokens use the long tier", () => {
    expect(usageCostUsd(TUTOR_MODEL, { ...zero, inputTokens: 100001 })).toBe(0.0500005);
  });

  it("counts cache reads and writes toward the prompt length", () => {
    const usage = {
      ...zero,
      inputTokens: 50000,
      cacheCreationInputTokens: 25000,
      cacheReadInputTokens: 25001,
    };
    // long tier: 50000*0.50 + 25000*0.625 + 25001*0.05 = 25000 + 15625 + 1250.05 per million
    expect(usageCostUsd(TUTOR_MODEL, usage)).toBe(0.04187505);
  });

  it("prices cache reads and writes in the standard tier", () => {
    const usage = { ...zero, cacheCreationInputTokens: 1000, cacheReadInputTokens: 1000 };
    // 1000*0.125 + 1000*0.01 = 135 per million
    expect(usageCostUsd(TUTOR_MODEL, usage)).toBe(0.000135);
  });

  it("rounds to 8 decimals", () => {
    // 1 output token = 5e-7; 1 cache read token = 1e-8; 3 of them = 3e-8
    expect(usageCostUsd(TUTOR_MODEL, { ...zero, cacheReadInputTokens: 3 })).toBe(0.00000003);
    expect(usageCostUsd(TUTOR_MODEL, { ...zero, inputTokens: 1 })).toBe(0.0000001);
  });

  it("exports the writer, solver and review models, all equal to TUTOR_MODEL", () => {
    expect(PRACTICE_WRITER_MODEL).toBe(TUTOR_MODEL);
    expect(PRACTICE_SOLVER_MODEL).toBe(TUTOR_MODEL);
    expect(PRACTICE_REVIEW_MODEL).toBe(TUTOR_MODEL);
  });

  it("keeps the tutor model as the only priced model", () => {
    expect(Object.keys(MODEL_PRICES)).toEqual([TUTOR_MODEL]);
  });
});
