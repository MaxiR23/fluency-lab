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
// - An optional type tag before the detail, with the 4 point column gap
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
import { spacing } from "@/constants/theme";

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

  it("draws the time after the texts and none in the title row when placed at the end", async () => {
    await render(<SessionCard {...card} timePlacement="end" onPress={jest.fn()} />);
    expect(screen.getByText("Weekend plans").parent?.children).toHaveLength(1);
    const time = screen.getByText("Nov 5");
    expect(time).toBeTruthy();
    expect(time.parent).not.toBe(screen.getByText("Weekend plans").parent);
  });

  it("keeps the time in the title row by default", async () => {
    await render(<SessionCard {...card} onPress={jest.fn()} />);
    expect(screen.getByText("Weekend plans").parent?.children).toHaveLength(2);
  });

  it("draws the icon at the size it is given", async () => {
    await render(<SessionCard {...card} iconSize={18} onPress={jest.fn()} />);
    const icon = screen.getByTestId("icon-chat", { includeHiddenElements: true });
    expect(icon.props.width).toBe(18);
    expect(icon.props.height).toBe(18);
  });

  it("draws the tag before the detail with the 4 point column gap when a tag is given", async () => {
    await render(<SessionCard {...card} tag="Free chat" onPress={jest.fn()} />);
    const tag = screen.getByText("Free chat");
    const detail = screen.getByText("14 messages");
    expect(tag.parent?.parent).toBe(detail.parent);
    expect(StyleSheet.flatten(detail.parent?.props.style)).toMatchObject({
      flexDirection: "row",
      gap: spacing.sm,
    });
    expect(StyleSheet.flatten(detail.parent?.parent?.props.style)).toMatchObject({
      gap: spacing.xs,
    });
  });

  it("keeps the 3 point gap and no tag without one", async () => {
    await render(<SessionCard {...card} onPress={jest.fn()} />);
    expect(screen.queryByText("Free chat")).toBeNull();
    expect(StyleSheet.flatten(screen.getByText("14 messages").parent?.props.style)).toMatchObject({
      gap: spacing.hair,
    });
  });
});
