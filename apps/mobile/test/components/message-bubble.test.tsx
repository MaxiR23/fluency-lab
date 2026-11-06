// apps/mobile/test/components/message-bubble.test.tsx
//
// Tests for MessageBubble.
//
// Tested:
// - The text in the message style inside the role's bubble
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/message-bubble.test.tsx
//
// SEE: apps/mobile/src/components/message-bubble.tsx

import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { MessageBubble } from "@/components/message-bubble";
import { messageBubbleStyle } from "@/components/message-bubble-style";
import { textStyle } from "@/components/text-style";

describe("MessageBubble", () => {
  it("draws the text in the message style inside the role's bubble", async () => {
    await render(<MessageBubble role="user" text="I goed home" />);
    const text = screen.getByText("I goed home");
    expect(StyleSheet.flatten(text.props.style)).toMatchObject(textStyle("message"));
    expect(StyleSheet.flatten(text.parent?.props.style)).toMatchObject(
      messageBubbleStyle("user").bubble,
    );
  });

  it("draws the tutor bubble for the tutor", async () => {
    await render(<MessageBubble role="tutor" text="Where to?" />);
    expect(StyleSheet.flatten(screen.getByText("Where to?").parent?.props.style)).toMatchObject(
      messageBubbleStyle("tutor").bubble,
    );
  });
});
