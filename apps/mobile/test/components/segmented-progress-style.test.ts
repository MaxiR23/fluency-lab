// apps/mobile/test/components/segmented-progress-style.test.ts
//
// Tests for the style of the segmented progress.
//
// Tested:
// - The exercise look of exercise-choose.html: a segment per state and the bar gap
// - The exercise bar takes the row's leftover width (flex 1, min width 0) and the step bar does not
// - The step look keeps the onboarding bar: the values segmentStyle drew before it moved here
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/segmented-progress-style.test.ts
//
// SEE: apps/mobile/src/components/segmented-progress-style.ts

import { describe, expect, it } from "@jest/globals";

import {
  segmentedProgressBar,
  segmentedProgressStyle,
} from "@/components/segmented-progress-style";
import { colors, radius, size, spacing } from "@/constants/theme";

describe("segmentedProgressStyle in the exercise look", () => {
  const base = { flex: 1, height: size.segment, borderRadius: radius.segment };

  it("draws a done segment in the accent", () => {
    expect(segmentedProgressStyle("done", "exercise")).toEqual({
      ...base,
      backgroundColor: colors.accent,
    });
  });

  it("draws a missed segment in the muted orange", () => {
    expect(segmentedProgressStyle("missed", "exercise")).toEqual({
      ...base,
      backgroundColor: colors.miss,
    });
  });

  it("draws the current and pending segments in the border color", () => {
    expect(segmentedProgressStyle("current", "exercise").backgroundColor).toBe(colors.border);
    expect(segmentedProgressStyle("pending", "exercise").backgroundColor).toBe(colors.border);
  });

  it("spaces the segments 6 apart and takes the header row's leftover width", () => {
    expect(segmentedProgressBar("exercise")).toEqual({
      flexDirection: "row",
      gap: spacing.stack,
      flex: 1,
      minWidth: 0,
    });
  });
});

describe("segmentedProgressStyle in the step look", () => {
  it("draws done segments in the accent and the others in the border color", () => {
    expect(segmentedProgressStyle("done", "step").backgroundColor).toBe(colors.accent);
    expect(segmentedProgressStyle("pending", "step").backgroundColor).toBe(colors.border);
  });

  it("uses the progress bar height with no radius", () => {
    expect(segmentedProgressStyle("done", "step")).toEqual({
      flex: 1,
      height: size.progressBar,
      backgroundColor: colors.accent,
    });
  });

  it("spaces the segments 4 apart", () => {
    expect(segmentedProgressBar("step")).toEqual({ flexDirection: "row", gap: spacing.xs });
  });
});
