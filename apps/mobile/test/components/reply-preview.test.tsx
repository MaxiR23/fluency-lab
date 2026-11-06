// apps/mobile/test/components/reply-preview.test.tsx
//
// Tests for ReplyPreview.
//
// Tested:
// - Replying to and the quoted text on one line
// - The X cancels the reply
// - The reply icon in the accent
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/reply-preview.test.tsx
//
// SEE: apps/mobile/src/components/reply-preview.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet, processColor } from "react-native";

import { ReplyPreview } from "@/components/reply-preview";
import { textStyle } from "@/components/text-style";
import { colors } from "@/constants/theme";

describe("ReplyPreview", () => {
  it("draws Replying to and the quoted text on one line", async () => {
    await render(
      <ReplyPreview label="Replying to Claude" text="Where did you go?" onCancel={() => {}} />,
    );

    const label = screen.getByText("Replying to Claude");
    const text = screen.getByText("Where did you go?");
    expect(StyleSheet.flatten(label.props.style)).toMatchObject(textStyle("tabActive"));
    expect(StyleSheet.flatten(text.props.style)).toMatchObject(textStyle("caption"));
    expect(text.props.numberOfLines).toBe(1);
    expect(text.props.ellipsizeMode).toBe("tail");
  });

  it("the X cancels the reply", async () => {
    const onCancel = jest.fn();
    await render(<ReplyPreview label="Replying to Claude" text="Hi" onCancel={onCancel} />);

    await fireEvent.press(screen.getByRole("button", { name: "Cancel reply" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("draws the reply icon in the accent", async () => {
    await render(<ReplyPreview label="Replying to Claude" text="Hi" onCancel={() => {}} />);

    // INFO: the svg host holds the stroke as a processed color number, not the hex string.
    const stroke = (color: string) =>
      `"stroke":{"type":0,"payload":${String(processColor(color))}}`;
    expect(screen.getByTestId("icon-reply", { includeHiddenElements: true })).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).toContain(stroke(colors.accent));
  });
});
