// apps/mobile/test/components/new-word.test.tsx
//
// Tests for NewWord.
//
// Tested:
// - The outline New word tag and the word
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/new-word.test.tsx
//
// SEE: apps/mobile/src/components/new-word.tsx

import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { NewWord } from "@/components/new-word";
import { textStyle } from "@/components/text-style";

describe("NewWord", () => {
  it("draws the outline New word tag and the word", async () => {
    await render(<NewWord word="itinerary" />);
    expect(StyleSheet.flatten(screen.getByText("New word").props.style)).toMatchObject(
      textStyle("tagOutline"),
    );
    expect(StyleSheet.flatten(screen.getByText("itinerary").props.style)).toMatchObject(
      textStyle("caption"),
    );
  });
});
