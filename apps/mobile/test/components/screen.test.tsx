// apps/mobile/test/components/screen.test.tsx
//
// Tests for the shared Screen component.
//
// Tested:
// - It draws its children on the black background
//
// What is covered:
// - Normal case, empty case
//
// Run with: pnpm exec jest apps/mobile/test/components/screen.test.tsx
//
// SEE: apps/mobile/src/components/screen.tsx

import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";

import { Screen } from "@/components/screen";
import { colors } from "@/constants/theme";

describe("Screen", () => {
  it("draws its children on the black background", async () => {
    await render(
      <Screen testID="screen">
        <Text>Inside</Text>
      </Screen>,
    );
    expect(screen.getByText("Inside")).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId("screen").props.style).backgroundColor).toBe(
      colors.background,
    );
  });

  it("draws the background with no children", async () => {
    await render(<Screen testID="screen" />);
    expect(StyleSheet.flatten(screen.getByTestId("screen").props.style).backgroundColor).toBe(
      colors.background,
    );
  });

  it("passes the edges to the safe area when it gets them", async () => {
    await render(<Screen testID="screen" edges={["left", "right"]} />);
    expect(screen.getByTestId("screen").props.edges).toEqual({
      top: "off",
      bottom: "off",
      left: "additive",
      right: "additive",
    });
  });
});
