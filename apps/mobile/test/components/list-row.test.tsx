// apps/mobile/test/components/list-row.test.tsx
//
// Tests for ListRow.
//
// Tested:
// - A pressable row is a button with its label, a plain row is not
// - The value, the chevron and the trailing node
// - The danger title, the last row (no bottom border) and the busy state
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/list-row.test.tsx
//
// SEE: apps/mobile/src/components/list-row.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet, Text as RNText } from "react-native";

import { ListRow } from "@/components/list-row";
import { textStyle } from "@/components/text-style";
import { borderWidth, colors, size } from "@/constants/theme";

describe("ListRow", () => {
  it("is a button with its label when pressable", async () => {
    const onPress = jest.fn();
    await render(<ListRow title="Provider" onPress={onPress} />);
    await fireEvent.press(screen.getByRole("button", { name: "Provider" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("draws the value and the chevron", async () => {
    await render(<ListRow title="Provider" value="Claude" chevron onPress={jest.fn()} />);
    expect(screen.getByText("Claude")).toBeTruthy();
    expect(screen.getByTestId("icon-chevron", { includeHiddenElements: true })).toBeTruthy();
  });

  it("is not pressable without onPress", async () => {
    await render(<ListRow title="Version" value="0.1.0" />);
    expect(screen.queryByRole("button", { name: "Version" })).toBeNull();
    expect(screen.getByText("Version")).toBeTruthy();
    expect(screen.getByText("0.1.0")).toBeTruthy();
  });

  it("draws a trailing node", async () => {
    await render(<ListRow title="Haptics" trailing={<RNText>switch</RNText>} />);
    expect(screen.getByText("switch")).toBeTruthy();
  });

  it("draws the danger title in the error color", async () => {
    await render(<ListRow title="Delete account" tone="danger" onPress={jest.fn()} />);
    expect(StyleSheet.flatten(screen.getByText("Delete account").props.style)).toMatchObject(
      textStyle("bodyDanger"),
    );
    await render(<ListRow title="Sign out" onPress={jest.fn()} />);
    expect(StyleSheet.flatten(screen.getByText("Sign out").props.style).color).toBe(colors.text);
  });

  it("draws the row at least 50 high with a bottom border unless last", async () => {
    await render(<ListRow title="First" />);
    const first = StyleSheet.flatten(screen.getByTestId("list-row").props.style);
    expect(first).toMatchObject({
      minHeight: size.listRow,
      borderBottomWidth: borderWidth.thin,
      borderBottomColor: colors.border,
    });
    await render(<ListRow title="Last" last />);
    const last = StyleSheet.flatten(screen.getAllByTestId("list-row").at(-1)?.props.style);
    expect(last.borderBottomWidth).toBeUndefined();
  });

  it("is disabled and busy while busy", async () => {
    const onPress = jest.fn();
    await render(<ListRow title="Sign out" busy onPress={onPress} />);
    const row = screen.getByRole("button", { name: "Sign out", busy: true, disabled: true });
    await fireEvent.press(row);
    expect(onPress).not.toHaveBeenCalled();
  });
});
