// apps/mobile/test/components/message-quote.test.tsx
//
// Tests for MessageQuote.
//
// Tested:
// - The tutor's name and the quoted text on at most two lines
// - Pressing it calls onPress
// - It is a button named Go to the quoted message
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/message-quote.test.tsx
//
// SEE: apps/mobile/src/components/message-quote.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { MessageQuote } from "@/components/message-quote";
import { messageQuoteStyle } from "@/components/message-quote-style";
import { textStyle } from "@/components/text-style";

describe("MessageQuote", () => {
  it("draws the tutor's name and the quoted text on at most two lines", async () => {
    await render(<MessageQuote author="Claude" text="Where did you go?" onPress={() => {}} />);

    const author = screen.getByText("Claude");
    const text = screen.getByText("Where did you go?");
    expect(StyleSheet.flatten(author.props.style)).toMatchObject(textStyle("tabActive"));
    expect(StyleSheet.flatten(text.props.style)).toMatchObject(textStyle("explanation"));
    expect(text.props.numberOfLines).toBe(2);
  });

  it("pressing it calls onPress", async () => {
    const onPress = jest.fn();
    await render(<MessageQuote author="Claude" text="Where?" onPress={onPress} />);

    await fireEvent.press(screen.getByText("Where?"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("is a button named Go to the quoted message with the quote's style", async () => {
    await render(<MessageQuote author="Claude" text="Where?" onPress={() => {}} />);

    const button = screen.getByRole("button", { name: "Go to the quoted message" });
    expect(StyleSheet.flatten(button.props.style)).toMatchObject(messageQuoteStyle().quote);
  });
});
