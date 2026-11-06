// apps/mobile/test/components/suggestion-card.test.tsx
//
// Tests for SuggestionCard.
//
// Tested:
// - The card: icon, tag, title, why line, role and its two layouts
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/suggestion-card.test.tsx
//
// SEE: apps/mobile/src/components/suggestion-card.tsx

import type { Suggestion } from "@fluency-lab/shared";
import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { SuggestionCard } from "@/components/suggestion-card";
import { size } from "@/constants/theme";

const suggestion: Suggestion = {
  id: "travel-trip",
  title: "Your best trip",
  opener: "What is the best trip you have ever taken?",
  topicId: "travel",
  goal: null,
  tag: "Your interests",
  why: "Because you like Travel",
};

describe("SuggestionCard", () => {
  it("draws the icon, the tag, the title and the why line", async () => {
    await render(<SuggestionCard suggestion={suggestion} layout="carousel" onPress={jest.fn()} />);
    expect(screen.getByTestId("icon-globe", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText("Your interests")).toBeTruthy();
    expect(screen.getByText("Your best trip")).toBeTruthy();
    expect(screen.getByText("Because you like Travel")).toBeTruthy();
  });

  it("is a button named by its title", async () => {
    const onPress = jest.fn();
    await render(<SuggestionCard suggestion={suggestion} layout="list" onPress={onPress} />);
    await fireEvent.press(screen.getByRole("button", { name: "Your best trip" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("is 200 wide in the carousel and full width in a list", async () => {
    const { rerender } = await render(
      <SuggestionCard suggestion={suggestion} layout="carousel" onPress={jest.fn()} />,
    );
    let style = StyleSheet.flatten(
      screen.getByRole("button", { name: "Your best trip" }).props.style,
    );
    expect(style.width).toBe(size.suggestionCard);
    await rerender(<SuggestionCard suggestion={suggestion} layout="list" onPress={jest.fn()} />);
    style = StyleSheet.flatten(screen.getByRole("button", { name: "Your best trip" }).props.style);
    expect(style.width).toBeUndefined();
    expect(style.alignSelf).toBe("stretch");
  });

  it("draws the goal's icon for a goal starter", async () => {
    const goal: Suggestion = { ...suggestion, topicId: null, goal: "exams" };
    await render(<SuggestionCard suggestion={goal} layout="list" onPress={jest.fn()} />);
    expect(screen.getByTestId("icon-clipboard", { includeHiddenElements: true })).toBeTruthy();
  });
});
