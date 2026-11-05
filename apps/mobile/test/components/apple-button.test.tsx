// apps/mobile/test/components/apple-button.test.tsx
//
// Tests for the Apple sign in button.
//
// Tested:
// - The official button, its type and style
// - Its size and corner radius come from the tokens
// - Pressing it, and pressing it while disabled
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/apple-button.test.tsx
//
// SEE: apps/mobile/src/components/apple-button.tsx

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { AppleButton } from "@/components/apple-button";
import { radius, size } from "@/constants/theme";

const mockButton = jest.fn((_props: Record<string, unknown>) => null);

jest.mock("expo-apple-authentication", () => ({
  AppleAuthenticationButton: (props: Record<string, unknown>) => mockButton(props),
  AppleAuthenticationButtonType: { CONTINUE: "continue-type" },
  AppleAuthenticationButtonStyle: { WHITE: "white-style" },
}));

function lastProps(): Record<string, unknown> {
  const call = mockButton.mock.calls.at(-1);
  if (call === undefined) throw new Error("the button was not drawn");
  return call[0];
}

describe("AppleButton", () => {
  beforeEach(() => {
    mockButton.mockClear();
  });

  it("draws the official Continue button in the white style", async () => {
    await render(<AppleButton onPress={() => undefined} />);
    expect(lastProps().buttonType).toBe("continue-type");
    expect(lastProps().buttonStyle).toBe("white-style");
  });

  it("takes its corner radius and height from the tokens, and sets no background or border radius", async () => {
    await render(<AppleButton onPress={() => undefined} />);
    const style = StyleSheet.flatten(lastProps().style as object);
    expect(lastProps().cornerRadius).toBe(radius.control);
    expect(style).toEqual({ alignSelf: "stretch", height: size.control });
  });

  it("calls onPress when pressed", async () => {
    const onPress = jest.fn();
    await render(<AppleButton onPress={onPress} />);
    (lastProps().onPress as () => void)();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress while disabled", async () => {
    const onPress = jest.fn();
    await render(<AppleButton onPress={onPress} disabled />);
    (lastProps().onPress as () => void)();
    expect(onPress).not.toHaveBeenCalled();
  });
});
