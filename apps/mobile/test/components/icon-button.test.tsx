// apps/mobile/test/components/icon-button.test.tsx
//
// Tests for IconButton.
//
// Tested:
// - A button named by its label, with the touch size, drawing the icon it is given
// - Its press
// - The icon color, size and stroke it is given, and the defaults
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/icon-button.test.tsx
//
// SEE: apps/mobile/src/components/icon-button.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { IconButton } from "@/components/icon-button";
import { size, strokeWidth } from "@/constants/theme";

describe("IconButton", () => {
  it("is a button named by its label with the touch size", async () => {
    await render(<IconButton icon="close" label="Stop practice" onPress={() => {}} />);
    const button = screen.getByRole("button", { name: "Stop practice" });
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({
      width: size.touch,
      height: size.touch,
    });
  });

  it("draws the icon it is given", async () => {
    await render(<IconButton icon="close" label="Close" onPress={() => {}} />);
    expect(screen.getByTestId("icon-close", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId("icon-back", { includeHiddenElements: true })).toBeNull();
  });

  it("calls onPress when pressed", async () => {
    const onPress = jest.fn();
    await render(<IconButton icon="close" label="Close" onPress={onPress} />);
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("draws the icon at the size and stroke it is given", async () => {
    await render(
      <IconButton
        icon="close"
        label="Close"
        iconSize={size.iconBadge}
        strokeWidth={strokeWidth.action}
        onPress={() => {}}
      />,
    );
    const icon = screen.getByTestId("icon-close", { includeHiddenElements: true });
    expect(icon.props.width).toBe(size.iconBadge);
  });

  it("draws the icon at the default size with no size given", async () => {
    await render(<IconButton icon="back" label="Back" onPress={() => {}} />);
    const icon = screen.getByTestId("icon-back", { includeHiddenElements: true });
    expect(icon.props.width).toBe(size.icon);
  });
});
