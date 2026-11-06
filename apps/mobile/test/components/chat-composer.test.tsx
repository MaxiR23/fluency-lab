// apps/mobile/test/components/chat-composer.test.tsx
//
// Tests for ChatComposer.
//
// Tested:
// - The composer: input and Send, enabled or disabled
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/chat-composer.test.tsx
//
// SEE: apps/mobile/src/components/chat-composer.tsx

import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";

import { ChatComposer } from "@/components/chat-composer";
import { colors } from "@/constants/theme";

describe("ChatComposer", () => {
  it("draws the placeholder in the placeholder color", async () => {
    await render(<ChatComposer placeholder="Type here" disabled={false} />);
    const input = screen.getByPlaceholderText("Type here");
    expect(input.props.placeholderTextColor).toBe(colors.textPlaceholder);
  });

  it("makes the input not editable and Send disabled when disabled", async () => {
    await render(<ChatComposer placeholder="Type here" disabled />);
    expect(screen.getByPlaceholderText("Type here").props.editable).toBe(false);
    expect(screen.getByRole("button", { name: "Send", disabled: true })).toBeTruthy();
  });

  it("makes both enabled when not disabled", async () => {
    await render(<ChatComposer placeholder="Type here" disabled={false} />);
    expect(screen.getByPlaceholderText("Type here").props.editable).toBe(true);
    expect(screen.getByRole("button", { name: "Send", disabled: false })).toBeTruthy();
  });
});
