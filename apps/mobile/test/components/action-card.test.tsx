// apps/mobile/test/components/action-card.test.tsx
//
// Tests for ActionCard.
//
// Tested:
// - The Continue card of Home: role, surface style, icon box, meta and action label
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/action-card.test.tsx
//
// SEE: apps/mobile/src/components/action-card.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { ActionCard } from "@/components/action-card";
import { selectableStyle } from "@/components/selectable-style";
import { colors, radius, size, spacing } from "@/constants/theme";

function card(onPress = jest.fn()) {
  return (
    <ActionCard
      title="Weekend plans"
      meta="Job interviews · yesterday"
      icon="briefcase"
      action="Resume"
      onPress={onPress}
    />
  );
}

describe("ActionCard", () => {
  it("is a button named by its title and calls onPress", async () => {
    const onPress = jest.fn();
    await render(card(onPress));
    await fireEvent.press(screen.getByRole("button", { name: "Weekend plans" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("draws the icon in a tint box, the meta and the action label", async () => {
    await render(card());
    const icon = screen.getByTestId("icon-briefcase", { includeHiddenElements: true });
    expect(icon).toBeTruthy();
    expect(screen.getByText("Job interviews · yesterday")).toBeTruthy();
    expect(screen.getByText("Resume")).toBeTruthy();
    const box = StyleSheet.flatten(
      screen.getByTestId("action-card-icon-box", { includeHiddenElements: true }).props.style,
    );
    expect(box).toMatchObject({
      width: size.badge,
      height: size.badge,
      borderRadius: radius.badge,
      backgroundColor: colors.accentSoft,
    });
  });

  it("draws the surface card style", async () => {
    await render(card());
    const style = StyleSheet.flatten(
      screen.getByRole("button", { name: "Weekend plans" }).props.style,
    );
    expect(style).toMatchObject(selectableStyle({ selected: false }));
    expect(style).toMatchObject({
      paddingVertical: spacing.card,
      paddingHorizontal: spacing.md,
      gap: spacing.card,
    });
  });

  describe("as a selectable row", () => {
    function row(selected: boolean, onPress = jest.fn()) {
      return (
        <ActionCard
          title="From your mistakes"
          meta="Present perfect, articles and 2 more"
          icon="review"
          selected={selected}
          onPress={onPress}
        />
      );
    }

    it("is a radio named by its title, with its selected state", async () => {
      const onPress = jest.fn();
      await render(row(true, onPress));
      const radio = screen.getByRole("radio", { name: "From your mistakes" });
      expect(radio.props.accessibilityState).toMatchObject({ selected: true });
      await fireEvent.press(radio);
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("draws the check in the radio when selected and an empty ring otherwise", async () => {
      const { rerender } = await render(row(true));
      expect(screen.getByTestId("icon-check", { includeHiddenElements: true })).toBeTruthy();
      await rerender(row(false));
      expect(screen.queryByTestId("icon-check", { includeHiddenElements: true })).toBeNull();
      expect(screen.getByTestId("action-card-radio", { includeHiddenElements: true })).toBeTruthy();
    });

    it("draws no action label", async () => {
      await render(row(false));
      expect(screen.queryByText("Resume")).toBeNull();
    });

    it("draws the selected style", async () => {
      await render(row(true));
      const style = StyleSheet.flatten(
        screen.getByRole("radio", { name: "From your mistakes" }).props.style,
      );
      expect(style).toMatchObject({
        backgroundColor: colors.accentDeep,
        borderColor: colors.accentPressed,
      });
    });
  });
});
