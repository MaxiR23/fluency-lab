// apps/mobile/test/components/spend-card.test.tsx
//
// Tests for SpendCard.
//
// Tested:
// - The spend, the limit line, the bar and the reset line
// - No bar without a limit, the bar minimum at zero spend
// - Edit limit opens the edit
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/spend-card.test.tsx
//
// SEE: apps/mobile/src/components/spend-card.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { SpendCard } from "@/components/spend-card";
import { textStyle } from "@/components/text-style";
import { borderWidth, colors, radius, size } from "@/constants/theme";

const reset = "Counted by Fluency Lab · resets on Dec 1";

function card(overrides: Partial<React.ComponentProps<typeof SpendCard>> = {}) {
  return (
    <SpendCard
      spent="$0.42"
      limitLine="of $10.00"
      fraction={0.042}
      resetLine={reset}
      onEditLimit={jest.fn()}
      {...overrides}
    />
  );
}

describe("SpendCard", () => {
  it("draws the spend, the limit line, the bar and the reset line", async () => {
    await render(card());
    expect(screen.getByText("Spent this month")).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByText("$0.42").props.style)).toMatchObject(
      textStyle("title"),
    );
    expect(screen.getByText("of $10.00")).toBeTruthy();
    expect(screen.getByText(reset)).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId("spend-fill").props.style)).toMatchObject({
      width: "4.2%",
      minWidth: size.spendBarMin,
      height: size.spendBar,
      backgroundColor: colors.accent,
    });
    expect(StyleSheet.flatten(screen.getByTestId("spend-bar").props.style)).toMatchObject({
      height: size.spendBar,
      backgroundColor: colors.progressTrack,
      borderRadius: radius.pill,
    });
  });

  it("is an accentDeep card with an accentLine border", async () => {
    await render(card());
    expect(StyleSheet.flatten(screen.getByTestId("spend-card").props.style)).toMatchObject({
      backgroundColor: colors.accentDeep,
      borderColor: colors.accentLine,
      borderWidth: borderWidth.thin,
      borderRadius: radius.control,
    });
  });

  it("draws no bar without a limit", async () => {
    await render(card({ limitLine: "No limit set", fraction: null }));
    expect(screen.getByText("No limit set")).toBeTruthy();
    expect(screen.queryByTestId("spend-bar")).toBeNull();
  });

  it("keeps the bar's 8 minimum at zero spend and fills it at the limit", async () => {
    const { rerender } = await render(card({ fraction: 0 }));
    const empty = StyleSheet.flatten(screen.getByTestId("spend-fill").props.style);
    expect(empty).toMatchObject({ width: "0%", minWidth: 8 });
    await rerender(card({ fraction: 1 }));
    expect(StyleSheet.flatten(screen.getByTestId("spend-fill").props.style).width).toBe("100%");
  });

  it("opens Edit limit", async () => {
    const onEditLimit = jest.fn();
    await render(card({ onEditLimit }));
    await fireEvent.press(screen.getByRole("link", { name: "Edit limit" }));
    expect(onEditLimit).toHaveBeenCalledTimes(1);
  });
});
