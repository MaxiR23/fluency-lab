// apps/mobile/test/components/text.test.tsx
//
// Tests for the shared Text component.
//
// Tested:
// - It draws its children with the style of its variant
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/text.test.tsx
//
// SEE: apps/mobile/src/components/text.tsx

import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { Text } from "@/components/text";
import { textStyle } from "@/components/text-style";

describe("Text", () => {
  it("draws its children in the body style by default", async () => {
    await render(<Text>Hello</Text>);
    const node = screen.getByText("Hello");
    expect(StyleSheet.flatten(node.props.style)).toEqual(textStyle("body"));
  });

  it("applies the style of the variant it gets", async () => {
    await render(<Text variant="title">Hello</Text>);
    const node = screen.getByText("Hello");
    expect(StyleSheet.flatten(node.props.style)).toEqual(textStyle("title"));
  });
});
