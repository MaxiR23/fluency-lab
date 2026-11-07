// apps/mobile/test/components/answer-option.test.tsx
//
// Tests for AnswerOption.
//
// Tested:
// - It is a button with its label and calls onPress
// - It cannot be pressed after the answer or while disabled
// - It draws the check only when right and the X only when wrong
// - The badge icon is the check size (14) and the badge is at its final scale with no motion
//
// What is covered:
// - Normal case, reduce motion, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/answer-option.test.tsx
//
// SEE: apps/mobile/src/components/answer-option.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet, processColor } from "react-native";

import { AnswerOption } from "@/components/answer-option";
import { colors, size } from "@/constants/theme";
import { exerciseMotion } from "@/utils/practice-motion";

describe("AnswerOption", () => {
  it("is a button with its label", async () => {
    const onPress = jest.fn();
    await render(<AnswerOption label="is going to" state="idle" onPress={onPress} motion={null} />);
    await fireEvent.press(screen.getByRole("button", { name: "is going to" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("is disabled after the answer", async () => {
    const onPress = jest.fn();
    await render(
      <AnswerOption label="will" state="idle" disabled onPress={onPress} motion={null} />,
    );
    const button = screen.getByRole("button", { name: "will" });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("draws the check only when right", async () => {
    const { rerender } = await render(
      <AnswerOption label="a" state="idle" onPress={jest.fn()} motion={null} />,
    );
    expect(screen.queryByTestId("icon-check", { includeHiddenElements: true })).toBeNull();
    await rerender(<AnswerOption label="a" state="right" onPress={jest.fn()} motion={null} />);
    expect(screen.getByTestId("icon-check", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId("icon-close", { includeHiddenElements: true })).toBeNull();
  });

  it("draws the X only when wrong", async () => {
    await render(<AnswerOption label="a" state="wrong" onPress={jest.fn()} motion={null} />);
    expect(screen.getByTestId("icon-close", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId("icon-check", { includeHiddenElements: true })).toBeNull();
  });

  it("draws the verdict colors at once with no motion", async () => {
    await render(<AnswerOption label="a" state="right" onPress={jest.fn()} motion={null} />);
    const style = StyleSheet.flatten(screen.getByRole("button", { name: "a" }).props.style);
    expect(style).toMatchObject({
      backgroundColor: colors.accentDeep,
      borderColor: colors.accent,
    });
  });

  it("draws the badge icon at the check size", async () => {
    await render(<AnswerOption label="a" state="right" onPress={jest.fn()} motion={null} />);
    const icon = screen.getByTestId("icon-check", { includeHiddenElements: true });
    expect(icon.props.width).toBe(size.iconCheck);
    expect(icon.props.height).toBe(size.iconCheck);
  });

  it("starts the badge at its final scale with no motion", async () => {
    await render(<AnswerOption label="a" state="right" onPress={jest.fn()} motion={null} />);
    const badge = StyleSheet.flatten(screen.getByTestId("answer-badge").props.style);
    expect(badge.transform).toEqual([{ scale: 1 }]);
  });

  it("starts the badge at 0 and the option idle when it moves", async () => {
    await render(
      <AnswerOption label="a" state="right" onPress={jest.fn()} motion={exerciseMotion(false)} />,
    );
    const badge = StyleSheet.flatten(screen.getByTestId("answer-badge").props.style);
    expect(badge.transform).toEqual([{ scale: 0 }]);
    const style = StyleSheet.flatten(screen.getByRole("button", { name: "a" }).props.style);
    expect(processColor(style.backgroundColor)).toBe(processColor(colors.surface));
  });
});
