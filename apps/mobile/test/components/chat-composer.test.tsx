// apps/mobile/test/components/chat-composer.test.tsx
//
// Tests for ChatComposer.
//
// Tested:
// - The composer: input and the Send icon button, enabled, disabled or locked
// - The typed text and the send press are reported
// - Busy keeps the open input and disables Send
// - The input takes several lines, grows to five, then scrolls; Send stays at the bottom of the row
// - Send scales while pressed, and not with reduce motion on (press null)
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/chat-composer.test.tsx
//
// SEE: apps/mobile/src/components/chat-composer.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import * as Reanimated from "react-native-reanimated";

import { ChatComposer } from "@/components/chat-composer";
import { composerMaxHeight } from "@/components/chat-composer-style";
import { colors, motion, radius, size } from "@/constants/theme";
import { chatMotion } from "@/utils/chat-motion";

// INFO: Reanimated styles do not advance under jest, so the press is proven by the target
// Send is animated to: withTiming is wrapped to record it and still return the real value.
jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual<typeof Reanimated>("react-native-reanimated");
  return {
    ...actual,
    __esModule: true,
    default: actual.default,
    withTiming: jest.fn(actual.withTiming),
  };
});

function composer(props: Partial<React.ComponentProps<typeof ChatComposer>> = {}) {
  return (
    <ChatComposer
      value=""
      onChangeText={() => {}}
      onSend={() => {}}
      placeholder="Type here"
      locked={false}
      press={chatMotion(false).press}
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

  it("starts Send at full scale", async () => {
    await render(composer({ value: "Hello" }));
    const style = StyleSheet.flatten(screen.getByTestId("send-scale").props.style);
    expect(style.transform).toEqual([{ scale: 1 }]);
  });

  it("keeps Send at full scale when pressed with reduce motion on", async () => {
    await render(composer({ value: "Hello", press: null }));
    await fireEvent(screen.getByRole("button", { name: "Send" }), "pressIn");
    const style = StyleSheet.flatten(screen.getByTestId("send-scale").props.style);
    expect(style.transform).toEqual([{ scale: 1 }]);
  });

  it("animates Send down to the design's press scale on press in, and back on press out", async () => {
    const withTiming = jest.mocked(Reanimated.withTiming);
    withTiming.mockClear();
    await render(composer({ value: "Hello" }));
    const send = screen.getByRole("button", { name: "Send" });
    await fireEvent(send, "pressIn");
    expect(withTiming.mock.calls.map(([target]) => target)).toEqual([motion.pressScale]);
    await fireEvent(send, "pressOut");
    expect(withTiming.mock.calls.map(([target]) => target)).toEqual([motion.pressScale, 1]);
  });

  it("leaves the bottom padding to the footer", async () => {
    await render(composer());
    const row = screen.getByLabelText("Message").parent;
    expect(StyleSheet.flatten(row?.props.style).paddingBottom).toBeUndefined();
  });

  it("takes several lines and inserts a new line on return", async () => {
    await render(composer());
    const props = screen.getByLabelText("Message").props;
    expect(props.multiline).toBe(true);
    expect(props.submitBehavior).toBe("newline");
    expect(props.onSubmitEditing).toBeUndefined();
  });

  it("rounds the input to the control radius once it grows past one line, and back", async () => {
    await render(composer());
    const input = screen.getByLabelText("Message");
    await fireEvent(input, "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: composerMaxHeight } },
    });
    expect(StyleSheet.flatten(screen.getByLabelText("Message").props.style).borderRadius).toBe(
      radius.control,
    );
    await fireEvent(input, "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: size.control } },
    });
    expect(StyleSheet.flatten(screen.getByLabelText("Message").props.style).borderRadius).toBe(
      radius.pill,
    );
  });

  it("starts as a pill before it is laid out", async () => {
    await render(composer());
    expect(StyleSheet.flatten(screen.getByLabelText("Message").props.style).borderRadius).toBe(
      radius.pill,
    );
  });

  it("caps the input at five lines and scrolls inside", async () => {
    await render(composer());
    const input = screen.getByLabelText("Message");
    expect(StyleSheet.flatten(input.props.style).maxHeight).toBe(composerMaxHeight);
    expect(input.props.scrollEnabled).not.toBe(false);
  });

  it("keeps Send at the bottom of the row as the input grows", async () => {
    await render(composer());
    const row = screen.getByLabelText("Message").parent;
    expect(StyleSheet.flatten(row?.props.style).alignItems).toBe("flex-end");
  });
});
