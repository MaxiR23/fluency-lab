// apps/mobile/test/app/_layout.test.tsx
//
// Tests for the root layout.
//
// Tested:
// - The splash stays until the fonts settle and the session loads
// - The stack renders only after that, with the guarded screens
// - The can't-connect screen when the session cannot be restored on the network, its retrying state, Sign out and the retry
// - The red failure with Try again for a restore failure that is not the network
// - The faces are loaded under the names the theme uses
// - The root view background is set to the background token when the module loads
// - The tree is wrapped in a ThemeProvider with the token dark theme
// - The whole app is wrapped in the keyboard provider
// - The app is wrapped in the haptics provider, which reads the stored setting once
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/app/_layout.test.tsx
//
// SEE: apps/mobile/src/app/_layout.tsx

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useFonts } from "expo-font";
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import type { ReactNode } from "react";

import RootLayout from "@/app/_layout";
import { colors, fontFamily } from "@/constants/theme";
import { authFailureMessage } from "@/utils/auth-message";
import { offlineScreenTitle, retryingLabel } from "@/utils/load-failure";
import { darkNavigationTheme } from "@/utils/navigation-theme";
import { RESTORE_TIMEOUT_MS } from "@/utils/session-state";
import { emitSession, fakeAuth, fakeSession, resetFakeAuth } from "../helpers/fake-auth";
import { resetFakeData } from "../helpers/fake-data";
import { fakeHapticsSetting } from "../helpers/fake-haptics";

jest.mock("expo-font", () => ({ useFonts: jest.fn() }));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hide: jest.fn(),
}));
jest.mock("expo-system-ui", () => ({
  setBackgroundColorAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock("expo-router", () => ({
  Stack: Object.assign(
    jest.fn(() => null),
    { Protected: () => null, Screen: () => null },
  ),
  ThemeProvider: jest.fn(({ children }: { children: ReactNode }) => children),
  DarkTheme: jest.requireActual<typeof import("expo-router")>("expo-router").DarkTheme,
}));
jest.mock("@/data", () => ({
  data: jest.requireActual<typeof import("../helpers/fake-data")>("../helpers/fake-data").fakeData,
}));
jest.mock("@/auth", () => ({
  auth: jest.requireActual<typeof import("../helpers/fake-auth")>("../helpers/fake-auth").fakeAuth,
}));

describe("RootLayout", () => {
  beforeEach(() => {
    jest.mocked(SplashScreen.hide).mockClear();
    jest.mocked(Stack).mockClear();
    jest.mocked(ThemeProvider).mockClear();
    resetFakeAuth();
    resetFakeData();
  });

  it("prevents the splash from hiding when the module loads", () => {
    expect(SplashScreen.preventAutoHideAsync).toHaveBeenCalledTimes(1);
  });

  it("renders nothing and keeps the splash while the fonts load", async () => {
    jest.mocked(useFonts).mockReturnValue([false, null]);
    await render(<RootLayout />);
    expect(screen.toJSON()).toMatchObject({
      type: "View",
      children: [{ type: "KeyboardProvider", children: [] }],
    });
    expect(SplashScreen.hide).not.toHaveBeenCalled();
    expect(Stack).not.toHaveBeenCalled();
  });

  it("hides the splash and renders the stack when the fonts load", async () => {
    jest.mocked(useFonts).mockReturnValue([true, null]);
    await render(<RootLayout />);
    await act(async () => emitSession(null));
    expect(SplashScreen.hide).toHaveBeenCalledTimes(1);
    expect(Stack).toHaveBeenCalled();
  });

  it("hides the splash and renders the stack when the fonts fail", async () => {
    jest.mocked(useFonts).mockReturnValue([false, new Error("no font")]);
    await render(<RootLayout />);
    await act(async () => emitSession(null));
    expect(SplashScreen.hide).toHaveBeenCalledTimes(1);
    expect(Stack).toHaveBeenCalled();
  });

  it("loads the four faces under the names the theme uses", async () => {
    jest.mocked(useFonts).mockReturnValue([true, null]);
    await render(<RootLayout />);
    expect(useFonts).toHaveBeenCalledWith(
      expect.objectContaining({
        [fontFamily.regular]: expect.anything(),
        [fontFamily.medium]: expect.anything(),
        [fontFamily.semibold]: expect.anything(),
        [fontFamily.bold]: expect.anything(),
      }),
    );
  });

  it("keeps the splash and renders nothing while the session loads, with the fonts loaded", async () => {
    jest.mocked(useFonts).mockReturnValue([true, null]);
    await render(<RootLayout />);
    expect(screen.toJSON()).toMatchObject({
      type: "View",
      children: [{ type: "KeyboardProvider", children: [] }],
    });
    expect(SplashScreen.hide).not.toHaveBeenCalled();
    expect(Stack).not.toHaveBeenCalled();
  });

  it("hides the splash once only when both settle", async () => {
    jest.mocked(useFonts).mockReturnValue([true, null]);
    await render(<RootLayout />);
    await act(async () => emitSession(null));
    await act(async () => emitSession(fakeSession()));
    expect(SplashScreen.hide).toHaveBeenCalledTimes(1);
  });

  it("sets the root view background to the background token when the module loads", () => {
    expect(SystemUI.setBackgroundColorAsync).toHaveBeenCalledTimes(1);
    expect(SystemUI.setBackgroundColorAsync).toHaveBeenCalledWith(colors.background);
  });

  it("wraps the stack in a ThemeProvider with the token dark theme", async () => {
    jest.mocked(useFonts).mockReturnValue([true, null]);
    await render(<RootLayout />);
    await act(async () => emitSession(null));
    expect(ThemeProvider).toHaveBeenCalled();
    const calls = jest.mocked(ThemeProvider).mock.calls;
    const value = calls[calls.length - 1]?.[0].value;
    expect(value).toEqual(darkNavigationTheme(DarkTheme));
    expect(value?.colors.background).toBe(colors.background);
    expect(Stack).toHaveBeenCalled();
  });

  it("wraps the app in the keyboard provider", async () => {
    jest.mocked(useFonts).mockReturnValue([true, null]);
    await render(<RootLayout />);
    expect(JSON.stringify(screen.toJSON())).toContain('"type":"KeyboardProvider"');
  });

  it("wraps the app in the haptics provider", async () => {
    jest.mocked(useFonts).mockReturnValue([true, null]);
    await render(<RootLayout />);
    await act(async () => emitSession(null));
    expect(fakeHapticsSetting.read).toHaveBeenCalledTimes(1);
  });

  describe("when the session cannot be restored", () => {
    const unreachable = "Could not reach the server. Check your connection and try again.";

    afterEach(() => {
      jest.useRealTimers();
    });

    it("draws the can't-connect screen and hides the splash when the restore fails on the network", async () => {
      jest.mocked(useFonts).mockReturnValue([true, null]);
      fakeAuth.currentSession.mockResolvedValue({ ok: false, failure: "network" });
      await render(<RootLayout />);
      expect(screen.getByRole("header", { name: offlineScreenTitle })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Sign out" })).toBeTruthy();
      expect(screen.queryByText(unreachable)).toBeNull();
      expect(screen.queryByText(authFailureMessage("network"))).toBeNull();
      expect(SplashScreen.hide).toHaveBeenCalledTimes(1);
      expect(Stack).not.toHaveBeenCalled();
    });

    it("draws the can't-connect screen when the restore does not settle before the deadline, never a blank screen", async () => {
      jest.useFakeTimers();
      jest.mocked(useFonts).mockReturnValue([true, null]);
      await render(<RootLayout />);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(RESTORE_TIMEOUT_MS);
      });
      expect(screen.getByRole("header", { name: offlineScreenTitle })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
      expect(screen.queryByText(authFailureMessage("network"))).toBeNull();
      expect(SplashScreen.hide).toHaveBeenCalledTimes(1);
      expect(Stack).not.toHaveBeenCalled();
    });

    it("keeps the red failure for a restore failure that is not the network", async () => {
      jest.mocked(useFonts).mockReturnValue([true, null]);
      fakeAuth.currentSession.mockResolvedValue({ ok: false, failure: "unknown" });
      await render(<RootLayout />);
      expect(screen.getByText(authFailureMessage("unknown"))).toBeTruthy();
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
      expect(screen.queryByText(offlineScreenTitle)).toBeNull();
      expect(Stack).not.toHaveBeenCalled();
    });

    it("shows Trying again\u2026 while Try again reads, then renders the stack when the server is back", async () => {
      jest.mocked(useFonts).mockReturnValue([true, null]);
      fakeAuth.currentSession.mockResolvedValueOnce({ ok: false, failure: "network" });
      await render(<RootLayout />);
      let back!: (value: Awaited<ReturnType<typeof fakeAuth.currentSession>>) => void;
      fakeAuth.currentSession.mockReturnValueOnce(
        new Promise((resolve) => {
          back = resolve;
        }),
      );
      await act(async () => {
        fireEvent.press(screen.getByRole("button", { name: "Try again" }));
      });
      expect(
        screen.getByRole("button", { name: "Try again", busy: true, disabled: true }),
      ).toBeTruthy();
      expect(screen.getByText(retryingLabel)).toBeTruthy();
      expect(screen.getByRole("header", { name: offlineScreenTitle })).toBeTruthy();
      expect(Stack).not.toHaveBeenCalled();
      await act(async () => back({ ok: true, value: null }));
      expect(Stack).toHaveBeenCalled();
      expect(SplashScreen.hide).toHaveBeenCalledTimes(1);
    });

    it("signs out from the can't-connect screen and lands on sign-in", async () => {
      jest.mocked(useFonts).mockReturnValue([true, null]);
      fakeAuth.currentSession.mockResolvedValue({ ok: false, failure: "network" });
      fakeAuth.signOut.mockResolvedValue({ ok: true, value: null });
      await render(<RootLayout />);
      await act(async () => {
        fireEvent.press(screen.getByRole("link", { name: "Sign out" }));
      });
      expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
      await act(async () => emitSession(null));
      expect(Stack).toHaveBeenCalled();
      expect(screen.queryByText(offlineScreenTitle)).toBeNull();
    });

    it("draws the sign-out failure above Try again and keeps the screen", async () => {
      jest.mocked(useFonts).mockReturnValue([true, null]);
      fakeAuth.currentSession.mockResolvedValue({ ok: false, failure: "network" });
      fakeAuth.signOut.mockResolvedValue({ ok: false, failure: "network" });
      await render(<RootLayout />);
      await act(async () => {
        fireEvent.press(screen.getByRole("link", { name: "Sign out" }));
      });
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByText(authFailureMessage("network"))).toBeTruthy();
      expect(screen.getByRole("header", { name: offlineScreenTitle })).toBeTruthy();
      expect(Stack).not.toHaveBeenCalled();
    });

    it("keeps the splash while the fonts load even when the restore failed", async () => {
      jest.mocked(useFonts).mockReturnValue([false, null]);
      fakeAuth.currentSession.mockResolvedValue({ ok: false, failure: "network" });
      await render(<RootLayout />);
      expect(screen.queryByText(offlineScreenTitle)).toBeNull();
      expect(SplashScreen.hide).not.toHaveBeenCalled();
    });
  });
});
