// apps/mobile/test/components/step-progress-style.test.ts
//
// Tests for progressSegments.
//
// Tested:
// - Which progress segments are filled (how one is drawn is tested in segmented-progress-style.test.ts)
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/step-progress-style.test.ts
//
// SEE: apps/mobile/src/components/step-progress-style.ts

import { describe, expect, it } from "@jest/globals";

import { progressSegments } from "@/components/step-progress-style";

describe("progressSegments", () => {
  it("fills as many segments as the step", () => {
    expect(progressSegments(2, 4)).toEqual([true, true, false, false]);
  });

  it("fills none at step 0", () => {
    expect(progressSegments(0, 4)).toEqual([false, false, false, false]);
  });

  it("fills all at the last step", () => {
    expect(progressSegments(4, 4)).toEqual([true, true, true, true]);
  });

  it("never fills more than the total", () => {
    expect(progressSegments(9, 4)).toEqual([true, true, true, true]);
    expect(progressSegments(-1, 4)).toEqual([false, false, false, false]);
  });
});
