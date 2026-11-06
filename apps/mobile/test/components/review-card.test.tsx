// apps/mobile/test/components/review-card.test.tsx
//
// Tests for ReviewCard.
//
// Tested:
// - The struck original, the arrow and the corrected text
// - The rule under the correction, and none for a correction saved before rules
// - The surface card style
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/review-card.test.tsx
//
// SEE: apps/mobile/src/components/review-card.tsx

import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { ReviewCard } from "@/components/review-card";
import { textStyle } from "@/components/text-style";
import { borderWidth, colors, radius, spacing } from "@/constants/theme";

const correction = { original: "I never been", corrected: "I've never been" };

describe("ReviewCard", () => {
  it("draws the struck original, the arrow and the corrected text", async () => {
    await render(<ReviewCard correction={correction} />);
    const struck = screen.getByText("I never been");
    expect(StyleSheet.flatten(struck.props.style).textDecorationLine).toBe("line-through");
    expect(screen.getByText(/→ I've never been/)).toBeTruthy();
  });

  it("draws the rule under the correction", async () => {
    await render(
      <ReviewCard correction={{ ...correction, rule: "Present perfect for experiences" }} />,
    );
    const rule = screen.getByText("Present perfect for experiences");
    expect(StyleSheet.flatten(rule.props.style)).toMatchObject(textStyle("why"));
  });

  it("draws no rule line for a correction saved before rules", async () => {
    await render(<ReviewCard correction={correction} />);
    expect(screen.getByTestId("review-card").children).toHaveLength(1);
  });

  it("is a surface card with group and card padding, the note radius and an xs gap", async () => {
    await render(<ReviewCard correction={correction} />);
    expect(StyleSheet.flatten(screen.getByTestId("review-card").props.style)).toMatchObject({
      gap: spacing.xs,
      paddingVertical: spacing.group,
      paddingHorizontal: spacing.card,
      borderRadius: radius.note,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: borderWidth.thin,
    });
  });
});
