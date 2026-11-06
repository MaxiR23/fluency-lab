// apps/mobile/test/components/option-card.test.tsx
//
// Tests for OptionCard.
//
// Tested:
// - The label, the description, the role, the state and the selected look
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/option-card.test.tsx
//
// SEE: apps/mobile/src/components/option-card.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { OptionCard } from "@/components/option-card";
import { colors } from "@/constants/theme";

describe("OptionCard", () => {
  it("draws the label and the description", async () => {
    await render(
      <OptionCard
        role="radio"
        label="Beginner"
        description="Short sentences."
        selected={false}
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByText("Beginner")).toBeTruthy();
    expect(screen.getByText("Short sentences.")).toBeTruthy();
  });

  it("draws no description when none is given", async () => {
    await render(<OptionCard role="checkbox" label="Work" selected={false} onPress={jest.fn()} />);
    expect(screen.getByText("Work")).toBeTruthy();
    expect(screen.queryByText("Short sentences.")).toBeNull();
  });

  it("marks a selected radio as selected and shows the check", async () => {
    await render(<OptionCard role="radio" label="Beginner" selected onPress={jest.fn()} />);
    const card = screen.getByRole("radio", { name: "Beginner" });
    expect(card.props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId("check-icon", { includeHiddenElements: true })).toBeTruthy();
  });

  it("marks an unselected checkbox as unchecked and hides the check", async () => {
    await render(<OptionCard role="checkbox" label="Work" selected={false} onPress={jest.fn()} />);
    const card = screen.getByRole("checkbox", { name: "Work" });
    expect(card.props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.queryByTestId("check-icon", { includeHiddenElements: true })).toBeNull();
  });

  it("calls onPress when pressed", async () => {
    const onPress = jest.fn();
    await render(<OptionCard role="checkbox" label="Work" selected={false} onPress={onPress} />);
    await fireEvent.press(screen.getByRole("checkbox", { name: "Work" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("draws the selected look on accent-deep with the accent-line border", async () => {
    await render(<OptionCard role="radio" label="Beginner" selected onPress={jest.fn()} />);
    const style = StyleSheet.flatten(screen.getByRole("radio", { name: "Beginner" }).props.style);
    expect(style).toMatchObject({
      backgroundColor: colors.accentDeep,
      borderColor: colors.accentLine,
    });
  });
});
