// apps/mobile/test/components/button.test.tsx
//
// Tests for the shared Button component.
//
// Tested:
// - It draws the style of its variant and state
// - It reports presses only when enabled
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/button.test.tsx
//
// SEE: apps/mobile/src/components/button.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { Button } from "@/components/button";
import { buttonStyle } from "@/components/button-style";
import { colors } from "@/constants/theme";

describe("Button", () => {
  it("draws the primary background by default", async () => {
    await render(<Button label="Go" />);
    const style = StyleSheet.flatten(screen.getByRole("button").props.style);
    expect(style.backgroundColor).toBe(colors.accent);
  });

  it("draws the secondary background when asked", async () => {
    await render(<Button label="Go" variant="secondary" />);
    const style = StyleSheet.flatten(screen.getByRole("button").props.style);
    expect(style.backgroundColor).toBe(colors.surface);
  });

  it("draws the pressed colors while pressed", async () => {
    await render(<Button label="Go" testOnly_pressed />);
    const style = StyleSheet.flatten(screen.getByRole("button").props.style);
    expect(style.backgroundColor).toBe(colors.accentPressed);
    const label = StyleSheet.flatten(screen.getByText("Go").props.style);
    expect(label.color).toBe(buttonStyle("primary", { pressed: true }).label.color);
  });

  it("draws the disabled colors and reports itself disabled", async () => {
    await render(<Button label="Go" disabled />);
    const button = screen.getByRole("button", { disabled: true });
    expect(StyleSheet.flatten(button.props.style).backgroundColor).toBe(colors.surface);
    const label = StyleSheet.flatten(screen.getByText("Go").props.style);
    expect(label.color).toBe(colors.textMuted);
  });

  it("calls onPress when pressed", async () => {
    const onPress = jest.fn();
    await render(<Button label="Go" onPress={onPress} />);
    await fireEvent.press(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress when disabled", async () => {
    const onPress = jest.fn();
    await render(<Button label="Go" disabled onPress={onPress} />);
    await fireEvent.press(screen.getByRole("button", { disabled: true }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("draws the deep background when asked", async () => {
    await render(<Button label="Go" variant="deep" />);
    const style = StyleSheet.flatten(screen.getByRole("button").props.style);
    expect(style.backgroundColor).toBe(colors.accentDeep);
    expect(style.borderColor).toBe(colors.accentLine);
  });

  it("shows a spinner in place of the label while loading", async () => {
    await render(<Button label="Go" loading />);
    expect(screen.queryByText("Go")).toBeNull();
    const root = screen.toJSON();
    if (root === null || Array.isArray(root)) {
      throw new Error("expected a single root");
    }
    const child = root.children?.[0];
    if (child === undefined || typeof child === "string") {
      throw new Error("expected a spinner element");
    }
    expect(child.type).toBe("ActivityIndicator");
    expect(child.props.color).toBe(buttonStyle("primary").label.color);
  });

  it("keeps its name while loading", async () => {
    await render(<Button label="Go" loading />);
    expect(screen.getByRole("button", { name: "Go" })).toBeTruthy();
  });

  it("reports itself busy and disabled while loading", async () => {
    await render(<Button label="Go" loading />);
    expect(screen.getByRole("button", { name: "Go", busy: true, disabled: true })).toBeTruthy();
  });

  it("does not call onPress while loading", async () => {
    const onPress = jest.fn();
    await render(<Button label="Go" loading onPress={onPress} />);
    await fireEvent.press(screen.getByRole("button", { name: "Go" }));
    expect(onPress).not.toHaveBeenCalled();
  });
});
