// apps/mobile/test/app/create-account.test.tsx
//
// Tests for the Create account screen.
//
// Tested:
// - Its texts and placeholders
// - Validation, the request, its busy state and each failure message
// - The expected empty outcome: no session yet, a confirmation message
// - The way back to Login
// - The development cause line under the failure
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/app/create-account.test.tsx
//
// SEE: apps/mobile/src/app/create-account.tsx

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";

import { authFailureMessage, signUpPendingMessage } from "@/utils/auth-message";
import { emitSession, fakeAuth, fakeSession, resetFakeAuth } from "../helpers/fake-auth";
import { generatedSecret } from "../helpers/generated-secret";
import { renderApp } from "../helpers/render-app";

jest.mock("expo-font", () => ({ useFonts: jest.fn(() => [true, null]) }));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hide: jest.fn(),
}));
jest.mock("@/auth", () => {
  const fake = jest.requireActual<typeof import("../helpers/fake-auth")>("../helpers/fake-auth");
  return { auth: fake.fakeAuth, apple: fake.fakeApple };
});

const email = "name@email.com";
const password = generatedSecret("password");

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function openForm() {
  await renderApp("/create-account", null);
}

async function submit(values: { email: string; password: string }) {
  await fireEvent.changeText(screen.getByLabelText("Email"), values.email);
  await fireEvent.changeText(screen.getByLabelText("Password"), values.password);
  await fireEvent.press(screen.getByRole("button", { name: "Create account" }));
}

const networkCause = {
  name: "AuthRetryableFetchError",
  detail: "fetch failed: The Internet connection appears to be offline.",
};
const causeLine =
  "AuthRetryableFetchError: fetch failed: The Internet connection appears to be offline.";

describe("Create account screen", () => {
  beforeEach(() => {
    resetFakeAuth();
  });

  it("draws its texts and placeholders", async () => {
    await openForm();
    expect(screen).toHavePathname("/create-account");
    expect(screen.getByText("Create your account")).toBeTruthy();
    expect(screen.getByText("Start practicing English by writing.")).toBeTruthy();
    expect(screen.getByLabelText("Password").props.placeholder).toBe("Choose a password");
    expect(screen.getByText("Already have an account?", { exact: false })).toBeTruthy();
  });

  it("shows the field errors and does not call the port when the form is empty", async () => {
    await openForm();
    await fireEvent.press(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByText("Enter your email.")).toBeTruthy();
    expect(screen.getByText("Enter your password.")).toBeTruthy();
    expect(fakeAuth.signUpWithEmail).not.toHaveBeenCalled();
  });

  it("moves to Home once the session arrives after creating the account", async () => {
    const session = fakeSession();
    fakeAuth.signUpWithEmail.mockResolvedValue({ ok: true, value: session });
    await openForm();
    await submit({ email: ` ${email} `, password });
    expect(fakeAuth.signUpWithEmail).toHaveBeenCalledWith({ email, password });
    await act(async () => emitSession(session));
    expect(screen).toHavePathname("/");
  });

  it("shows the confirmation message when no session was issued", async () => {
    fakeAuth.signUpWithEmail.mockResolvedValue({ ok: true, value: null });
    await openForm();
    await submit({ email, password });
    expect(screen.getByText(signUpPendingMessage)).toBeTruthy();
    expect(screen.queryByText(authFailureMessage("unknown"))).toBeNull();
    expect(screen).toHavePathname("/create-account");
  });

  it("shows the email taken message", async () => {
    fakeAuth.signUpWithEmail.mockResolvedValue({ ok: false, failure: "email_taken" });
    await openForm();
    await submit({ email, password });
    expect(screen.getByText(authFailureMessage("email_taken"))).toBeTruthy();
  });

  it("shows the weak password message", async () => {
    fakeAuth.signUpWithEmail.mockResolvedValue({ ok: false, failure: "weak_password" });
    await openForm();
    await submit({ email, password });
    expect(screen.getByText(authFailureMessage("weak_password"))).toBeTruthy();
  });

  it("shows the network message", async () => {
    fakeAuth.signUpWithEmail.mockResolvedValue({ ok: false, failure: "network" });
    await openForm();
    await submit({ email, password });
    expect(screen.getByText(authFailureMessage("network"))).toBeTruthy();
  });

  it("shows the generic message for an unknown failure", async () => {
    fakeAuth.signUpWithEmail.mockResolvedValue({ ok: false, failure: "unknown" });
    await openForm();
    await submit({ email, password });
    expect(screen.getByText(authFailureMessage("unknown"))).toBeTruthy();
  });

  it("shows the button busy and disabled while the request runs", async () => {
    const pending = deferred<{ ok: false; failure: "network" }>();
    fakeAuth.signUpWithEmail.mockReturnValue(pending.promise);
    await openForm();
    await submit({ email, password });
    const busy = screen.getByRole("button", { name: "Create account", busy: true, disabled: true });
    await fireEvent.press(busy);
    expect(fakeAuth.signUpWithEmail).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve({ ok: false, failure: "network" }));
  });

  it("disables the links while the request runs", async () => {
    fakeAuth.signUpWithEmail.mockReturnValue(new Promise(() => undefined));
    await openForm();
    await submit({ email, password });
    expect(screen.getByText("Sign in").props.onPress).toBeUndefined();
  });

  it("goes back to Login from the footer", async () => {
    await openForm();
    await fireEvent.press(screen.getByText("Sign in"));
    expect(screen).toHavePathname("/sign-in");
  });

  it("draws the cause line under the failure in development", async () => {
    fakeAuth.signUpWithEmail.mockResolvedValue({
      ok: false,
      failure: "network",
      cause: networkCause,
    });
    await openForm();
    await submit({ email, password });
    expect(screen.getByText(authFailureMessage("network"))).toBeTruthy();
    expect(screen.getByText(causeLine)).toBeTruthy();
  });
});
