// apps/mobile/test/components/step-progress.test.tsx
//
// Tests for StepProgress.
//
// Tested:
// - The step label and the filled segments
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/step-progress.test.tsx
//
// SEE: apps/mobile/src/components/step-progress.tsx

import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { StepProgress } from "@/components/step-progress";
import { colors } from "@/constants/theme";

describe("StepProgress", () => {
  it("draws the step label and fills two of four segments at step 2", async () => {
    await render(<StepProgress step={2} total={4} />);
    expect(screen.getByText("Step 2 of 4")).toBeTruthy();
    const segments = screen.getAllByTestId("progress-segment");
    expect(
      segments.map((segment) => StyleSheet.flatten(segment.props.style).backgroundColor),
    ).toEqual([colors.accent, colors.accent, colors.border, colors.border]);
  });
});
