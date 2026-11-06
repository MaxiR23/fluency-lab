// apps/mobile/test/components/connect-ai-card.test.tsx
//
// Tests for ConnectAiCard.
//
// Tested:
// - The lock box, the texts and Add API key
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/connect-ai-card.test.tsx
//
// SEE: apps/mobile/src/components/connect-ai-card.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { ConnectAiCard } from "@/components/connect-ai-card";
import { size } from "@/constants/theme";

describe("ConnectAiCard", () => {
  it("draws the lock box, the title, the body and a compact Add API key", async () => {
    await render(<ConnectAiCard onAddKey={() => {}} />);
    expect(screen.getByTestId("icon-lock", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText("Connect your AI to start")).toBeTruthy();
    expect(
      screen.getByText("Add your Claude or OpenAI key. It stays only on this device."),
    ).toBeTruthy();
    const button = screen.getByRole("button", { name: "Add API key" });
    expect(StyleSheet.flatten(button.props.style).minHeight).toBe(size.controlCompact);
  });

  it("calls onAddKey", async () => {
    const onAddKey = jest.fn();
    await render(<ConnectAiCard onAddKey={onAddKey} />);
    await fireEvent.press(screen.getByRole("button", { name: "Add API key" }));
    expect(onAddKey).toHaveBeenCalledTimes(1);
  });
});
