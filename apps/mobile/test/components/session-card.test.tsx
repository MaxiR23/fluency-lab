// apps/mobile/test/components/session-card.test.tsx
//
// Tests for SessionCard.
//
// Tested:
// - The title, the time, the detail line and the icon
// - No time and no detail when they are null
// - The chevron only when asked
// - The title row alignment
// - Pressing the card
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/session-card.test.tsx
//
// SEE: apps/mobile/src/components/session-card.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { StyleSheet } from "react-native";

import { SessionCard } from "@/components/session-card";

const card = {
  title: "Weekend plans",
  time: "Nov 5",
  detail: "14 messages",
  icon: "chat",
} as const;

function titleRowAlign() {
  return StyleSheet.flatten(screen.getByText("Weekend plans").parent?.props.style).alignItems;
}

describe("SessionCard", () => {
  it("draws the title, the time, the detail and the icon", async () => {
    await render(<SessionCard {...card} onPress={jest.fn()} />);
    expect(screen.getByText("Weekend plans").props.numberOfLines).toBe(1);
    expect(screen.getByText("Nov 5")).toBeTruthy();
    expect(screen.getByText("14 messages").props.numberOfLines).toBe(1);
    expect(screen.getByTestId("icon-chat", { includeHiddenElements: true })).toBeTruthy();
  });

  it("draws no time and no detail when they are null", async () => {
    await render(<SessionCard {...card} time={null} detail={null} onPress={jest.fn()} />);
    expect(screen.getByText("Weekend plans")).toBeTruthy();
    expect(screen.queryByText("Nov 5")).toBeNull();
    expect(screen.queryByText("14 messages")).toBeNull();
  });

  it("draws the chevron only when asked", async () => {
    const { rerender } = await render(<SessionCard {...card} onPress={jest.fn()} />);
    expect(screen.queryByTestId("icon-chevron", { includeHiddenElements: true })).toBeNull();
    await rerender(<SessionCard {...card} chevron onPress={jest.fn()} />);
    expect(screen.getByTestId("icon-chevron", { includeHiddenElements: true })).toBeTruthy();
  });

  it("aligns the title row on the baseline by default and at the start when asked", async () => {
    const { rerender } = await render(<SessionCard {...card} onPress={jest.fn()} />);
    expect(titleRowAlign()).toBe("baseline");
    await rerender(<SessionCard {...card} titleAlign="start" onPress={jest.fn()} />);
    expect(titleRowAlign()).toBe("flex-start");
  });

  it("calls onPress", async () => {
    const onPress = jest.fn();
    await render(<SessionCard {...card} onPress={onPress} />);
    await fireEvent.press(screen.getByRole("button", { name: "Weekend plans" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
