// apps/mobile/test/components/hero-card.test.tsx
//
// Tests for HeroCard.
//
// Tested:
// - The Free chat card: button, texts, Start chatting pill and raised shadow
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/hero-card.test.tsx
//
// SEE: apps/mobile/src/components/hero-card.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { HeroCard } from "@/components/hero-card";
import { colors, radius, shadow, spacing } from "@/constants/theme";

describe("HeroCard", () => {
  it("is a button named Free chat and calls onPress", async () => {
    const onPress = jest.fn();
    await render(<HeroCard onPress={onPress} />);
    await fireEvent.press(screen.getByRole("button", { name: "Free chat" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("draws the description and the Start chatting pill with its arrow", async () => {
    await render(<HeroCard onPress={jest.fn()} />);
    expect(screen.getByText("Talk about anything. Get corrections as you go.")).toBeTruthy();
    expect(screen.getByText("Start chatting")).toBeTruthy();
    expect(screen.getByTestId("icon-arrow", { includeHiddenElements: true })).toBeTruthy();
  });

  it("draws the raised shadow on the deep card", async () => {
    await render(<HeroCard onPress={jest.fn()} />);
    const style = StyleSheet.flatten(screen.getByRole("button", { name: "Free chat" }).props.style);
    expect(style).toMatchObject(shadow.raised);
    expect(style).toMatchObject({
      backgroundColor: colors.accentDeep,
      borderColor: colors.accentLine,
      borderRadius: radius.hero,
      padding: spacing.hero,
      marginHorizontal: spacing.screenSide,
    });
  });
});
