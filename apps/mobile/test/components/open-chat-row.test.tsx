// apps/mobile/test/components/open-chat-row.test.tsx
//
// Tests for OpenChatRow.
//
// Tested:
// - The title, the time, the one-line preview and the topic icon of a row
// - A row with no preview and no time
// - Pressing the row, and the End and Delete actions (Delete receives close)
// - The swipe action tokens
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/open-chat-row.test.tsx
//
// SEE: apps/mobile/src/components/open-chat-row.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { pressAction } from "../helpers/press-action";
import { OpenChatRow } from "@/components/open-chat-row";
import { borderWidth, colors, radius, size } from "@/constants/theme";
import type { OpenChatRowView } from "@/utils/open-chats";

const row: OpenChatRowView = {
  id: "s1",
  title: "Weekend plans",
  time: "2h",
  preview: "Where do you want to go?",
  icon: "briefcase",
};

function drawn(
  view: OpenChatRowView = row,
  handlers: Partial<{
    onPress: () => void;
    onEnd: () => void;
    onDelete: (close: () => void) => void;
  }> = {},
) {
  return (
    <GestureHandlerRootView>
      <OpenChatRow
        row={view}
        onPress={handlers.onPress ?? (() => {})}
        onEnd={handlers.onEnd ?? (() => {})}
        onDelete={handlers.onDelete ?? (() => {})}
      />
    </GestureHandlerRootView>
  );
}

describe("OpenChatRow", () => {
  it("draws the title, the time, the preview and the topic icon", async () => {
    await render(drawn());
    expect(screen.getByText("Weekend plans")).toBeTruthy();
    expect(screen.getByText("2h")).toBeTruthy();
    expect(screen.getByText("Where do you want to go?")).toBeTruthy();
    expect(screen.getByTestId("icon-briefcase", { includeHiddenElements: true })).toBeTruthy();
  });

  it("draws no preview line when there is none and no time when it is null", async () => {
    await render(drawn({ ...row, preview: null, time: null }));
    expect(screen.getByText("Weekend plans")).toBeTruthy();
    expect(screen.queryByText("2h")).toBeNull();
    expect(screen.queryByText("Where do you want to go?")).toBeNull();
  });

  it("truncates the title and the preview to one line", async () => {
    await render(drawn());
    expect(screen.getByText("Weekend plans").props.numberOfLines).toBe(1);
    expect(screen.getByText("Where do you want to go?").props.numberOfLines).toBe(1);
  });

  it("opens the chat when the row is pressed", async () => {
    const onPress = jest.fn();
    await render(drawn(row, { onPress }));
    await fireEvent.press(screen.getByRole("button", { name: "Weekend plans" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("renders End and Delete as the right actions, End calling onEnd", async () => {
    const onEnd = jest.fn();
    await render(drawn(row, { onEnd }));
    expect(screen.getByRole("button", { name: "Delete Weekend plans" })).toBeTruthy();
    await pressAction(screen.getByRole("button", { name: "End Weekend plans" }));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("hands Delete a close function", async () => {
    const onDelete = jest.fn<(close: () => void) => void>();
    await render(drawn(row, { onDelete }));
    await pressAction(screen.getByRole("button", { name: "Delete Weekend plans" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(typeof onDelete.mock.calls[0]?.[0]).toBe("function");
  });

  it("draws End and Delete with the swipe action tokens", async () => {
    await render(drawn());
    const end = StyleSheet.flatten(
      screen.getByRole("button", { name: "End Weekend plans" }).props.style,
    );
    const remove = StyleSheet.flatten(
      screen.getByRole("button", { name: "Delete Weekend plans" }).props.style,
    );
    expect(end).toMatchObject({
      width: size.swipeAction,
      backgroundColor: colors.accentLine,
      borderColor: colors.accentPressed,
      borderWidth: borderWidth.thin,
      borderRadius: radius.control,
    });
    expect(remove).toMatchObject({
      width: size.swipeAction,
      backgroundColor: colors.errorSoft,
      borderColor: colors.errorLine,
      borderWidth: borderWidth.thin,
      borderRadius: radius.control,
    });
  });
});
