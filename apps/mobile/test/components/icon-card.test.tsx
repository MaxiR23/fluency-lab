// apps/mobile/test/components/icon-card.test.tsx
//
// Tests for IconCard.
//
// Tested:
// - The icon box, the title, the text and the optional node at the top right
// - It is one button named by a label and calls onPress
// - The text variant can change, as the Home tiles use a smaller one
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/icon-card.test.tsx
//
// SEE: apps/mobile/src/components/icon-card.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet, Text as RNText } from "react-native";

import { IconCard } from "@/components/icon-card";
import { textStyle } from "@/components/text-style";

describe("IconCard", () => {
  it("draws the icon, the title and the text", async () => {
    await render(
      <IconCard
        icon="chat"
        title="Free chat"
        text="Talk about anything"
        accessibilityLabel="Free chat"
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByTestId("icon-chat", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText("Free chat")).toBeTruthy();
    expect(screen.getByText("Talk about anything")).toBeTruthy();
  });

  it("is one button that calls onPress", async () => {
    const onPress = jest.fn();
    await render(
      <IconCard
        icon="chat"
        title="Free chat"
        text="t"
        accessibilityLabel="Open"
        onPress={onPress}
      />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Open" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("draws the top right node when given and none otherwise", async () => {
    const { rerender } = await render(
      <IconCard icon="chat" title="T" text="t" accessibilityLabel="x" onPress={jest.fn()} />,
    );
    expect(screen.queryByText("TAG")).toBeNull();
    await rerender(
      <IconCard
        icon="chat"
        title="T"
        text="t"
        accessibilityLabel="x"
        topRight={<RNText>TAG</RNText>}
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByText("TAG")).toBeTruthy();
  });

  it("draws the text in the given variant", async () => {
    await render(
      <IconCard
        icon="chat"
        title="T"
        text="Smaller"
        textVariant="tileText"
        accessibilityLabel="x"
        onPress={jest.fn()}
      />,
    );
    expect(StyleSheet.flatten(screen.getByText("Smaller").props.style)).toMatchObject(
      textStyle("tileText"),
    );
  });

  it("draws the text in the why variant by default", async () => {
    await render(
      <IconCard icon="chat" title="T" text="Why" accessibilityLabel="x" onPress={jest.fn()} />,
    );
    expect(StyleSheet.flatten(screen.getByText("Why").props.style)).toMatchObject(textStyle("why"));
  });
});
