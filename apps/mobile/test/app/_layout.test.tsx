// apps/mobile/test/app/_layout.test.tsx
//
// Tests for the root layout.
//
// Tested:
// - The splash stays until the fonts settle and the session loads
// - The stack renders only after that, with the guarded screens
// - The faces are loaded under the names the theme uses
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/app/_layout.test.tsx
//
// SEE: apps/mobile/src/app/_layout.tsx

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, render, screen } from "@testing-library/react-native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";

import RootLayout from "@/app/_layout";
import { fontFamily } from "@/constants/theme";
import { emitSession, fakeSession, resetFakeAuth } from "../helpers/fake-auth";
import { resetFakeData } from "../helpers/fake-data";

jest.mock("expo-font", () => ({ useFonts: jest.fn() }));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hide: jest.fn(),
}));
jest.mock("expo-router", () => ({
  Stack: Object.assign(
    jest.fn(() => null),
    { Protected: () => null, Screen: () => null },
  ),
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
    resetFakeAuth();
    resetFakeData();
  });

  it("prevents the splash from hiding when the module loads", () => {
    expect(SplashScreen.preventAutoHideAsync).toHaveBeenCalledTimes(1);
  });

  it("renders nothing and keeps the splash while the fonts load", async () => {
    jest.mocked(useFonts).mockReturnValue([false, null]);
    await render(<RootLayout />);
    expect(screen.toJSON()).toBeNull();
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

  it("loads the three faces under the names the theme uses", async () => {
    jest.mocked(useFonts).mockReturnValue([true, null]);
    await render(<RootLayout />);
    expect(useFonts).toHaveBeenCalledWith(
      expect.objectContaining({
        [fontFamily.regular]: expect.anything(),
        [fontFamily.semibold]: expect.anything(),
        [fontFamily.bold]: expect.anything(),
      }),
    );
  });

  it("keeps the splash and renders nothing while the session loads, with the fonts loaded", async () => {
    jest.mocked(useFonts).mockReturnValue([true, null]);
    await render(<RootLayout />);
    expect(screen.toJSON()).toBeNull();
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
});
