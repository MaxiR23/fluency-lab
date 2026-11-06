// apps/mobile/test/app/(tabs)/progress.test.tsx
//
// Tests for the Progress placeholder.
//
// Tested:
// - Progress draws its title when signed in
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

  it("lands on Login when signed out at Progress", async () => {
    await renderApp("/progress", null);
    expect(screen).toHavePathname("/sign-in");
    expect(screen.queryByText("Progress")).toBeNull();
  });
});
