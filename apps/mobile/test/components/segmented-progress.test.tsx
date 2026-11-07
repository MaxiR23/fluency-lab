// apps/mobile/test/components/segmented-progress.test.tsx
//
// Tests for SegmentedProgress.
//
// Tested:
// - It is a progress bar that announces its label and how far it is
// - It draws one segment per state
// - The fill of the answered segment is drawn full with no motion
//
// What is covered:
// - Normal case, reduce motion, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/segmented-progress.test.tsx
//
// SEE: apps/mobile/src/components/segmented-progress.tsx

import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { SegmentedProgress } from "@/components/segmented-progress";
import { colors, motion } from "@/constants/theme";

const states = ["done", "missed", "current", "pending", "pending"] as const;

describe("SegmentedProgress", () => {
  it("announces exercise 3 of 5 as a progress bar", async () => {
    await render(
      <SegmentedProgress segments={[...states]} look="exercise" label="Exercise 3 of 5" />,
    );
    const bar = screen.getByRole("progressbar", { name: "Exercise 3 of 5" });
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 5, now: 3 });
  });

  it("draws one segment per state", async () => {
    await render(<SegmentedProgress segments={[...states]} look="exercise" label="x" />);
    const segments = screen.getAllByTestId("progress-segment");
    expect(
      segments.map((segment) => StyleSheet.flatten(segment.props.style).backgroundColor),
    ).toEqual([colors.accent, colors.miss, colors.border, colors.border, colors.border]);
  });

  it("draws fifteen segments for a run of fifteen", async () => {
    await render(
      <SegmentedProgress
        segments={Array.from({ length: 15 }, () => "pending" as const)}
        look="exercise"
        label="x"
      />,
    );
    expect(screen.getAllByTestId("progress-segment")).toHaveLength(15);
    expect(screen.getByRole("progressbar").props.accessibilityValue).toEqual({
      min: 0,
      max: 15,
      now: 0,
    });
  });

  it("draws the answered segment full when there is no motion", async () => {
    await render(
      <SegmentedProgress
        segments={["done", "pending"]}
        look="exercise"
        label="x"
        fill={{ index: 0, motion: null }}
      />,
    );
    const fill = screen.getByTestId("progress-fill");
    expect(StyleSheet.flatten(fill.props.style)).toMatchObject({ backgroundColor: colors.accent });
    expect(StyleSheet.flatten(fill.props.style).transform).toEqual([{ scaleX: 1 }]);
  });

  it("starts the answered segment empty when it moves", async () => {
    await render(
      <SegmentedProgress
        segments={["done", "pending"]}
        look="exercise"
        label="x"
        fill={{ index: 0, motion: { duration: 1000, curve: motion.ring } }}
      />,
    );
    expect(StyleSheet.flatten(screen.getByTestId("progress-fill").props.style).transform).toEqual([
      { scaleX: 0 },
    ]);
  });

  it("draws a missed answered segment in the muted orange", async () => {
    await render(
      <SegmentedProgress
        segments={["missed"]}
        look="exercise"
        label="x"
        fill={{ index: 0, motion: null }}
      />,
    );
    expect(StyleSheet.flatten(screen.getByTestId("progress-fill").props.style)).toMatchObject({
      backgroundColor: colors.miss,
    });
  });

  it("draws no fill when nothing was answered", async () => {
    await render(
      <SegmentedProgress segments={[...states]} look="exercise" label="x" fill={null} />,
    );
    expect(screen.queryByTestId("progress-fill")).toBeNull();
  });
});
