// apps/mobile/test/components/avatar.test.tsx
//
// Tests for Avatar.
//
// Tested:
// - The initial or the person icon on a round surface
//
// What is covered:
// - Normal case, empty case
//
// Run with: pnpm exec jest apps/mobile/test/components/avatar.test.tsx
//
// SEE: apps/mobile/src/components/avatar.tsx

import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { Avatar } from "@/components/avatar";
import { textStyle } from "@/components/text-style";
import { borderWidth, colors, radius, size } from "@/constants/theme";

describe("Avatar", () => {
  it("draws the initial", async () => {
    await render(<Avatar initial="M" />);
    const initial = screen.getByText("M", { includeHiddenElements: true });
    expect(StyleSheet.flatten(initial.props.style)).toMatchObject(textStyle("avatar"));
    expect(screen.queryByTestId("icon-person", { includeHiddenElements: true })).toBeNull();
  });

  it("draws the person icon without an initial", async () => {
    await render(<Avatar initial={null} />);
    expect(screen.getByTestId("icon-person", { includeHiddenElements: true })).toBeTruthy();
  });

  it("is a 44 round surface with a border", async () => {
    await render(<Avatar initial="M" />);
    const box = StyleSheet.flatten(
      screen.getByTestId("avatar", { includeHiddenElements: true }).props.style,
    );
    expect(box).toMatchObject({
      width: size.avatar,
      height: size.avatar,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: borderWidth.thin,
    });
  });

  it("is hidden from accessibility", async () => {
    await render(<Avatar initial="M" />);
    expect(screen.queryByTestId("avatar")).toBeNull();
    expect(screen.getByTestId("avatar", { includeHiddenElements: true })).toBeTruthy();
  });
});
