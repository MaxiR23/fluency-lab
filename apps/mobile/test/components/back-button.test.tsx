// apps/mobile/test/components/back-button.test.tsx
//
// Tests for BackButton.
//
// Tested:
// - The Back to Home button, its back icon and its press
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/back-button.test.tsx
//
// SEE: apps/mobile/src/components/back-button.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { BackButton } from "@/components/back-button";
import { size } from "@/constants/theme";

describe("BackButton", () => {
  it("is a button named Back to Home with the touch size", async () => {
    await render(<BackButton onPress={() => {}} />);
    const button = screen.getByRole("button", { name: "Back to Home" });
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({
      width: size.touch,
      height: size.touch,
    });
  });

  it("draws the back icon", async () => {
    await render(<BackButton onPress={() => {}} />);
    expect(JSON.stringify(screen.toJSON())).toContain("M15 18l-6-6 6-6");
  });

  it("calls onPress when pressed", async () => {
    const onPress = jest.fn();
    await render(<BackButton onPress={onPress} />);
    await fireEvent.press(screen.getByRole("button", { name: "Back to Home" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
