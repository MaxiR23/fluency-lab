// apps/mobile/test/components/message-list.test.tsx
//
// Tests for MessageList.
//
// Tested:
// - The items in order, the typing indicator and the newest kept in view
// - The newest message stays in view when the list shrinks for a taller input
// - The keyboard lift offset, the still dots with reduce motion on and items added after mount
// - A tutor row swipes to reply, a learner row does not, and a quote scrolls to its original row
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/message-list.test.tsx
//
// SEE: apps/mobile/src/components/message-list.tsx

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { ScrollView, StyleSheet } from "react-native";
import { GestureHandlerRootView, State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { MessageList } from "@/components/message-list";
import { motion as tokens, spacing } from "@/constants/theme";
import type { ChatItem } from "@/utils/chat-items";
import { chatKeyboardLayout } from "@/utils/chat-keyboard";
import { chatMotion, type ChatMotion } from "@/utils/chat-motion";

const items: ChatItem[] = [
  { kind: "tutor", id: "1", text: "Where did you go?" },
  {
    kind: "user",
    id: "2",
    text: "I goed to Rome",
    corrections: [{ original: "goed", corrected: "went" }],
    explanation: "Go is irregular.",
    quote: null,
  },
  { kind: "new_word", id: "3", word: "itinerary" },
];

function list(
  listItems: ChatItem[],
  motion: ChatMotion = chatMotion(false),
  handlers: { onReply?: (id: string) => void; onArm?: () => void } = {},
) {
  return (
    <GestureHandlerRootView>
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom: 34 },
        }}
      >
        <MessageList items={listItems} motion={motion} {...handlers} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const quoted: ChatItem[] = [
  { kind: "tutor", id: "1", text: "Where did you go?" },
  {
    kind: "user",
    id: "2",
    text: "To Rome",
    corrections: [],
    explanation: null,
    quote: { targetId: "1", author: "Claude", text: "Where did you go?" },
  },
];

async function swipeRight(id: string) {
  await act(async () => {
    fireGestureHandler(getByGestureTestId(`reply-swipe-${id}`), [
      { state: State.BEGAN },
      { state: State.ACTIVE, translationX: 0 },
      { state: State.ACTIVE, translationX: tokens.replySwipe },
      { state: State.END, translationX: tokens.replySwipe },
    ]);
  });
}

describe("MessageList", () => {
  beforeEach(() => {
    jest.mocked(ScrollView.prototype.scrollToEnd).mockClear();
    jest.mocked(ScrollView.prototype.scrollTo).mockClear();
  });

  it("draws tutor, user with corrections and new word items in order", async () => {
    await render(list(items));
    const drawn = JSON.stringify(screen.toJSON());
    const at = ["Where did you go?", "I goed to Rome", "1 correction", "New word", "itinerary"].map(
      (text) => drawn.indexOf(text),
    );
    expect(at.every((index) => index >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(screen.getByText("Go is irregular.")).toBeTruthy();
  });

  it("draws the typing indicator for a typing item", async () => {
    await render(list([...items, { kind: "typing", id: "typing" }]));
    expect(screen.getByTestId("typing-indicator")).toBeTruthy();
  });

  it("draws no typing indicator without a typing item", async () => {
    await render(list(items));
    expect(screen.queryByTestId("typing-indicator")).toBeNull();
  });

  it("draws no bubble for an empty conversation", async () => {
    await render(list([]));
    expect(screen.getByTestId("message-list")).toBeTruthy();
    expect(screen.queryByText("New word")).toBeNull();
    expect(screen.queryByText(/correction/)).toBeNull();
  });

  it("scrolls to the newest message when the content grows", async () => {
    await render(list(items));
    await fireEvent(screen.getByTestId("message-list"), "contentSizeChange", 0, 100);
    expect(ScrollView.prototype.scrollToEnd).toHaveBeenCalledWith({ animated: false });
  });

  it("scrolls to the newest message when the list is first laid out", async () => {
    await render(list(items));
    await fireEvent(screen.getByTestId("message-list"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 200 } },
    });
    expect(ScrollView.prototype.scrollToEnd).toHaveBeenCalledWith({ animated: false });
  });

  it("keeps the newest message in view when the list shrinks for a taller input", async () => {
    await render(list(items));
    const frame = (height: number) => ({
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height } },
    });
    await fireEvent(screen.getByTestId("message-list"), "layout", frame(200));
    jest.mocked(ScrollView.prototype.scrollToEnd).mockClear();
    await fireEvent(screen.getByTestId("message-list"), "layout", frame(150));
    expect(ScrollView.prototype.scrollToEnd).toHaveBeenCalledWith({ animated: false });
  });

  it("lifts the list by the keyboard minus the layout offset", async () => {
    await render(list(items));
    expect(screen.getByTestId("message-list").props.offset).toBe(chatKeyboardLayout(34).listOffset);
  });

  it("draws the typing dots still with reduce motion on", async () => {
    await render(list([{ kind: "typing", id: "typing" }], chatMotion(true)));
    for (const index of [0, 1, 2]) {
      const dot = screen.getByTestId(`typing-dot-${index}`);
      expect(StyleSheet.flatten(dot.props.style).opacity).toBe(1);
    }
  });

  it("draws a message added after mount", async () => {
    const { rerender } = await render(list(items));
    const added: ChatItem = { kind: "tutor", id: "4", text: "Tell me more." };
    await rerender(list([...items, added]));
    const drawn = JSON.stringify(screen.toJSON());
    expect(drawn.indexOf("Tell me more.")).toBeGreaterThan(drawn.indexOf("itinerary"));
  });

  it("a tutor row can be swiped to reply and calls onReply with its id", async () => {
    const onReply = jest.fn();
    const onArm = jest.fn();
    await render(list(items, chatMotion(false), { onReply, onArm }));

    await swipeRight("1");

    expect(onArm).toHaveBeenCalledTimes(1);
    expect(onReply).toHaveBeenCalledWith("1");
  });

  it("a learner row has no reply gesture", async () => {
    await render(list(items, chatMotion(false), { onReply: () => {} }));
    expect(() => getByGestureTestId("reply-swipe-2")).toThrow();
  });

  it("no row can be swiped without onReply", async () => {
    await render(list(items));
    expect(() => getByGestureTestId("reply-swipe-1")).toThrow();
  });

  it("draws the quote on a learner reply", async () => {
    await render(list(quoted));
    expect(screen.getByRole("button", { name: "Go to the quoted message" })).toBeTruthy();
    expect(screen.getByText("Claude")).toBeTruthy();
    expect(screen.getByText("To Rome")).toBeTruthy();
  });

  it("tapping the quote scrolls to the original row", async () => {
    await render(list(quoted));
    await fireEvent(screen.getByTestId("row-1"), "layout", {
      nativeEvent: { layout: { x: 0, y: 400, width: 300, height: 60 } },
    });

    await fireEvent.press(screen.getByRole("button", { name: "Go to the quoted message" }));

    expect(ScrollView.prototype.scrollTo).toHaveBeenCalledWith({
      y: 400 - spacing.screenSide,
      animated: true,
    });
  });

  it("the quote scrolls without animation with reduce motion on", async () => {
    await render(list(quoted, chatMotion(true)));
    await fireEvent(screen.getByTestId("row-1"), "layout", {
      nativeEvent: { layout: { x: 0, y: 400, width: 300, height: 60 } },
    });

    await fireEvent.press(screen.getByRole("button", { name: "Go to the quoted message" }));

    expect(ScrollView.prototype.scrollTo).toHaveBeenCalledWith({
      y: 400 - spacing.screenSide,
      animated: false,
    });
  });

  it("the quote of a row that has not laid out does not scroll", async () => {
    await render(list(quoted));

    await fireEvent.press(screen.getByRole("button", { name: "Go to the quoted message" }));

    expect(ScrollView.prototype.scrollTo).not.toHaveBeenCalled();
  });
});
