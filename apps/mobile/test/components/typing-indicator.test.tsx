// apps/mobile/test/components/typing-indicator.test.tsx
//
// Tests for TypingIndicator.
//
// Tested:
// - The indicator is labeled and drawn in the tutor's bubble row
//
// What is covered:
// - Normal case
//
// Run with: pnpm exec jest apps/mobile/test/components/typing-indicator.test.tsx
//
// SEE: apps/mobile/src/components/typing-indicator.tsx

import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { messageBubbleStyle } from "@/components/message-bubble-style";
import { TypingIndicator } from "@/components/typing-indicator";

describe("TypingIndicator", () => {
  it("is labeled for screen readers", async () => {
    await render(<TypingIndicator />);
    expect(screen.getByLabelText("Tutor is typing")).toBeTruthy();
    expect(screen.getByTestId("typing-indicator")).toBeTruthy();
  });

  it("uses the tutor's row and bubble", async () => {
    await render(<TypingIndicator />);
    const row = StyleSheet.flatten(screen.getByTestId("typing-indicator").props.style);
    expect(row.alignSelf).toBe(messageBubbleStyle("tutor").row.alignSelf);
    const bubble = StyleSheet.flatten(screen.getByTestId("typing-indicator-bubble").props.style);
    expect(bubble.backgroundColor).toBe(messageBubbleStyle("tutor").bubble.backgroundColor);
  });
});
