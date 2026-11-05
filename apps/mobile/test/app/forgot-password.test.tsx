// apps/mobile/test/app/forgot-password.test.tsx
//
// Tests for the first step of the password reset: asking for the code.
//
// Tested:
// - Its texts, and the email prefilled from the route
// - Validation, the request, its busy state and each failure message
// - On success, the code screen opens with the trimmed email
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/app/forgot-password.test.tsx
//
// SEE: apps/mobile/src/app/forgot-password.tsx

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";

import { authFailureMessage } from "@/utils/auth-message";
import { fakeAuth, resetFakeAuth } from "../helpers/fake-auth";
import { renderApp } from "../helpers/render-app";

jest.mock("expo-font", () => ({ useFonts: jest.fn(() => [true, null]) }));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hide: jest.fn(),
}));
jest.mock("@/auth", () => ({
  auth: jest.requireActual<typeof import("../helpers/fake-auth")>("../helpers/fake-auth").fakeAuth,
}));

const email = "name@email.com";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function send(value: string) {
  await fireEvent.changeText(screen.getByLabelText("Email"), value);
  await fireEvent.press(screen.getByRole("button", { name: "Send code" }));
}

describe("Forgot password screen", () => {
  beforeEach(() => {
    resetFakeAuth();
  });

  it("draws its texts", async () => {
    await renderApp("/forgot-password", null);
    expect(screen.getByText("Reset your password")).toBeTruthy();
    expect(screen.getByText("We will email you a code.")).toBeTruthy();
    expect(screen.getByLabelText("Email").props.value).toBe("");
    expect(screen.getByText("Remembered it?", { exact: false })).toBeTruthy();
  });

  it("prefills the email from the route", async () => {
    await renderApp("/forgot-password?email=name%40email.com", null);
    expect(screen.getByLabelText("Email").props.value).toBe(email);
  });

  it("shows the field errors and does not call the port when the form is empty", async () => {
    await renderApp("/forgot-password", null);
    await fireEvent.press(screen.getByRole("button", { name: "Send code" }));
    expect(screen.getByText("Enter your email.")).toBeTruthy();
    expect(fakeAuth.requestPasswordReset).not.toHaveBeenCalled();
  });

  it("goes to the code screen with the trimmed email", async () => {
    fakeAuth.requestPasswordReset.mockResolvedValue({ ok: true, value: null });
    await renderApp("/forgot-password", null);
    await send(` ${email} `);
    expect(fakeAuth.requestPasswordReset).toHaveBeenCalledWith(email);
    expect(screen).toHavePathname("/reset-password");
    expect(screen).toHaveSearchParams({ email });
  });

  it("shows the generic message for an unknown failure such as the rate limit", async () => {
    fakeAuth.requestPasswordReset.mockResolvedValue({ ok: false, failure: "unknown" });
    await renderApp("/forgot-password", null);
    await send(email);
    expect(screen.getByText(authFailureMessage("unknown"))).toBeTruthy();
    expect(screen).toHavePathname("/forgot-password");
  });

  it("shows the network message", async () => {
    fakeAuth.requestPasswordReset.mockResolvedValue({ ok: false, failure: "network" });
    await renderApp("/forgot-password", null);
    await send(email);
    expect(screen.getByText(authFailureMessage("network"))).toBeTruthy();
  });

  it("shows the button busy and disabled while the request runs", async () => {
    const pending = deferred<{ ok: false; failure: "network" }>();
    fakeAuth.requestPasswordReset.mockReturnValue(pending.promise);
    await renderApp("/forgot-password", null);
    await send(email);
    const busy = screen.getByRole("button", { name: "Send code", busy: true, disabled: true });
    await fireEvent.press(busy);
    expect(fakeAuth.requestPasswordReset).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve({ ok: false, failure: "network" }));
  });

  it("disables the links while the request runs", async () => {
    fakeAuth.requestPasswordReset.mockReturnValue(new Promise(() => undefined));
    await renderApp("/forgot-password", null);
    await send(email);
    expect(screen.getByText("Sign in").props.onPress).toBeUndefined();
  });

  it("goes to Login from the footer", async () => {
    await renderApp("/forgot-password", null);
    await fireEvent.press(screen.getByText("Sign in"));
    expect(screen).toHavePathname("/sign-in");
  });
});
