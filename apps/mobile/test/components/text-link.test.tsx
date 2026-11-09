// apps/mobile/test/components/text-link.test.tsx
//
// Tests for the shared TextLink component.
//
// Tested:
// - It draws a pressable link in the text of its variant
// - It reports presses only when enabled
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/text-link.test.tsx
//
// SEE: apps/mobile/src/components/text-link.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { TextLink } from "@/components/text-link";
import { textStyle } from "@/components/text-style";

describe("TextLink", () => {
  it("calls onPress when pressed", async () => {
    const onPress = jest.fn();
    await render(<TextLink label="Forgot password?" onPress={onPress} />);
    await fireEvent.press(screen.getByText("Forgot password?"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress when disabled", async () => {
    const onPress = jest.fn();
    await render(<TextLink label="Forgot password?" disabled onPress={onPress} />);
    // INFO: fireEvent also walks up to the component's own onPress prop, so the
    // check is on the text that reaches the screen: it must hold no handler.
    expect(screen.getByText("Forgot password?").props.onPress).toBeUndefined();
    expect(screen.getByText("Forgot password?").props.disabled).toBe(true);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("reports itself as a link", async () => {
    await render(<TextLink label="Forgot password?" />);
    expect(screen.getByRole("link", { name: "Forgot password?" })).toBeTruthy();
  });

  it("draws the caption link by default", async () => {
    await render(<TextLink label="Go" />);
    expect(StyleSheet.flatten(screen.getByText("Go").props.style)).toEqual(
      textStyle("captionLink"),
    );
  });

  it("draws the footer variant when asked", async () => {
    await render(<TextLink label="Go" variant="footerLink" />);
    expect(StyleSheet.flatten(screen.getByText("Go").props.style)).toEqual(textStyle("footerLink"));
  });

  it("draws the strong caption variant when asked", async () => {
    await render(<TextLink label="Go" variant="captionLinkStrong" />);
    expect(StyleSheet.flatten(screen.getByText("Go").props.style)).toEqual(
      textStyle("captionLinkStrong"),
    );
  });

  it("draws the muted action variant as a link", async () => {
    await render(<TextLink label="Sign out" variant="actionMuted" />);
    expect(screen.getByRole("link", { name: "Sign out" })).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByText("Sign out").props.style)).toEqual(
      textStyle("actionMuted"),
    );
  });
});
