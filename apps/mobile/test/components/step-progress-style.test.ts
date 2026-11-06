// apps/mobile/test/components/step-progress-style.test.ts
//
// Tests for progressSegments and segmentStyle.
//
// Tested:
// - Which progress segments are filled and how one is drawn
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/step-progress-style.test.ts
//
// SEE: apps/mobile/src/components/step-progress-style.ts

import { describe, expect, it } from "@jest/globals";

import { progressSegments, segmentStyle } from "@/components/step-progress-style";
import { colors, size } from "@/constants/theme";

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

describe("segmentStyle", () => {
  it("draws filled segments in the accent and empty ones in the border color", () => {
    expect(segmentStyle(true).backgroundColor).toBe(colors.accent);
    expect(segmentStyle(false).backgroundColor).toBe(colors.border);
  });

  it("uses the progress bar height", () => {
    expect(segmentStyle(true)).toMatchObject({ flex: 1, height: size.progressBar });
  });
});
