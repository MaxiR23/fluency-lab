// apps/mobile/test/components/auth-screen.test.tsx
//
// Tests for the shared AuthScreen layout.
//
// Tested:
// - Logo, title block, children and the footer link
// - The page padding comes from the tokens
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/auth-screen.test.tsx
//
// SEE: apps/mobile/src/components/auth-screen.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";

import { AuthScreen } from "@/components/auth-screen";
import { spacing } from "@/constants/theme";

function footer(overrides: { onPress?: () => void; disabled?: boolean } = {}) {
  return { prompt: "New here?", linkLabel: "Create an account", onPress: jest.fn(), ...overrides };
}

describe("AuthScreen", () => {
  it("draws the title, the subtitle and the children", async () => {
    await render(
      <AuthScreen title="Welcome back" subtitle="Practice." footer={footer()}>
        <Text>Inside</Text>
      </AuthScreen>,
    );
    expect(screen.getByText("Welcome back")).toBeTruthy();
    expect(screen.getByText("Practice.")).toBeTruthy();
    expect(screen.getByText("Inside")).toBeTruthy();
    expect(screen.getByText("Fluency Lab")).toBeTruthy();
  });

  it("draws the footer prompt and its link, and calls it when pressed", async () => {
    const onPress = jest.fn();
    await render(
      <AuthScreen title="T" subtitle="S" footer={footer({ onPress })}>
        <Text>Inside</Text>
      </AuthScreen>,
    );
    expect(screen.getByText(/New here\?/)).toBeTruthy();
    await fireEvent.press(screen.getByRole("link", { name: "Create an account" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call the footer link when disabled", async () => {
    const onPress = jest.fn();
    await render(
      <AuthScreen title="T" subtitle="S" footer={footer({ onPress, disabled: true })} />,
    );
    const link = screen.getByRole("link", { name: "Create an account" });
    expect(link.props.onPress).toBeUndefined();
    expect(onPress).not.toHaveBeenCalled();
  });

  it("draws no footer when it gets none", async () => {
    await render(<AuthScreen title="T" subtitle="S" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByText("New here?")).toBeNull();
  });

  it("applies the design's page padding from the tokens", async () => {
    await render(<AuthScreen title="T" subtitle="S" footer={footer()} testID="page" />);
    const style = StyleSheet.flatten(screen.getByTestId("page").props.contentContainerStyle);
    expect(style).toMatchObject({
      flexGrow: 1,
      justifyContent: "space-between",
      gap: spacing.xl,
      paddingTop: spacing.screenTop,
      paddingHorizontal: spacing.screenSide,
      paddingBottom: spacing.screenBottom,
    });
  });
});
