// apps/mobile/test/components/offline-card.test.tsx
//
// Tests for OfflineCard, the inline can't-connect card under a screen's header.
//
// Tested:
// - The small badge, the title it is given, the copy and Try again
// - The header slot when placed, and none otherwise
// - The retrying state and the inline button size
// - The rise on mount, and none with reduce motion
//
// What is covered:
// - Normal case, retrying, reduce motion
//
// Run with: pnpm exec jest apps/mobile/test/components/offline-card.test.tsx
//
// SEE: apps/mobile/src/components/offline-card.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { OfflineCard } from "@/components/offline-card";
import { offlineCardStyle } from "@/components/offline-card-style";
import { size } from "@/constants/theme";
import { offlineCardBody, retryingLabel } from "@/utils/load-failure";
import { offlineMotion } from "@/utils/offline-motion";

function motion() {
  const built = offlineMotion(false);
  if (built === null) throw new Error("offline motion is off without reduce motion");
  return built;
}

describe("OfflineCard", () => {
  it("draws the small badge, the title it is given, the copy and Try again", async () => {
    await render(
      <OfflineCard
        title="Can't load your chats"
        retrying={false}
        onRetry={jest.fn()}
        motion={null}
      />,
    );
    expect(screen.getByTestId("offline-badge", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByRole("header", { name: "Can't load your chats" })).toBeTruthy();
    expect(screen.getByText(offlineCardBody)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryAllByTestId("offline-ring", { includeHiddenElements: true })).toHaveLength(
      0,
    );
  });

  it("wraps the card in the header slot only when placed", async () => {
    await render(
      <OfflineCard
        title="Can't load Home"
        retrying={false}
        onRetry={jest.fn()}
        motion={null}
        placed
      />,
    );
    const slot = screen.getByTestId("offline-card").parent;
    expect(StyleSheet.flatten(slot?.props.style)).toEqual(offlineCardStyle().slot);
  });

  it("adds no wrapper when not placed", async () => {
    await render(
      <OfflineCard title="Can't load Home" retrying={false} onRetry={jest.fn()} motion={null} />,
    );
    expect(screen.getByTestId("offline-card").parent?.props.style).toBeUndefined();
  });

  it("calls onRetry from Try again", async () => {
    const onRetry = jest.fn();
    await render(
      <OfflineCard title="Can't load Home" retrying={false} onRetry={onRetry} motion={null} />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("draws the retrying state: Try again disabled and busy, the spinner and Trying again…", async () => {
    const onRetry = jest.fn();
    await render(
      <OfflineCard title="Can't load Home" retrying onRetry={onRetry} motion={motion()} />,
    );
    const button = screen.getByRole("button", { name: "Try again", busy: true, disabled: true });
    expect(button).toBeTruthy();
    expect(screen.getByText(retryingLabel)).toBeTruthy();
    expect(screen.getByTestId("arc-spinner", { includeHiddenElements: true })).toBeTruthy();
    await fireEvent.press(button);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("uses the inline button size", async () => {
    await render(
      <OfflineCard title="Can't load Home" retrying={false} onRetry={jest.fn()} motion={null} />,
    );
    const style = StyleSheet.flatten(screen.getByRole("button").props.style);
    expect(style.minHeight).toBe(size.touch);
  });

  it("rises 10 points in 1000 ms, and not with reduce motion", async () => {
    const { rerender } = await render(
      <OfflineCard
        title="Can't load Home"
        retrying={false}
        onRetry={jest.fn()}
        motion={motion()}
      />,
    );
    expect(screen.getByTestId("offline-card").props.entering.getDuration()).toBe(1000);
    await rerender(
      <OfflineCard title="Can't load Home" retrying={false} onRetry={jest.fn()} motion={null} />,
    );
    expect(screen.getByTestId("offline-card").props.entering).toBeUndefined();
  });
});
