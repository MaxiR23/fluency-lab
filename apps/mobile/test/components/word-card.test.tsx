// apps/mobile/test/components/word-card.test.tsx
//
// Tests for WordCard.
//
// Tested:
// - The word, the date and the sentence
// - The word, date and sentence variants and the card tokens
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/word-card.test.tsx
//
// SEE: apps/mobile/src/components/word-card.tsx

import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { textStyle } from "@/components/text-style";
import { WordCard } from "@/components/word-card";
import { borderWidth, colors, radius, spacing } from "@/constants/theme";

const props = { word: "catchy", sentence: '"That song is catchy."', date: "Nov 5" };

describe("WordCard", () => {
  it("draws the word, the date and the sentence", async () => {
    await render(<WordCard {...props} />);
    expect(screen.getByText("catchy")).toBeTruthy();
    expect(screen.getByText("Nov 5")).toBeTruthy();
    expect(screen.getByText('"That song is catchy."')).toBeTruthy();
  });

  it("draws the word in the word variant, the date as why and the sentence as quote", async () => {
    await render(<WordCard {...props} />);
    expect(StyleSheet.flatten(screen.getByText("catchy").props.style)).toMatchObject(
      textStyle("word"),
    );
    expect(StyleSheet.flatten(screen.getByText("Nov 5").props.style)).toMatchObject(
      textStyle("why"),
    );
    expect(
      StyleSheet.flatten(screen.getByText('"That song is catchy."').props.style),
    ).toMatchObject(textStyle("quote"));
  });

  it("is a surface card with the card and md padding, the control radius and an xs gap", async () => {
    await render(<WordCard {...props} />);
    expect(StyleSheet.flatten(screen.getByTestId("word-card").props.style)).toMatchObject({
      gap: spacing.xs,
      paddingVertical: spacing.card,
      paddingHorizontal: spacing.md,
      borderRadius: radius.control,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: borderWidth.thin,
    });
  });
});
