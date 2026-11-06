// apps/mobile/test/components/tag.test.tsx
//
// Tests for Tag.
//
// Tested:
// - The read-only tag
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/tag.test.tsx
//
// SEE: apps/mobile/src/components/tag.tsx

import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { Tag } from "@/components/tag";
import { textStyle } from "@/components/text-style";
import { borderWidth, colors, radius, spacing } from "@/constants/theme";

describe("Tag", () => {
  it("draws its label in the tag style", async () => {
    await render(<Tag label="Travel" />);
    const label = screen.getByText("Travel");
    expect(StyleSheet.flatten(label.props.style)).toMatchObject(textStyle("captionLink"));
    const box = StyleSheet.flatten(label.parent?.props.style);
    expect(box).toMatchObject({
      borderColor: colors.accentLine,
      borderWidth: borderWidth.thin,
      borderRadius: radius.badge,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    });
  });
});
