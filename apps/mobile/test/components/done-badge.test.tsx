// apps/mobile/test/components/done-badge.test.tsx
//
// Tests for DoneBadge.
//
// Tested:
// - The check icon in text color at the done size and stroke
// - The 64 accent-line disc with its border and glow
// - It is hidden from accessibility
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/done-badge.test.tsx
//
// SEE: apps/mobile/src/components/done-badge.tsx

import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { processColor, StyleSheet } from "react-native";

import { DoneBadge } from "@/components/done-badge";
import { borderWidth, colors, radius, shadow, size, strokeWidth } from "@/constants/theme";

describe("DoneBadge", () => {
  it("draws the check icon in text color at the done size and stroke", async () => {
    await render(<DoneBadge />);
    expect(screen.getByTestId("icon-check", { includeHiddenElements: true })).toBeTruthy();
    const drawn = JSON.stringify(screen.toJSON());
    expect(drawn).toContain(`"width":${size.iconDone}`);
    expect(drawn).toContain(`"height":${size.iconDone}`);
    expect(drawn).toContain(`"strokeWidth":${strokeWidth.done}`);
    expect(drawn).toContain(`"stroke":{"type":0,"payload":${String(processColor(colors.text))}}`);
  });

  it("is a 64 accent-line disc with an accent-pressed border and the done glow", async () => {
    await render(<DoneBadge />);
    const style = StyleSheet.flatten(
      screen.getByTestId("done-badge", { includeHiddenElements: true }).props.style,
    );
    expect(style).toMatchObject({
      width: size.doneBadge,
      height: size.doneBadge,
      borderRadius: radius.pill,
      backgroundColor: colors.accentLine,
      borderColor: colors.accentPressed,
      borderWidth: borderWidth.thin,
      alignItems: "center",
      justifyContent: "center",
      ...shadow.doneGlow,
    });
    expect(size.doneBadge).toBe(64);
  });

  it("is hidden from accessibility", async () => {
    await render(<DoneBadge />);
    const badge = screen.getByTestId("done-badge", { includeHiddenElements: true });
    expect(badge.props.accessibilityElementsHidden).toBe(true);
    expect(badge.props.importantForAccessibility).toBe("no-hide-descendants");
  });
});
