// apps/mobile/test/components/chat-composer.test.tsx
//
// Tests for ChatComposer.
//
// Tested:
// - The composer: input and the Send icon button, enabled, disabled or locked
// - The typed text and the send press are reported
// - Busy keeps the open input and disables Send
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/chat-composer.test.tsx
//
// SEE: apps/mobile/src/components/chat-composer.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { ChatComposer } from "@/components/chat-composer";
import { colors } from "@/constants/theme";

function composer(props: Partial<React.ComponentProps<typeof ChatComposer>> = {}) {
  return (
    <ChatComposer
      value=""
      onChangeText={() => {}}
      onSend={() => {}}
      placeholder="Type here"
      locked={false}
      {...props}
    />
  );
}

describe("ChatComposer", () => {
  it("keeps Send disabled while the input is empty", async () => {
    await render(composer());
    expect(screen.getByRole("button", { name: "Send", disabled: true })).toBeTruthy();
    expect(screen.getByPlaceholderText("Type here").props.placeholderTextColor).toBe(
      colors.textPlaceholder,
    );
  });

  it("enables Send once the input has text and calls onSend", async () => {
    const onSend = jest.fn();
    await render(composer({ value: "Hello", onSend }));
    await fireEvent.press(screen.getByRole("button", { name: "Send", disabled: false }));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("keeps Send disabled for only spaces", async () => {
    await render(composer({ value: "   " }));
    expect(screen.getByRole("button", { name: "Send", disabled: true })).toBeTruthy();
  });

  it("locks the input and Send when locked", async () => {
    await render(composer({ value: "Hello", locked: true }));
    expect(screen.getByPlaceholderText("Type here").props.editable).toBe(false);
    expect(screen.getByRole("button", { name: "Send", disabled: true })).toBeTruthy();
    expect(screen.getByPlaceholderText("Type here").props.placeholderTextColor).toBe(
      colors.textDisabled,
    );
  });

  it("disables Send while busy and keeps the input open and editable", async () => {
    await render(composer({ value: "Hello", busy: true }));
    expect(screen.getByRole("button", { name: "Send", disabled: true })).toBeTruthy();
    const input = screen.getByPlaceholderText("Type here");
    expect(input.props.editable).toBe(true);
    expect(input.props.placeholderTextColor).toBe(colors.textPlaceholder);
  });

  it("limits the text to the longest message the API saves", async () => {
    await render(composer());
    expect(screen.getByPlaceholderText("Type here").props.maxLength).toBe(4000);
  });

  it("draws Send as the paper-plane icon with no text label", async () => {
    await render(composer());
    expect(screen.getByTestId("icon-send", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText("Send")).toBeNull();
  });

  it("forwards typed text to onChangeText", async () => {
    const onChangeText = jest.fn();
    await render(composer({ onChangeText }));
    await fireEvent.changeText(screen.getByLabelText("Message"), "Hi");
    expect(onChangeText).toHaveBeenCalledWith("Hi");
  });

  it("draws the glow wrapper only when Send is enabled", async () => {
    const { rerender } = await render(composer({ value: "Hello" }));
    expect(screen.getByTestId("send-glow")).toBeTruthy();
    await rerender(composer({ value: "" }));
    expect(screen.queryByTestId("send-glow")).toBeNull();
  });
});
