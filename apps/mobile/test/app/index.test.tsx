// apps/mobile/test/app/index.test.tsx
//
// Tests for the Home placeholder and the guard around it.
//
// Tested:
// - Signed out users cannot reach Home
// - Sign out returns to Login, and its failures show their message
// - The failure is drawn through FailureMessage, with its cause in development only
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/app/index.test.tsx
//
// SEE: apps/mobile/src/app/index.tsx

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { StyleSheet } from "react-native";

import { textStyle } from "@/components/text-style";
import { authFailureMessage } from "@/utils/auth-message";
import { emitSession, fakeAuth, fakeSession, resetFakeAuth } from "../helpers/fake-auth";
import { resetFakeData } from "../helpers/fake-data";
import { resetFakeKeys } from "../helpers/fake-keys";
import { renderApp } from "../helpers/render-app";
import { setDev } from "../helpers/set-dev";

const savedDev = __DEV__;
const networkCause = { name: "AuthRetryableFetchError", detail: "offline" };

jest.mock("expo-font", () => ({ useFonts: jest.fn(() => [true, null]) }));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hide: jest.fn(),
}));
jest.mock("@/data", () => ({
  data: jest.requireActual<typeof import("../helpers/fake-data")>("../helpers/fake-data").fakeData,
}));
jest.mock("@/keys", () => ({
  keys: jest.requireActual<typeof import("../helpers/fake-keys")>("../helpers/fake-keys").fakeKeys,
}));
jest.mock("@/auth", () => {
  const fake = jest.requireActual<typeof import("../helpers/fake-auth")>("../helpers/fake-auth");
  return { auth: fake.fakeAuth, apple: fake.fakeApple };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("Home placeholder", () => {
  beforeEach(() => {
    resetFakeAuth();
    resetFakeData();
    resetFakeKeys();
  });

  afterEach(() => {
    setDev(savedDev);
  });

  it("draws Home and the sign out button when signed in", async () => {
    await renderApp("/", fakeSession());
    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("lands on Login when signed out at Home", async () => {
    await renderApp("/", null);
    expect(screen).toHavePathname("/sign-in");
    expect(screen.queryByText("Home")).toBeNull();
  });

  it("does not show Home when pushed there while signed out", async () => {
    await renderApp("/sign-in", null);
    await act(async () => router.push("/"));
    expect(screen).toHavePathname("/sign-in");
    expect(screen.queryByText("Home")).toBeNull();
  });

  it("returns to Login after signing out", async () => {
    fakeAuth.signOut.mockImplementation(async () => {
      emitSession(null);
      return { ok: true, value: null };
    });
    await renderApp("/", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(screen).toHavePathname("/sign-in");
    expect(screen.queryByText("Home")).toBeNull();
  });

  it("shows the generic message and stays on Home", async () => {
    fakeAuth.signOut.mockResolvedValue({ ok: false, failure: "unknown" });
    await renderApp("/", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByText(authFailureMessage("unknown"))).toBeTruthy();
    expect(screen).toHavePathname("/");
  });

  it("shows the network message and stays on Home", async () => {
    fakeAuth.signOut.mockResolvedValue({ ok: false, failure: "network" });
    await renderApp("/", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByText(authFailureMessage("network"))).toBeTruthy();
    expect(screen).toHavePathname("/");
  });

  it("draws the sign out failure as an alert in the error style", async () => {
    fakeAuth.signOut.mockResolvedValue({ ok: false, failure: "network" });
    await renderApp("/", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    const node = screen.getByRole("alert");
    expect(screen.getByText(authFailureMessage("network"))).toBe(node);
    expect(StyleSheet.flatten(node.props.style)).toEqual(textStyle("error"));
  });

  it("draws the cause line under the sign out failure in development", async () => {
    fakeAuth.signOut.mockResolvedValue({ ok: false, failure: "network", cause: networkCause });
    await renderApp("/", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByText(authFailureMessage("network"))).toBeTruthy();
    expect(screen.getByText("AuthRetryableFetchError: offline")).toBeTruthy();
  });

  it("draws only the sign out message outside development", async () => {
    setDev(false);
    fakeAuth.signOut.mockResolvedValue({ ok: false, failure: "network", cause: networkCause });
    await renderApp("/", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByText(authFailureMessage("network"))).toBeTruthy();
    expect(screen.queryByText(/AuthRetryableFetchError/)).toBeNull();
  });

  it("shows the button busy and disabled while the request runs", async () => {
    const pending = deferred<{ ok: false; failure: "network" }>();
    fakeAuth.signOut.mockReturnValue(pending.promise);
    await renderApp("/", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    const busy = screen.getByRole("button", { name: "Sign out", busy: true, disabled: true });
    await fireEvent.press(busy);
    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve({ ok: false, failure: "network" }));
  });
});
