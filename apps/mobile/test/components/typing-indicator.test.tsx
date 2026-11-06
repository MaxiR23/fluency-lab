// apps/mobile/test/components/typing-indicator.test.tsx
//
// Tests for TypingIndicator.
//
// Tested:
// - The indicator is labeled and drawn in the tutor's bubble row with three dots
// - The dots start at the resting opacity, or still at full opacity with reduce motion on
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
import { colors, motion, radius, size, spacing } from "@/constants/theme";
import { chatMotion } from "@/utils/chat-motion";

describe("TypingIndicator", () => {
  it("is labeled for screen readers", async () => {
    await render(<TypingIndicator motion={chatMotion(false)} />);
    expect(screen.getByLabelText("Tutor is typing")).toBeTruthy();
    expect(screen.getByTestId("typing-indicator")).toBeTruthy();
  });

  it("uses the tutor's row and bubble", async () => {
    await render(<TypingIndicator motion={chatMotion(false)} />);
    const row = StyleSheet.flatten(screen.getByTestId("typing-indicator").props.style);
    expect(row.alignSelf).toBe(messageBubbleStyle("tutor").row.alignSelf);
    const bubble = StyleSheet.flatten(screen.getByTestId("typing-indicator-bubble").props.style);
    expect(bubble.backgroundColor).toBe(messageBubbleStyle("tutor").bubble.backgroundColor);
  });

  it("draws three dots of the design's size and color", async () => {
    await render(<TypingIndicator motion={chatMotion(false)} />);
    const bubble = StyleSheet.flatten(screen.getByTestId("typing-indicator-bubble").props.style);
    expect(bubble).toMatchObject({
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.typingDot,
    });
    for (const index of [0, 1, 2]) {
      expect(
        StyleSheet.flatten(screen.getByTestId(`typing-dot-${index}`).props.style),
      ).toMatchObject({
        width: size.typingDot,
        height: size.typingDot,
        borderRadius: radius.pill,
        backgroundColor: colors.textMuted,
      });
    }
    expect(screen.queryByTestId("typing-dot-3")).toBeNull();
  });

  it("starts the dots at the resting opacity when animated", async () => {
    await render(<TypingIndicator motion={chatMotion(false)} />);
    for (const index of [0, 1, 2]) {
      const style = StyleSheet.flatten(screen.getByTestId(`typing-dot-${index}`).props.style);
      expect(style.opacity).toBe(motion.dotRestOpacity);
    }
  });

  it("draws the dots still at full opacity with reduce motion on", async () => {
    await render(<TypingIndicator motion={chatMotion(true)} />);
    for (const index of [0, 1, 2]) {
      const style = StyleSheet.flatten(screen.getByTestId(`typing-dot-${index}`).props.style);
      expect(style.opacity).toBe(1);
    }
  });
});
