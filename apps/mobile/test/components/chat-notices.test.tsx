// apps/mobile/test/components/chat-notices.test.tsx
//
// Tests for ChatNotices.
//
// Tested:
// - Nothing for no notice
// - A failure with Try again or Update key, the OpenAI notice, the limit and the warning
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/chat-notices.test.tsx
//
// SEE: apps/mobile/src/components/chat-notices.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { ChatNotices } from "@/components/chat-notices";
import type { ChatNotice } from "@/utils/chat-state";

function notices(notice: ChatNotice, onRetry = () => {}, onUpdateKey = () => {}) {
  return <ChatNotices notice={notice} onRetry={onRetry} onUpdateKey={onUpdateKey} />;
}

describe("ChatNotices", () => {
  it("draws nothing for no notice", async () => {
    await render(notices(null));
    expect(screen.toJSON()).toBeNull();
  });

  it("draws a failure with Try again and calls onRetry", async () => {
    const onRetry = jest.fn();
    await render(
      notices({ kind: "failure", view: { message: "Could not reach.", action: "retry" } }, onRetry),
    );
    expect(screen.getByText("Could not reach.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("draws a failure with Update key and calls onUpdateKey", async () => {
    const onUpdateKey = jest.fn();
    await render(
      notices(
        { kind: "failure", view: { message: "Not accepted.", action: "update_key" } },
        () => {},
        onUpdateKey,
      ),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Update key" }));
    expect(onUpdateKey).toHaveBeenCalledTimes(1);
  });

  it("draws a failure with no action without a button", async () => {
    await render(notices({ kind: "failure", view: { message: "Nope.", action: null } }));
    expect(screen.getByText("Nope.")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toEqual([]);
  });

  it("draws the OpenAI notice with Update key", async () => {
    const onUpdateKey = jest.fn();
    await render(
      notices({ kind: "unsupported", message: "OpenAI is coming soon." }, () => {}, onUpdateKey),
    );
    expect(screen.getByText("OpenAI is coming soon.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Update key" }));
    expect(onUpdateKey).toHaveBeenCalledTimes(1);
  });

  it("draws the limit message and the warning without a button", async () => {
    await render(notices({ kind: "limit", view: { message: "Limit reached.", action: null } }));
    expect(screen.getByText("Limit reached.")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toEqual([]);
    await render(notices({ kind: "warning", message: "Near the limit." }));
    expect(screen.getByText("Near the limit.")).toBeTruthy();
  });
});
