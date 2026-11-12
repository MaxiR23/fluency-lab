// apps/mobile/test/components/tag.test.tsx
//
// Tests for Tag.
//
// Tested:
// - The read-only tag pill
// - A long rule tag stays on one line, shrinks and ends in an ellipsis
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
import { tagStyle } from "@/components/tag-style";
import { textStyle } from "@/components/text-style";
import { colors, radius, spacing } from "@/constants/theme";

describe("Tag", () => {
  it("ends a long rule tag in an ellipsis on one line and lets it shrink", async () => {
    const long = "Present simple for future timetabled events and schedules";
    await render(<Tag label={long} variant="rule" />);
    const label = screen.getByText(long);
    expect(label.props.numberOfLines).toBe(1);
    expect(label.props.ellipsizeMode).toBe("tail");
    expect(StyleSheet.flatten(label.parent?.props.style)).toMatchObject({ flexShrink: 1 });
  });

  it("sets no line limit on the other tags", async () => {
    await render(<Tag label="Travel" />);
    expect(screen.getByText("Travel").props.numberOfLines).toBeUndefined();
  });

  it("draws its label in the tag style on a tint pill", async () => {
    await render(<Tag label="Travel" />);
    const label = screen.getByText("Travel");
    expect(StyleSheet.flatten(label.props.style)).toMatchObject(textStyle("tag"));
    const box = StyleSheet.flatten(label.parent?.props.style);
    expect(box).toMatchObject({
      backgroundColor: colors.accentTag,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.hair,
    });
  });

  it("draws the outline variant", async () => {
    await render(<Tag label="New word" variant="outline" />);
    const label = screen.getByText("New word");
    expect(StyleSheet.flatten(label.props.style)).toMatchObject(textStyle("tagOutline"));
    expect(StyleSheet.flatten(label.parent?.props.style)).toMatchObject(tagStyle("outline").box);
  });
});
