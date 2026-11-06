// apps/mobile/test/components/list-group.test.tsx
//
// Tests for ListGroup.
//
// Tested:
// - The section title as a header and the rows inside one bordered container
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/list-group.test.tsx
//
// SEE: apps/mobile/src/components/list-group.tsx

import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { ListGroup } from "@/components/list-group";
import { Text } from "@/components/text";
import { textStyle } from "@/components/text-style";
import { borderWidth, colors, radius } from "@/constants/theme";

describe("ListGroup", () => {
  it("draws the title as a header in the section style, then the rows", async () => {
    await render(
      <ListGroup title="Your AI">
        <Text>First</Text>
        <Text>Second</Text>
      </ListGroup>,
    );
    const title = screen.getByRole("header", { name: "Your AI" });
    expect(StyleSheet.flatten(title.props.style)).toMatchObject(textStyle("section"));
    expect(screen.getByText("First")).toBeTruthy();
    expect(screen.getByText("Second")).toBeTruthy();
  });

  it("holds the rows in a clipped, bordered surface with the control radius", async () => {
    await render(
      <ListGroup title="App">
        <Text>Row</Text>
      </ListGroup>,
    );
    const style = StyleSheet.flatten(screen.getByTestId("list-group-rows").props.style);
    expect(style).toMatchObject({
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: borderWidth.thin,
      borderRadius: radius.control,
      overflow: "hidden",
    });
  });

  it("draws an empty group with only its title", async () => {
    await render(<ListGroup title="Empty">{null}</ListGroup>);
    expect(screen.getByRole("header", { name: "Empty" })).toBeTruthy();
  });
});
