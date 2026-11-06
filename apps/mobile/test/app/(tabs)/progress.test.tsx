// apps/mobile/test/app/(tabs)/progress.test.tsx
//
// Tests for the Progress placeholder.
//
// Tested:
// - Progress draws its title when signed in
// - The end of Progress is padded by the tab bar clearance
// - Signed out users cannot reach Progress
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest "apps/mobile/test/app/(tabs)/progress.test.tsx"
//
// SEE: apps/mobile/src/app/(tabs)/progress.tsx

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { tabBarLayout } from "@/utils/tab-bar";

import { fakeSession, resetFakeAuth } from "../../helpers/fake-auth";
import { resetFakeData } from "../../helpers/fake-data";
import { resetFakeKeys } from "../../helpers/fake-keys";
import { renderApp, renderAppAt } from "../../helpers/render-app";

jest.mock("expo-font", () => ({ useFonts: jest.fn(() => [true, null]) }));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hide: jest.fn(),
}));
jest.mock("@/data", () => ({
  data: jest.requireActual<typeof import("../../helpers/fake-data")>("../../helpers/fake-data")
    .fakeData,
}));
jest.mock("@/keys", () => ({
  keys: jest.requireActual<typeof import("../../helpers/fake-keys")>("../../helpers/fake-keys")
    .fakeKeys,
}));
jest.mock("@/auth", () => {
  const fake =
    jest.requireActual<typeof import("../../helpers/fake-auth")>("../../helpers/fake-auth");
  return { auth: fake.fakeAuth, apple: fake.fakeApple };
});

describe("Progress placeholder", () => {
  beforeEach(() => {
    resetFakeAuth();
    resetFakeData();
    resetFakeKeys();
  });

  it("draws the Progress placeholder", async () => {
    await renderAppAt("/progress", fakeSession());
    expect(screen).toHavePathname("/progress");
    expect(screen.getAllByText("Progress").length).toBe(2);
  });

  it("pads the end of Progress by the tab bar clearance", async () => {
    await renderAppAt("/progress", fakeSession());
    const style = StyleSheet.flatten(screen.getByTestId("progress-content").props.style);
    expect(style.paddingBottom).toBe(tabBarLayout(0).clearance);
  });

  it("lands on Login when signed out at Progress", async () => {
    await renderApp("/progress", null);
    expect(screen).toHavePathname("/sign-in");
    expect(screen.queryByText("Progress")).toBeNull();
  });
});
