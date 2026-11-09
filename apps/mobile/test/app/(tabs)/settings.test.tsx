// apps/mobile/test/app/(tabs)/settings.test.tsx
//
// Tests for the Settings screen.
//
// Tested:
// - Loading, with data, expected empty (no spend, no limit, no key) and error states
// - The month's spend, the limit, the bar and the reset date
// - The provider, the model and the key rows, and the version
// - The haptics switch: on by default, off saved on the device, a save failure
// - Edit limit, Provider and API key open their screens, the key step with the current provider and limit
// - The end of Settings is padded by the tab bar clearance
// - Settings has no Sign out (it lives on Profile)
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest "apps/mobile/test/app/(tabs)/settings.test.tsx"
//
// SEE: apps/mobile/src/app/(tabs)/settings.tsx

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { dataFailureMessage, keyReadFailureMessage } from "@/utils/data-message";
import { offlineCardBody, retryingLabel } from "@/utils/load-failure";
import { hapticsFailureMessage } from "@/utils/haptics-setting";
import { appVersion } from "@/utils/app-version";
import { tabBarLayout } from "@/utils/tab-bar";
import { fakeSession, resetFakeAuth } from "../../helpers/fake-auth";
import { fakeData, profileWith, resetFakeData } from "../../helpers/fake-data";
import { fakeHapticsSetting } from "../../helpers/fake-haptics";
import { fakeKeys, resetFakeKeys } from "../../helpers/fake-keys";
import { renderAppAt } from "../../helpers/render-app";

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const completedAt = "2026-11-05T10:00:00Z";
const ada = profileWith({
  displayName: "Ada",
  provider: "claude",
  monthlyLimitUsd: 10,
  onboardingCompletedAt: completedAt,
});

function withSpend(spentUsd: number) {
  fakeData.getMonthSpend.mockResolvedValue({
    ok: true,
    value: { monthStart: "2026-11-01", spentUsd },
  });
}

describe("Settings", () => {
  beforeEach(() => {
    resetFakeAuth();
    resetFakeData();
    resetFakeKeys();
    fakeData.getProfile.mockResolvedValue({ ok: true, value: ada });
  });

  it("draws the loading state while the reads run", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fakeKeys.hasApiKey>>>();
    fakeKeys.hasApiKey.mockReturnValue(pending.promise);
    await renderAppAt("/settings", fakeSession());
    expect(screen.getByTestId("settings-loading")).toBeTruthy();
    await act(async () => pending.resolve({ ok: true, value: true }));
    expect(screen.queryByTestId("settings-loading")).toBeNull();
    expect(screen.getByRole("header", { name: "Settings" })).toBeTruthy();
  });

  it("draws $0.42 of $10.00, the bar and resets on Dec 1", async () => {
    withSpend(0.42);
    await renderAppAt("/settings", fakeSession());
    expect(screen.getByText("Spent this month")).toBeTruthy();
    expect(screen.getByText("$0.42")).toBeTruthy();
    expect(screen.getByText("of $10.00")).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId("spend-fill").props.style).width).toBe("4.2%");
    expect(screen.getByText("Counted by Fluency Lab · resets on Dec 1")).toBeTruthy();
  });

  it("draws $0.00 and No limit set with no limit", async () => {
    fakeData.getProfile.mockResolvedValue({
      ok: true,
      value: profileWith({ ...ada, monthlyLimitUsd: null }),
    });
    await renderAppAt("/settings", fakeSession());
    expect(screen.getByText("$0.00")).toBeTruthy();
    expect(screen.getByText("No limit set")).toBeTruthy();
    expect(screen.queryByTestId("spend-bar")).toBeNull();
  });

  it("draws the provider, the model and Saved on this device", async () => {
    fakeKeys.hasApiKey.mockResolvedValue({ ok: true, value: true });
    await renderAppAt("/settings", fakeSession());
    expect(screen.getByRole("header", { name: "Your AI" })).toBeTruthy();
    expect(screen.getByText("Claude")).toBeTruthy();
    expect(screen.getByText("Claude Haiku 5.5")).toBeTruthy();
    expect(screen.getByText("Saved on this device")).toBeTruthy();
  });

  it("draws Not set for a missing key", async () => {
    await renderAppAt("/settings", fakeSession());
    expect(screen.getByText("Not set")).toBeTruthy();
    expect(screen.queryByText("Saved on this device")).toBeNull();
  });

  it("draws the haptics switch on by default and the app version", async () => {
    await renderAppAt("/settings", fakeSession());
    expect(screen.getByRole("header", { name: "App" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Haptics" }).props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.getByText("Version")).toBeTruthy();
    expect(screen.getByText(appVersion())).toBeTruthy();
  });

  it("turns haptics off and saves off on the device", async () => {
    await renderAppAt("/settings", fakeSession());
    await fireEvent.press(screen.getByRole("switch", { name: "Haptics" }));
    expect(fakeHapticsSetting.save).toHaveBeenCalledWith(false);
    expect(screen.getByRole("switch", { name: "Haptics" }).props.accessibilityState).toMatchObject({
      checked: false,
    });
  });

  it("draws the haptics save failure and keeps the switch on", async () => {
    fakeHapticsSetting.save.mockResolvedValue({ ok: false, failure: "not_saved" });
    await renderAppAt("/settings", fakeSession());
    await fireEvent.press(screen.getByRole("switch", { name: "Haptics" }));
    expect(
      screen.getByText(hapticsFailureMessage({ kind: "ready", on: true, saveFailed: true }) ?? ""),
    ).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Haptics" }).props.accessibilityState).toMatchObject({
      checked: true,
    });
  });

  it("draws the haptics read failure with the switch off", async () => {
    fakeHapticsSetting.read.mockResolvedValue({ ok: false, failure: "not_read" });
    await renderAppAt("/settings", fakeSession());
    expect(screen.getByText(hapticsFailureMessage({ kind: "failed" }) ?? "")).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Haptics" }).props.accessibilityState).toMatchObject({
      checked: false,
    });
  });

  it("keeps the red failure and Try again when the read fails without the network", async () => {
    fakeData.getMonthSpend.mockResolvedValueOnce({ ok: false, failure: "unavailable" });
    await renderAppAt("/settings", fakeSession());
    expect(screen.getByText(dataFailureMessage("unavailable"))).toBeTruthy();
    expect(screen.queryByRole("header", { name: "Settings" })).toBeNull();
    expect(screen.queryByText("Can't load your settings")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("header", { name: "Settings" })).toBeTruthy();
    expect(screen.queryByText(dataFailureMessage("unavailable"))).toBeNull();
  });

  it("draws the can't-connect card under the header when the read fails on the network", async () => {
    fakeData.getMonthSpend.mockResolvedValueOnce({ ok: false, failure: "network" });
    await renderAppAt("/settings", fakeSession());
    expect(screen.getByRole("header", { name: "Settings" })).toBeTruthy();
    expect(screen.getByRole("header", { name: "Can't load your settings" })).toBeTruthy();
    expect(screen.getByText(offlineCardBody)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByText(dataFailureMessage("network"))).toBeNull();
  });

  it("shows Trying again\u2026 while Try again reads, then draws the settings when the server is back", async () => {
    let finish!: (value: Awaited<ReturnType<typeof fakeData.getMonthSpend>>) => void;
    fakeData.getMonthSpend.mockResolvedValueOnce({ ok: false, failure: "network" });
    await renderAppAt("/settings", fakeSession());
    fakeData.getMonthSpend.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(
      screen.getByRole("button", { name: "Try again", busy: true, disabled: true }),
    ).toBeTruthy();
    expect(screen.getByText(retryingLabel)).toBeTruthy();
    await act(async () => finish({ ok: true, value: { monthStart: "2026-11-01", spentUsd: 0 } }));
    expect(screen.queryByText(retryingLabel)).toBeNull();
    expect(screen.queryByRole("header", { name: "Can't load your settings" })).toBeNull();
    expect(screen.getByRole("link", { name: "Edit limit" })).toBeTruthy();
  });

  it("draws the key read failure", async () => {
    fakeKeys.hasApiKey.mockResolvedValue({ ok: false, failure: "not_read" });
    await renderAppAt("/settings", fakeSession());
    expect(screen.getByText(keyReadFailureMessage)).toBeTruthy();
  });

  it("opens the limit edit from Edit limit", async () => {
    await renderAppAt("/settings", fakeSession());
    await fireEvent.press(screen.getByRole("link", { name: "Edit limit" }));
    expect(screen).toHavePathname("/edit-profile");
    expect(screen).toHaveSearchParams({ field: "limit" });
  });

  it("opens the provider edit from Provider", async () => {
    await renderAppAt("/settings", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Provider" }));
    expect(screen).toHavePathname("/edit-profile");
    expect(screen).toHaveSearchParams({ field: "provider" });
  });

  it("opens the key step with the current provider and limit from API key", async () => {
    fakeData.getProfile.mockResolvedValue({
      ok: true,
      value: profileWith({ ...ada, provider: "openai", monthlyLimitUsd: 25 }),
    });
    fakeKeys.hasApiKey.mockResolvedValue({ ok: true, value: true });
    await renderAppAt("/settings", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "API key" }));
    expect(screen).toHavePathname("/api-key");
    expect(screen).toHaveSearchParams({ provider: "openai", limit: "25", removable: "1" });
  });

  it("has no Sign out", async () => {
    await renderAppAt("/settings", fakeSession());
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });

  it("pads the end by the tab bar clearance", async () => {
    await renderAppAt("/settings", fakeSession());
    const style = StyleSheet.flatten(
      screen.getByTestId("settings-content").props.contentContainerStyle,
    );
    expect(style.paddingBottom).toBe(tabBarLayout(0).clearance);
  });
});
