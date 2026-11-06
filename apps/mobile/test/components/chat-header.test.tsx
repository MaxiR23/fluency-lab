// apps/mobile/test/components/chat-header.test.tsx
//
// Tests for ChatHeader.
//
// Tested:
// - The title, the provider line, Back and the optional End action
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/chat-header.test.tsx
//
// SEE: apps/mobile/src/components/chat-header.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet, processColor } from "react-native";

import { ChatHeader } from "@/components/chat-header";
import { borderWidth, colors, radius, size } from "@/constants/theme";

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
    expect(screen.queryByRole("button", { name: "End session" })).toBeNull();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it("draws End when onEnd is given and calls it", async () => {
    const onEnd = jest.fn();
    await render(
      <ChatHeader title="Free chat" subtitle="Claude" onBack={() => {}} onEnd={onEnd} />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "End session" }));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("draws End session as the round X of the design", async () => {
    await render(
      <ChatHeader title="Free chat" subtitle="Claude" onBack={() => {}} onEnd={() => {}} />,
    );
    const button = screen.getByRole("button", { name: "End session" });
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({
      width: size.badge,
      height: size.badge,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: borderWidth.thin,
    });
    expect(screen.getByTestId("icon-close", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText("End")).toBeNull();
  });

  it("disables End with endDisabled", async () => {
    const onEnd = jest.fn();
    await render(
      <ChatHeader
        title="Free chat"
        subtitle="Claude"
        onBack={() => {}}
        onEnd={onEnd}
        endDisabled
      />,
    );
    expect(screen.getByRole("button", { name: "End session", disabled: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "End session", disabled: true }));
    expect(onEnd).not.toHaveBeenCalled();
  });

  it("draws End with the accent border while pressed", async () => {
    await render(
      <ChatHeader title="Free chat" subtitle="Claude" onBack={() => {}} onEnd={() => {}} />,
    );
    const button = screen.getByRole("button", { name: "End session" });
    await fireEvent(button, "responderGrant", {
      persist: () => {},
      nativeEvent: { touches: [], changedTouches: [], pageX: 0, pageY: 0, timestamp: 0 },
      touchHistory: { touchBank: [], numberActiveTouches: 0, indexOfSingleActiveTouch: -1 },
    });
    expect(
      StyleSheet.flatten(screen.getByRole("button", { name: "End session" }).props.style),
    ).toMatchObject({ borderColor: colors.accentPressed, backgroundColor: colors.surface });
  });

  it("draws End dimmed when disabled, like the disabled secondary button", async () => {
    await render(
      <ChatHeader
        title="Free chat"
        subtitle="Claude"
        onBack={() => {}}
        onEnd={() => {}}
        endDisabled
      />,
    );
    const button = screen.getByRole("button", { name: "End session", disabled: true });
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({
      backgroundColor: colors.background,
      borderColor: colors.border,
    });
    const drawn = JSON.stringify(screen.toJSON());
    // INFO: the svg host holds the stroke as a processed color number, not the hex string.
    const stroke = (color: string) =>
      `"stroke":{"type":0,"payload":${String(processColor(color))}}`;
    expect(drawn).toContain(stroke(colors.textMuted));
  });
});
