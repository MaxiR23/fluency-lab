// apps/mobile/test/components/action-card.test.tsx
//
// Tests for ActionCard.
//
// Tested:
// - The pressable card of Home: role, palette, icon box, description, meta and tags
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

describe("ActionCard", () => {
  it("is a button named by its title and calls onPress", async () => {
    const onPress = jest.fn();
    await render(<ActionCard title="Free chat" onPress={onPress} />);
    await fireEvent.press(screen.getByRole("button", { name: "Free chat" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("draws the highlighted palette when highlighted and the surface palette otherwise", async () => {
    const { rerender } = await render(<ActionCard title="Card" highlighted onPress={jest.fn()} />);
    let style = StyleSheet.flatten(screen.getByRole("button", { name: "Card" }).props.style);
    expect(style).toMatchObject(selectableStyle({ selected: true }));
    await rerender(<ActionCard title="Card" onPress={jest.fn()} />);
    style = StyleSheet.flatten(screen.getByRole("button", { name: "Card" }).props.style);
    expect(style).toMatchObject(selectableStyle({ selected: false }));
  });

  it("draws the icon box only with an icon", async () => {
    const { rerender } = await render(<ActionCard title="Card" onPress={jest.fn()} />);
    expect(screen.queryByTestId("icon-chat", { includeHiddenElements: true })).toBeNull();
    await rerender(<ActionCard title="Card" icon="chat" onPress={jest.fn()} />);
    expect(screen.getByTestId("icon-chat", { includeHiddenElements: true })).toBeTruthy();
  });

  it("draws the description, the meta and every tag when given", async () => {
    await render(
      <ActionCard
        title="Card"
        description="Last words"
        meta="5 min ago"
        tags={["Travel", "Role play"]}
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByText("Last words")).toBeTruthy();
    expect(screen.getByText("5 min ago")).toBeTruthy();
    expect(screen.getByText("Travel")).toBeTruthy();
    expect(screen.getByText("Role play")).toBeTruthy();
  });

  it("draws no description, meta or tag when none is given", async () => {
    await render(<ActionCard title="Card" onPress={jest.fn()} />);
    expect(screen.queryByText("Last words")).toBeNull();
    expect(screen.queryByText("5 min ago")).toBeNull();
  });
});
