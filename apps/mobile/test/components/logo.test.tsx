// apps/mobile/test/components/logo.test.tsx
//
// Tests for the shared Logo component.
//
// Tested:
// - The name, the badge and the chat bubble icon
//
// What is covered:
// - Normal case
//
// Run with: pnpm exec jest apps/mobile/test/components/logo.test.tsx
//
// SEE: apps/mobile/src/components/logo.tsx

import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { processColor, StyleSheet } from "react-native";

import { Logo } from "@/components/logo";
import { borderWidth, colors, radius, size, strokeWidth } from "@/constants/theme";

describe("Logo", () => {
  it("draws the name", async () => {
    await render(<Logo />);
    expect(screen.getByText("Fluency Lab")).toBeTruthy();
  });

  it("draws the badge with the design's size, radius and colors", async () => {
    await render(<Logo />);
    const badge = screen.getByTestId("logo-badge");
    expect(StyleSheet.flatten(badge.props.style)).toMatchObject({
      width: size.badge,
      height: size.badge,
      borderRadius: radius.badge,
      backgroundColor: colors.accentDeep,
      borderColor: colors.accentLine,
      borderWidth: borderWidth.thin,
    });
  });

  it("draws the icon path with the accent stroke", async () => {
    await render(<Logo />);
    const path = screen.getByTestId("logo-icon-path", { includeHiddenElements: true });
    expect(path.props.d).toBe("M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12z");
    // INFO: react-native-svg hands the color to native already processed.
    expect(path.props.stroke.payload).toBe(processColor(colors.accent));
    expect(path.props.strokeWidth).toBe(strokeWidth.icon);
  });
});
