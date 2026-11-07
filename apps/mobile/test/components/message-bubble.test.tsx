// apps/mobile/test/components/message-bubble.test.tsx
//
// Tests for MessageBubble.
//
// Tested:
// - The text in the message style inside the role's bubble
// - The quote above the text, and no quote without one
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/message-bubble.test.tsx
//
// SEE: apps/mobile/src/components/message-bubble.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";

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

  it("draws the quote above the text", async () => {
    const onPress = jest.fn();
    await render(
      <MessageBubble
        role="user"
        text="To Rome"
        quote={{ author: "Claude", text: "Where did you go?", onPress }}
      />,
    );

    expect(screen.getByText("Claude")).toBeTruthy();
    expect(screen.getByText("Where did you go?")).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByText("To Rome").parent?.props.style)).toMatchObject(
      messageBubbleStyle("user", { quoted: true }).body ?? {},
    );
    await fireEvent.press(screen.getByRole("button", { name: "Go to the quoted message" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("draws no quote without one", async () => {
    await render(<MessageBubble role="user" text="To Rome" />);
    expect(screen.queryByRole("button", { name: "Go to the quoted message" })).toBeNull();
  });

  it("draws a note below the text of a tutor bubble in the wider note bubble", async () => {
    await render(
      <MessageBubble role="tutor" text="Here is your table." note={<Text>note slot</Text>} />,
    );
    const text = screen.getByText("Here is your table.");
    expect(StyleSheet.flatten(text.parent?.props.style)).toMatchObject(
      messageBubbleStyle("tutor", { note: true }).bubble,
    );
    expect(screen.getByText("note slot").parent).toBe(text.parent);
  });

  it("draws no gap without a note", async () => {
    await render(<MessageBubble role="tutor" text="Hi" />);
    expect(StyleSheet.flatten(screen.getByText("Hi").parent?.props.style)).not.toHaveProperty(
      "gap",
    );
  });
});
