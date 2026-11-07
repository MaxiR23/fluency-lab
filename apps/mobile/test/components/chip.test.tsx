// apps/mobile/test/components/chip.test.tsx
//
// Tests for Chip.
//
// Tested:
// - The label, the checkbox role, the check and the press
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/chip.test.tsx
//
// SEE: apps/mobile/src/components/chip.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { Chip } from "@/components/chip";
import { colors, size } from "@/constants/theme";

describe("Chip", () => {
  it("draws the label as a checkbox", async () => {
    await render(<Chip label="Food" selected={false} onPress={jest.fn()} />);
    expect(screen.getByRole("checkbox", { name: "Food" })).toBeTruthy();
    expect(screen.getByText("Food")).toBeTruthy();
  });

  it("shows the check and the selected look only when selected", async () => {
    const { rerender } = await render(<Chip label="Food" selected={false} onPress={jest.fn()} />);
    expect(screen.queryByTestId("check-icon", { includeHiddenElements: true })).toBeNull();
    let chip = screen.getByRole("checkbox", { name: "Food" });
    expect(chip.props.accessibilityState).toMatchObject({ checked: false });
    expect(StyleSheet.flatten(chip.props.style).backgroundColor).toBe(colors.surface);

    await rerender(<Chip label="Food" selected onPress={jest.fn()} />);
    chip = screen.getByRole("checkbox", { name: "Food" });
    expect(chip.props.accessibilityState).toMatchObject({ checked: true });
    expect(StyleSheet.flatten(chip.props.style).backgroundColor).toBe(colors.accentDeep);
    expect(screen.getByTestId("check-icon", { includeHiddenElements: true })).toBeTruthy();
  });

  it("calls onPress when pressed", async () => {
    const onPress = jest.fn();
    await render(<Chip label="Food" selected={false} onPress={onPress} />);
    await fireEvent.press(screen.getByRole("checkbox", { name: "Food" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("is a radio in the topic look when asked, with the pill height", async () => {
    const onPress = jest.fn();
    await render(<Chip label="Articles" selected look="topic" role="radio" onPress={onPress} />);
    const radio = screen.getByRole("radio", { name: "Articles" });
    expect(radio.props.accessibilityState).toMatchObject({ checked: true });
    expect(StyleSheet.flatten(radio.props.style)).toMatchObject({
      minHeight: size.pill,
      backgroundColor: colors.accentDeep,
      borderColor: colors.accentPressed,
    });
    await fireEvent.press(radio);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("draws no check in the topic look", async () => {
    await render(<Chip label="Articles" selected look="topic" onPress={jest.fn()} />);
    expect(screen.queryByTestId("icon-check", { includeHiddenElements: true })).toBeNull();
  });
});
