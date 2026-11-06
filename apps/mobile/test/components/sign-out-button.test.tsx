// apps/mobile/test/components/sign-out-button.test.tsx
//
// Tests for the shared SignOutButton component.
//
// Tested:
// - It signs out through the auth port
// - It shows busy and disabled while the request runs
// - A failure draws its message through FailureMessage, with the cause in development only
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/sign-out-button.test.tsx
//
// SEE: apps/mobile/src/components/sign-out-button.tsx

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { SignOutButton } from "@/components/sign-out-button";
import { textStyle } from "@/components/text-style";
import { authFailureMessage } from "@/utils/auth-message";
import { fakeAuth, resetFakeAuth } from "../helpers/fake-auth";
import { setDev } from "../helpers/set-dev";

jest.mock("@/auth", () => {
  const fake = jest.requireActual<typeof import("../helpers/fake-auth")>("../helpers/fake-auth");
  return { auth: fake.fakeAuth, apple: fake.fakeApple };
});

const savedDev = __DEV__;
const networkCause = { name: "AuthRetryableFetchError", detail: "offline" };

describe("SignOutButton", () => {
  beforeEach(() => {
    resetFakeAuth();
  });

  afterEach(() => {
    setDev(savedDev);
  });

  it("signs out through the auth port and shows no failure on success", async () => {
    fakeAuth.signOut.mockResolvedValue({ ok: true, value: null });
    await render(<SignOutButton />);
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("draws the failure message as an alert in the error style", async () => {
    fakeAuth.signOut.mockResolvedValue({ ok: false, failure: "network" });
    await render(<SignOutButton />);
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    const node = screen.getByRole("alert");
    expect(screen.getByText(authFailureMessage("network"))).toBe(node);
    expect(StyleSheet.flatten(node.props.style)).toEqual(textStyle("error"));
  });

  it("draws the cause line under the failure in development", async () => {
    fakeAuth.signOut.mockResolvedValue({ ok: false, failure: "network", cause: networkCause });
    await render(<SignOutButton />);
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByText(authFailureMessage("network"))).toBeTruthy();
    expect(screen.getByText("AuthRetryableFetchError: offline")).toBeTruthy();
  });

  it("draws only the failure message outside development", async () => {
    setDev(false);
    fakeAuth.signOut.mockResolvedValue({ ok: false, failure: "network", cause: networkCause });
    await render(<SignOutButton />);
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByText(authFailureMessage("network"))).toBeTruthy();
    expect(screen.queryByText(/AuthRetryableFetchError/)).toBeNull();
  });

  it("clears the previous failure when pressed again", async () => {
    fakeAuth.signOut.mockResolvedValueOnce({ ok: false, failure: "network" });
    fakeAuth.signOut.mockResolvedValueOnce({ ok: true, value: null });
    await render(<SignOutButton />);
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByRole("alert")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the button busy and disabled while the request runs", async () => {
    let resolve: (value: { ok: false; failure: "network" }) => void = () => undefined;
    const pending = new Promise<{ ok: false; failure: "network" }>((r) => {
      resolve = r;
    });
    fakeAuth.signOut.mockReturnValue(pending);
    await render(<SignOutButton />);
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    const busy = screen.getByRole("button", { name: "Sign out", busy: true, disabled: true });
    await fireEvent.press(busy);
    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ ok: false, failure: "network" }));
  });
});
