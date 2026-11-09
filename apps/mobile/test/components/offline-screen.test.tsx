// apps/mobile/test/components/offline-screen.test.tsx
//
// Tests for OfflineScreen, the full can't-connect screen of launch and onboarding.
//
// Tested:
// - The badge, the title, the copy, Try again and Sign out
// - The retrying state, signing out, the sign-out failure
// - The rise on mount, and none with reduce motion
//
// What is covered:
// - Normal case, retrying, reduce motion, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/offline-screen.test.tsx
//
// SEE: apps/mobile/src/components/offline-screen.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { OfflineScreen } from "@/components/offline-screen";
import { shadow } from "@/constants/theme";
import { offlineMotion } from "@/utils/offline-motion";
import { offlineScreenBody, offlineScreenTitle, retryingLabel } from "@/utils/load-failure";

type Props = Parameters<typeof OfflineScreen>[0];

function props(overrides: Partial<Props> = {}): Props {
  return {
    retrying: false,
    onRetry: jest.fn(),
    onSignOut: jest.fn(),
    signingOut: false,
    motion: null,
    ...overrides,
  };
}

function motion() {
  const built = offlineMotion(false);
  if (built === null) throw new Error("offline motion is off without reduce motion");
  return built;
}

describe("OfflineScreen", () => {
  it("draws the large badge, Can't connect right now, the copy, Try again and Sign out", async () => {
    await render(<OfflineScreen {...props()} />);
    expect(screen.getByTestId("offline-badge", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByRole("header", { name: offlineScreenTitle })).toBeTruthy();
    expect(screen.getByText(offlineScreenBody)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign out" })).toBeTruthy();
  });

  it("calls onRetry from Try again", async () => {
    const onRetry = jest.fn();
    await render(<OfflineScreen {...props({ onRetry })} />);
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("draws the retrying state: Try again disabled and busy, the spinner and Trying again…", async () => {
    await render(<OfflineScreen {...props({ retrying: true, motion: motion() })} />);
    expect(
      screen.getByRole("button", { name: "Try again", busy: true, disabled: true }),
    ).toBeTruthy();
    expect(screen.getByText(retryingLabel)).toBeTruthy();
    expect(screen.getByTestId("arc-spinner", { includeHiddenElements: true })).toBeTruthy();
  });

  it("does not call onRetry while retrying", async () => {
    const onRetry = jest.fn();
    await render(<OfflineScreen {...props({ retrying: true, onRetry })} />);
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("wraps Try again in the floating shadow and the glow, and drops both while retrying", async () => {
    const { rerender } = await render(<OfflineScreen {...props()} />);
    expect(StyleSheet.flatten(screen.getByTestId("offline-retry-glow").props.style)).toMatchObject(
      shadow.glow,
    );
    expect(
      StyleSheet.flatten(screen.getByTestId("offline-retry-floating").props.style),
    ).toMatchObject(shadow.floating);
    await rerender(<OfflineScreen {...props({ retrying: true })} />);
    expect(screen.queryByTestId("offline-retry-glow")).toBeNull();
    expect(screen.queryByTestId("offline-retry-floating")).toBeNull();
  });

  it("calls onSignOut from Sign out", async () => {
    const onSignOut = jest.fn();
    await render(<OfflineScreen {...props({ onSignOut })} />);
    await fireEvent.press(screen.getByRole("link", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("disables Sign out while signing out", async () => {
    const onSignOut = jest.fn();
    await render(<OfflineScreen {...props({ onSignOut, signingOut: true })} />);
    expect(screen.getByText("Sign out").props.onPress).toBeUndefined();
    expect(screen.getByText("Sign out").props.disabled).toBe(true);
    expect(onSignOut).not.toHaveBeenCalled();
  });

  it("draws the sign-out failure above Try again", async () => {
    await render(
      <OfflineScreen {...props({ signOutFailure: { message: "Could not sign out." } })} />,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Could not sign out.")).toBeTruthy();
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf("Could not sign out.")).toBeLessThan(tree.indexOf("Try again"));
  });

  it("rises 10 points in 1000 ms when it mounts", async () => {
    await render(<OfflineScreen {...props({ motion: motion() })} />);
    const entering = screen.getByTestId("offline-body").props.entering;
    expect(entering).toBeDefined();
    expect(entering.getDuration()).toBe(1000);
  });

  it("does not rise with reduce motion", async () => {
    await render(<OfflineScreen {...props({ motion: null })} />);
    expect(screen.getByTestId("offline-body").props.entering).toBeUndefined();
  });
});
