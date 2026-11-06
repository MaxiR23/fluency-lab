// apps/mobile/test/components/chat-header.test.tsx
//
// Tests for ChatHeader.
//
// Tested:
// - The title, the provider line and Back
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/chat-header.test.tsx
//
// SEE: apps/mobile/src/components/chat-header.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { ChatHeader } from "@/components/chat-header";

describe("ChatHeader", () => {
  it("draws the title as a header and the subtitle line", async () => {
    await render(<ChatHeader title="Travel plans" subtitle="Claude" onBack={() => {}} />);
    expect(screen.getByRole("header", { name: "Travel plans" })).toBeTruthy();
    expect(screen.getByText("Claude")).toBeTruthy();
  });

  it("calls onBack from Back to Home", async () => {
    const onBack = jest.fn();
    await render(<ChatHeader title="Free chat" subtitle="Claude" onBack={onBack} />);
    await fireEvent.press(screen.getByRole("button", { name: "Back to Home" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("draws no End button and no cost", async () => {
    await render(<ChatHeader title="Free chat" subtitle="Claude" onBack={() => {}} />);
    expect(screen.queryByText("End")).toBeNull();
    expect(screen.queryByText(/\$/)).toBeNull();
  });
});
