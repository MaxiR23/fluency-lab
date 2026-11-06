// apps/mobile/test/utils/correction-withdrawal.test.ts
//
// Tests for the withdrawal of corrections the tutor takes back.
//
// Tested:
// - withdrawnIndexes turns the tutor's numbers (from 1) into 0-based indexes of corrections not yet withdrawn
// - applyWithdrawal flags the named corrections as withdrawn
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/correction-withdrawal.test.ts
//
// SEE: apps/mobile/src/utils/correction-withdrawal.ts

import { describe, expect, it } from "@jest/globals";

import { applyWithdrawal, withdrawnIndexes } from "@/utils/correction-withdrawal";

const items = [
  { original: "a", corrected: "b" },
  { original: "c", corrected: "d" },
];

describe("withdrawnIndexes", () => {
  it("turns the tutor's numbers into indexes", () => {
    expect(withdrawnIndexes([2], items)).toEqual([1]);
    expect(withdrawnIndexes([1, 2], items)).toEqual([0, 1]);
  });

  it("is empty for no numbers", () => {
    expect(withdrawnIndexes([], items)).toEqual([]);
  });

  it("drops a number one under and one over the list", () => {
    expect(withdrawnIndexes([0], items)).toEqual([]);
    expect(withdrawnIndexes([3], items)).toEqual([]);
  });

  it("drops a repeated number, keeping it once", () => {
    expect(withdrawnIndexes([1, 1], items)).toEqual([0]);
  });

  it("drops a fractional number", () => {
    expect(withdrawnIndexes([2.5], items)).toEqual([]);
  });

  it("drops a number naming an already withdrawn correction", () => {
    const done = [{ ...items[0], withdrawn: true as const }, items[1]];
    expect(withdrawnIndexes([1, 2], done)).toEqual([1]);
  });

  it("sorts the result", () => {
    expect(withdrawnIndexes([2, 1], items)).toEqual([0, 1]);
  });

  it("is empty when there are no corrections", () => {
    expect(withdrawnIndexes([1], [])).toEqual([]);
  });
});

describe("applyWithdrawal", () => {
  it("flags only the named correction", () => {
    const result = applyWithdrawal(items, [1]);
    expect(result[1]).toEqual({ original: "c", corrected: "d", withdrawn: true });
    expect(result[0]).toEqual(items[0]);
  });

  it("changes nothing for no indexes", () => {
    expect(applyWithdrawal(items, [])).toEqual(items);
  });

  it("changes nothing for an index outside the list", () => {
    expect(applyWithdrawal(items, [5])).toEqual(items);
  });

  it("does not change the list it was given", () => {
    applyWithdrawal(items, [0]);
    expect(items[0]).toEqual({ original: "a", corrected: "b" });
  });
});
