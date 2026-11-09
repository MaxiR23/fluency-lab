// apps/mobile/test/components/chat-header.test.tsx
//
// Tests for ChatHeader.
//
// Tested:
// - The title, the provider line, Back (with its own label when given) and the optional End action
// - The title as a Rename chat button with the pencil when onRename is given, disabled with renameDisabled
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
import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

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

  it("takes the back label it is given", async () => {
    const onBack = jest.fn();
    await render(
      <ChatHeader
        title="Correction"
        subtitle="Travel"
        onBack={onBack}
        backLabel="Back to the chat"
      />,
    );
    expect(screen.queryByRole("button", { name: "Back to Home" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Back to the chat" }));
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

  it("draws only the title when there is no subtitle", async () => {
    await render(<ChatHeader title="Practice" onBack={jest.fn()} />);
    expect(screen.getByRole("header", { name: "Practice" })).toBeTruthy();
    expect(screen.getAllByText(/.+/)).toHaveLength(1);
  });

  it("draws a trailing icon action with its icon, label and muted color", async () => {
    const onPress = jest.fn();
    await render(
      <ChatHeader
        title="Note"
        onBack={() => {}}
        action={{ icon: "trashPlain", label: "Delete note", onPress }}
      />,
    );
    const button = screen.getByRole("button", { name: "Delete note" });
    expect(button).toBeTruthy();
    expect(screen.getByTestId("icon-trashPlain", { includeHiddenElements: true })).toBeTruthy();
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("draws no action without one", async () => {
    await render(<ChatHeader title="Note" onBack={() => {}} />);
    expect(screen.queryByRole("button", { name: "Delete note" })).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("draws the title and subtitle in a Rename chat button with the pencil when onRename is given", async () => {
    await render(
      <ChatHeader
        title="Ramen spots in Tokyo"
        subtitle="Free chat · Claude"
        onBack={() => {}}
        onRename={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Rename chat: Ramen spots in Tokyo" })).toBeTruthy();
    expect(screen.getByText("Free chat · Claude")).toBeTruthy();
    expect(screen.getByTestId("icon-pen", { includeHiddenElements: true })).toBeTruthy();
  });

  it("calls onRename when the title is pressed", async () => {
    const onRename = jest.fn();
    await render(
      <ChatHeader
        title="Free chat"
        subtitle="Free chat · Claude"
        onBack={() => {}}
        onRename={onRename}
      />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Rename chat: Free chat" }));
    expect(onRename).toHaveBeenCalledTimes(1);
  });

  it("disables the rename button with renameDisabled", async () => {
    const onRename = jest.fn();
    await render(
      <ChatHeader title="Free chat" onBack={() => {}} onRename={onRename} renameDisabled />,
    );
    const button = screen.getByRole("button", { name: "Rename chat: Free chat", disabled: true });
    await fireEvent.press(button);
    expect(onRename).not.toHaveBeenCalled();
  });

  it("keeps the title a header with no pencil without onRename", async () => {
    await render(<ChatHeader title="Free chat" subtitle="Claude" onBack={() => {}} />);
    expect(screen.getByRole("header", { name: "Free chat" })).toBeTruthy();
    expect(screen.queryByTestId("icon-pen", { includeHiddenElements: true })).toBeNull();
  });

  it("draws the rename block 44 high with the pencil 6 after the title", async () => {
    await render(
      <ChatHeader title="Free chat" subtitle="Claude" onBack={() => {}} onRename={() => {}} />,
    );
    const button = screen.getByRole("button", { name: "Rename chat: Free chat" });
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({
      minHeight: size.touch,
      gap: spacing.tight,
    });
    const row = screen.getByTestId("chat-title-row");
    expect(StyleSheet.flatten(row.props.style)).toMatchObject({ gap: spacing.stack });
    const drawn = JSON.stringify(screen.toJSON());
    const stroke = `"stroke":{"type":0,"payload":${String(processColor(colors.textMuted))}}`;
    expect(drawn).toContain(stroke);
    expect(drawn).toContain(`"width":${size.iconCheck}`);
  });

  it("truncates the title to one line", async () => {
    await render(<ChatHeader title="A very long title" onBack={() => {}} onRename={() => {}} />);
    expect(screen.getByText("A very long title").props.numberOfLines).toBe(1);
  });
});
