// apps/mobile/test/components/stat-card.test.tsx
//
// Tests for StatCard.
//
// Tested:
// - The value and the label, in a bordered surface
// - The compact card: group padding, note radius, small value
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/stat-card.test.tsx
//
// SEE: apps/mobile/src/components/stat-card.tsx

import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { StatCard } from "@/components/stat-card";
import { textStyle } from "@/components/text-style";
import { borderWidth, colors, radius, spacing } from "@/constants/theme";

describe("StatCard", () => {
  it("draws the value and the label", async () => {
    await render(<StatCard value="12" label="Sessions" />);
    expect(StyleSheet.flatten(screen.getByText("12").props.style)).toMatchObject(textStyle("stat"));
    expect(StyleSheet.flatten(screen.getByText("Sessions").props.style)).toMatchObject(
      textStyle("why"),
    );
  });

  it("draws a zero value", async () => {
    await render(<StatCard value="0" label="Day streak" />);
    expect(screen.getByText("0")).toBeTruthy();
  });

  it("is a bordered surface with the large badge radius", async () => {
    await render(<StatCard value="3" label="Day streak" />);
    expect(StyleSheet.flatten(screen.getByTestId("stat-card").props.style)).toMatchObject({
      flex: 1,
      gap: spacing.xs,
      padding: spacing.card,
      borderRadius: radius.badgeLarge,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: borderWidth.thin,
    });
  });

  it("draws a compact card with group padding, the note radius and the small stat value", async () => {
    await render(<StatCard compact value="14" label="Messages" />);
    expect(StyleSheet.flatten(screen.getByTestId("stat-card").props.style)).toMatchObject({
      flex: 1,
      gap: spacing.xs,
      padding: spacing.group,
      borderRadius: radius.note,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: borderWidth.thin,
    });
    expect(StyleSheet.flatten(screen.getByText("14").props.style)).toMatchObject(
      textStyle("statSmall"),
    );
  });

  it("keeps the card padding, the large badge radius and the stat value when not compact", async () => {
    await render(<StatCard compact={false} value="14" label="Messages" />);
    expect(StyleSheet.flatten(screen.getByTestId("stat-card").props.style)).toMatchObject({
      padding: spacing.card,
      borderRadius: radius.badgeLarge,
    });
    expect(StyleSheet.flatten(screen.getByText("14").props.style)).toMatchObject(textStyle("stat"));
  });
});
