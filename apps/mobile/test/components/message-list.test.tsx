// apps/mobile/test/components/message-list.test.tsx
//
// Tests for MessageList.
//
// Tested:
// - The items in order, the typing indicator and the newest kept in view
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/message-list.test.tsx
//
// SEE: apps/mobile/src/components/message-list.tsx

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ScrollView } from "react-native";

import { MessageList } from "@/components/message-list";
import type { ChatItem } from "@/utils/chat-items";

const items: ChatItem[] = [
  { kind: "tutor", id: "1", text: "Where did you go?" },
  {
    kind: "user",
    id: "2",
    text: "I goed to Rome",
    corrections: [{ original: "goed", corrected: "went" }],
    explanation: "Go is irregular.",
  },
  { kind: "new_word", id: "3", word: "itinerary" },
];

describe("MessageList", () => {
  beforeEach(() => {
    jest.mocked(ScrollView.prototype.scrollToEnd).mockClear();
  });

  it("draws tutor, user with corrections and new word items in order", async () => {
    await render(<MessageList items={items} />);
    const drawn = JSON.stringify(screen.toJSON());
    const at = ["Where did you go?", "I goed to Rome", "1 correction", "New word", "itinerary"].map(
      (text) => drawn.indexOf(text),
    );
    expect(at.every((index) => index >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(screen.getByText("Go is irregular.")).toBeTruthy();
  });

  it("draws the typing indicator for a typing item", async () => {
    await render(<MessageList items={[...items, { kind: "typing", id: "typing" }]} />);
    expect(screen.getByTestId("typing-indicator")).toBeTruthy();
  });

  it("draws no typing indicator without a typing item", async () => {
    await render(<MessageList items={items} />);
    expect(screen.queryByTestId("typing-indicator")).toBeNull();
  });

  it("draws no bubble for an empty conversation", async () => {
    await render(<MessageList items={[]} />);
    expect(screen.getByTestId("message-list")).toBeTruthy();
    expect(screen.queryByText("New word")).toBeNull();
    expect(screen.queryByText(/correction/)).toBeNull();
  });

  it("scrolls to the newest message when the content grows", async () => {
    await render(<MessageList items={items} />);
    await fireEvent(screen.getByTestId("message-list"), "contentSizeChange", 0, 100);
    expect(ScrollView.prototype.scrollToEnd).toHaveBeenCalledWith({ animated: false });
  });

  it("scrolls to the newest message when the list is resized by the keyboard", async () => {
    await render(<MessageList items={items} />);
    await fireEvent(screen.getByTestId("message-list"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 200 } },
    });
    expect(ScrollView.prototype.scrollToEnd).toHaveBeenCalledWith({ animated: false });
  });
});
