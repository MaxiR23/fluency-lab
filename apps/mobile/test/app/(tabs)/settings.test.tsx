// apps/mobile/test/app/(tabs)/settings.test.tsx
//
// Tests for the Settings placeholder and Sign out.
//
// Tested:
// - Settings draws Sign out
// - The end of Settings is padded by the tab bar clearance
// - Sign out returns to Login, and its failures show their message
// - The failure is drawn through FailureMessage, with its cause in development only
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest "apps/mobile/test/app/(tabs)/settings.test.tsx"
//
// SEE: apps/mobile/src/app/(tabs)/settings.tsx

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { textStyle } from "@/components/text-style";
import { authFailureMessage } from "@/utils/auth-message";
import { tabBarLayout } from "@/utils/tab-bar";
import { emitSession, fakeAuth, fakeSession, resetFakeAuth } from "../../helpers/fake-auth";
import { resetFakeData } from "../../helpers/fake-data";
import { resetFakeKeys } from "../../helpers/fake-keys";
import { renderAppAt } from "../../helpers/render-app";
import { setDev } from "../../helpers/set-dev";

const savedDev = __DEV__;
const networkCause = { name: "AuthRetryableFetchError", detail: "offline" };

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

describe("Settings placeholder", () => {
  beforeEach(() => {
    resetFakeAuth();
    resetFakeData();
    resetFakeKeys();
  });

  afterEach(() => {
    setDev(savedDev);
  });

  it("pads the end of Settings by the tab bar clearance", async () => {
    await renderAppAt("/settings", fakeSession());
    const style = StyleSheet.flatten(screen.getByTestId("settings-content").props.style);
    expect(style.paddingBottom).toBe(tabBarLayout(0).clearance);
  });

  it("draws Settings with Sign out", async () => {
    await renderAppAt("/settings", fakeSession());
    expect(screen.getAllByText("Settings").length).toBeGreaterThan(0);
    expect(screen).toHavePathname("/settings");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("returns to Login after signing out", async () => {
    fakeAuth.signOut.mockImplementation(async () => {
      emitSession(null);
      return { ok: true, value: null };
    });
    await renderAppAt("/settings", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(screen).toHavePathname("/sign-in");
    expect(screen.queryByText("Home")).toBeNull();
  });

  it("shows the generic message and stays on Settings", async () => {
    fakeAuth.signOut.mockResolvedValue({ ok: false, failure: "unknown" });
    await renderAppAt("/settings", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByText(authFailureMessage("unknown"))).toBeTruthy();
    expect(screen).toHavePathname("/settings");
  });

  it("shows the network message and stays on Settings", async () => {
    fakeAuth.signOut.mockResolvedValue({ ok: false, failure: "network" });
    await renderAppAt("/settings", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByText(authFailureMessage("network"))).toBeTruthy();
    expect(screen).toHavePathname("/settings");
  });

  it("draws the sign out failure as an alert in the error style", async () => {
    fakeAuth.signOut.mockResolvedValue({ ok: false, failure: "network" });
    await renderAppAt("/settings", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    const node = screen.getByRole("alert");
    expect(screen.getByText(authFailureMessage("network"))).toBe(node);
    expect(StyleSheet.flatten(node.props.style)).toEqual(textStyle("error"));
  });

  it("draws the cause line under the sign out failure in development", async () => {
    fakeAuth.signOut.mockResolvedValue({ ok: false, failure: "network", cause: networkCause });
    await renderAppAt("/settings", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByText(authFailureMessage("network"))).toBeTruthy();
    expect(screen.getByText("AuthRetryableFetchError: offline")).toBeTruthy();
  });

  it("draws only the sign out message outside development", async () => {
    setDev(false);
    fakeAuth.signOut.mockResolvedValue({ ok: false, failure: "network", cause: networkCause });
    await renderAppAt("/settings", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByText(authFailureMessage("network"))).toBeTruthy();
    expect(screen.queryByText(/AuthRetryableFetchError/)).toBeNull();
  });

  it("shows the button busy and disabled while the request runs", async () => {
    const pending = deferred<{ ok: false; failure: "network" }>();
    fakeAuth.signOut.mockReturnValue(pending.promise);
    await renderAppAt("/settings", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    const busy = screen.getByRole("button", { name: "Sign out", busy: true, disabled: true });
    await fireEvent.press(busy);
    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve({ ok: false, failure: "network" }));
  });
});
