// apps/mobile/test/components/mistake-card.test.tsx
//
// Tests for MistakeCard.
//
// Tested:
// - The rule, the times pill and the example with the struck original
// - The card tokens
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/mistake-card.test.tsx
//
// SEE: apps/mobile/src/components/mistake-card.tsx

import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { MistakeCard } from "@/components/mistake-card";
import { textStyle } from "@/components/text-style";
import { borderWidth, colors, radius, spacing } from "@/constants/theme";

const props = {
  rule: "Present perfect",
  times: "5 times",
  original: "I have went",
  corrected: "I have gone",
};

describe("MistakeCard", () => {
  it("draws the rule, the times pill and the struck original before the correction", async () => {
    await render(<MistakeCard {...props} />);
    expect(screen.getByText("Present perfect")).toBeTruthy();
    expect(screen.getByText("5 times")).toBeTruthy();
    expect(screen.getByText("I have went")).toBeTruthy();
    expect(screen.getByText(/→ I have gone/)).toBeTruthy();
  });

  it("draws the original with the struck variant and the rule as body strong", async () => {
    await render(<MistakeCard {...props} />);
    expect(StyleSheet.flatten(screen.getByText("I have went").props.style)).toMatchObject(
      textStyle("struck"),
    );
    expect(StyleSheet.flatten(screen.getByText("Present perfect").props.style)).toMatchObject(
      textStyle("bodyStrong"),
    );
  });

  it("is a surface card with the card and md padding, the control radius and an sm gap", async () => {
    await render(<MistakeCard {...props} />);
    expect(StyleSheet.flatten(screen.getByTestId("mistake-card").props.style)).toMatchObject({
      gap: spacing.sm,
      paddingVertical: spacing.card,
      paddingHorizontal: spacing.md,
      borderRadius: radius.control,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: borderWidth.thin,
    });
  });
});
