// apps/mobile/test/app/sign-in.test.tsx
//
// Tests for the Login screen.
//
// Tested:
// - The approved Login texts and placeholders
// - The Apple button, its divider, and when both are hidden
// - Apple sign in: success, cancel, each failure, and the name that failed to save
// - Both sign in paths disable each other while one runs
// - Validation, the request, its busy state and each failure message
// - The guard: signed in users skip Login
// - The links to Create account and to the password reset
// - The development cause line under the email, the Apple and the name failure, with the Apple error code, and none outside development
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/app/sign-in.test.tsx
//
// SEE: apps/mobile/src/app/sign-in.tsx

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { Platform } from "react-native";

import type { FailureCause } from "@/auth/auth-port";
import { appleNameFailureMessage, authFailureMessage } from "@/utils/auth-message";
import { emitSession, fakeApple, fakeAuth, fakeSession, resetFakeAuth } from "../helpers/fake-auth";
import { generatedSecret } from "../helpers/generated-secret";
import { resetFakeData } from "../helpers/fake-data";
import { resetFakeKeys } from "../helpers/fake-keys";
import { renderApp } from "../helpers/render-app";
import { setDev } from "../helpers/set-dev";

const savedDev = __DEV__;

jest.mock("expo-font", () => ({ useFonts: jest.fn(() => [true, null]) }));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hide: jest.fn(),
}));
jest.mock("expo-apple-authentication", () => ({
  AppleAuthenticationButton:
    jest.requireActual<typeof import("react-native")>("react-native").Pressable,
  AppleAuthenticationButtonType: { CONTINUE: 1 },
  AppleAuthenticationButtonStyle: { WHITE: 0 },
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

const email = "name@email.com";
const password = generatedSecret("password");

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const appleCredential = {
  ok: true,
  value: {
    idToken: generatedSecret("id-token"),
    rawNonce: generatedSecret("nonce"),
    fullName: { givenName: "Ada", familyName: "Lovelace" },
  },
} as const;

function appleAvailable() {
  fakeApple.isAvailable.mockResolvedValue({ ok: true, value: true });
}

async function pressApple() {
  await fireEvent.press(await screen.findByTestId("apple-button"));
}

async function startNameFailure(cause?: FailureCause) {
  appleAvailable();
  fakeApple.requestCredential.mockResolvedValue(appleCredential);
  fakeAuth.signInWithApple.mockResolvedValue({ ok: true, value: fakeSession() });
  fakeAuth.saveName.mockResolvedValue({ ok: false, failure: "network", cause });
  await renderApp("/sign-in", null);
  await pressApple();
  await act(async () => emitSession(fakeSession()));
}

async function fill(values: { email: string; password: string }) {
  await fireEvent.changeText(screen.getByLabelText("Email"), values.email);
  await fireEvent.changeText(screen.getByLabelText("Password"), values.password);
}

const networkCause = {
  name: "AuthRetryableFetchError",
  detail: "fetch failed: The Internet connection appears to be offline.",
};
const causeLine =
  "AuthRetryableFetchError: fetch failed: The Internet connection appears to be offline.";

describe("Login screen", () => {
  beforeEach(() => {
    resetFakeAuth();
    resetFakeData();
    resetFakeKeys();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    setDev(savedDev);
  });

  it("draws every text of the approved Login", async () => {
    appleAvailable();
    await renderApp("/", null);
    expect(screen).toHavePathname("/sign-in");
    expect(screen.getByText("Fluency Lab")).toBeTruthy();
    expect(screen.getByText("Welcome back")).toBeTruthy();
    expect(screen.getByText("Practice English by writing, at your own pace.")).toBeTruthy();
    expect(screen.getByText("Email")).toBeTruthy();
    expect(screen.getByText("Password")).toBeTruthy();
    expect(screen.getByText("Forgot password?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(await screen.findByText("or")).toBeTruthy();
    expect(screen.getByText(/New here\?/)).toBeTruthy();
    expect(screen.getByText("Create an account")).toBeTruthy();
  });

  it("draws the two placeholders", async () => {
    await renderApp("/sign-in", null);
    expect(screen.getByLabelText("Email").props.placeholder).toBe("name@email.com");
    expect(screen.getByLabelText("Password").props.placeholder).toBe("Your password");
    expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(true);
  });

  it("shows the Apple button under the divider when Apple is available", async () => {
    appleAvailable();
    await renderApp("/sign-in", null);
    expect(await screen.findByTestId("apple-button")).toBeTruthy();
    expect(screen.getByText("or")).toBeTruthy();
    expect(screen.getByTestId("sign-in-providers")).toBeTruthy();
    expect(screen.queryByText(/google/i)).toBeNull();
  });

  it("hides the divider and the providers when Apple is not available", async () => {
    await renderApp("/sign-in", null);
    expect(screen.queryByText("or")).toBeNull();
    expect(screen.queryByTestId("apple-button")).toBeNull();
    expect(screen.queryByTestId("sign-in-providers")).toBeNull();
    expect(screen.queryByText(/google/i)).toBeNull();
  });

  it("hides the divider and the providers when the availability check fails", async () => {
    fakeApple.isAvailable.mockResolvedValue({ ok: false, failure: "apple_request_failed" });
    await renderApp("/sign-in", null);
    expect(screen.queryByText("or")).toBeNull();
    expect(screen.queryByTestId("apple-button")).toBeNull();
    expect(screen.getByText("Welcome back")).toBeTruthy();
  });

  it("does not show the Apple button on Android even when the check says available", async () => {
    jest.replaceProperty(Platform, "OS", "android");
    appleAvailable();
    await renderApp("/sign-in", null);
    expect(screen.queryByTestId("apple-button")).toBeNull();
    expect(screen.queryByText("or")).toBeNull();
  });

  it("moves to Home after an Apple sign-in, once the session arrives", async () => {
    appleAvailable();
    fakeApple.requestCredential.mockResolvedValue(appleCredential);
    fakeAuth.signInWithApple.mockResolvedValue({ ok: true, value: fakeSession() });
    fakeAuth.saveName.mockResolvedValue({ ok: true, value: null });
    await renderApp("/sign-in", null);
    await pressApple();
    await act(async () => emitSession(fakeSession()));
    expect(screen).toHavePathname("/");
    expect(screen.queryByText("Welcome back")).toBeNull();
  });

  it("stays on Login with no message when the user cancels", async () => {
    appleAvailable();
    fakeApple.requestCredential.mockResolvedValue({ ok: false, failure: "canceled" });
    await renderApp("/sign-in", null);
    await pressApple();
    expect(screen).toHavePathname("/sign-in");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("Error")).toBeNull();
    expect(fakeAuth.signInWithApple).not.toHaveBeenCalled();
  });

  it("draws the cause line under the Apple failure in development", async () => {
    appleAvailable();
    fakeApple.requestCredential.mockResolvedValue(appleCredential);
    fakeAuth.signInWithApple.mockResolvedValue({
      ok: false,
      failure: "network",
      cause: networkCause,
    });
    await renderApp("/sign-in", null);
    await pressApple();
    expect(screen.getByText(authFailureMessage("network"))).toBeTruthy();
    expect(screen.getByText(causeLine)).toBeTruthy();
  });

  it("draws the cause line of an Apple library failure in development", async () => {
    appleAvailable();
    fakeApple.requestCredential.mockResolvedValue({
      ok: false,
      failure: "apple_request_failed",
      cause: { name: "Error", detail: null },
    });
    await renderApp("/sign-in", null);
    await pressApple();
    expect(screen.getByText(authFailureMessage("apple_request_failed"))).toBeTruthy();
    expect(screen.getByText("Error")).toBeTruthy();
  });

  it("draws only the Apple failure message outside development", async () => {
    setDev(false);
    appleAvailable();
    fakeApple.requestCredential.mockResolvedValue(appleCredential);
    fakeAuth.signInWithApple.mockResolvedValue({
      ok: false,
      failure: "network",
      cause: networkCause,
    });
    await renderApp("/sign-in", null);
    await pressApple();
    expect(screen.getByText(authFailureMessage("network"))).toBeTruthy();
    expect(screen.queryByText(/AuthRetryableFetchError/)).toBeNull();
  });

  it("shows the Apple failure message and stays on Login", async () => {
    appleAvailable();
    fakeApple.requestCredential.mockResolvedValue({ ok: false, failure: "apple_request_failed" });
    await renderApp("/sign-in", null);
    await pressApple();
    expect(screen.getByText(authFailureMessage("apple_request_failed"))).toBeTruthy();
    expect(screen).toHavePathname("/sign-in");
  });

  it("shows the network message when the Apple sign-in cannot reach the server", async () => {
    appleAvailable();
    fakeApple.requestCredential.mockResolvedValue(appleCredential);
    fakeAuth.signInWithApple.mockResolvedValue({ ok: false, failure: "network" });
    await renderApp("/sign-in", null);
    await pressApple();
    expect(screen.getByText(authFailureMessage("network"))).toBeTruthy();
    expect(screen).toHavePathname("/sign-in");
  });

  it("shows the generic message when the Apple sign-in fails for an unknown reason", async () => {
    appleAvailable();
    fakeApple.requestCredential.mockResolvedValue(appleCredential);
    fakeAuth.signInWithApple.mockResolvedValue({ ok: false, failure: "unknown" });
    await renderApp("/sign-in", null);
    await pressApple();
    expect(screen.getByText(authFailureMessage("unknown"))).toBeTruthy();
  });

  it("stays on Login until the name is saved, then moves to Home", async () => {
    const saving = deferred<{ ok: true; value: null }>();
    appleAvailable();
    fakeApple.requestCredential.mockResolvedValue(appleCredential);
    fakeAuth.signInWithApple.mockResolvedValue({ ok: true, value: fakeSession() });
    fakeAuth.saveName.mockReturnValue(saving.promise);
    await renderApp("/sign-in", null);
    await pressApple();
    await act(async () => emitSession(fakeSession()));
    expect(screen).toHavePathname("/sign-in");
    await act(async () => saving.resolve({ ok: true, value: null }));
    expect(screen).toHavePathname("/");
  });

  it("saves no name when Apple sends none", async () => {
    appleAvailable();
    fakeApple.requestCredential.mockResolvedValue({
      ok: true,
      value: { ...appleCredential.value, fullName: null },
    });
    fakeAuth.signInWithApple.mockResolvedValue({ ok: true, value: fakeSession() });
    await renderApp("/sign-in", null);
    await pressApple();
    expect(fakeAuth.signInWithApple).toHaveBeenCalledTimes(1);
    expect(fakeAuth.saveName).not.toHaveBeenCalled();
  });

  it("shows the name message, Try again and Continue when the name cannot be saved", async () => {
    await startNameFailure();
    expect(screen).toHavePathname("/sign-in");
    expect(screen.getByText(appleNameFailureMessage("network"))).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
    expect(screen.queryByLabelText("Email")).toBeNull();
  });

  it("saves the name and moves to Home when Try again succeeds", async () => {
    await startNameFailure();
    fakeAuth.saveName.mockResolvedValue({ ok: true, value: null });
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(fakeAuth.saveName).toHaveBeenLastCalledWith({
      fullName: "Ada Lovelace",
      givenName: "Ada",
      familyName: "Lovelace",
    });
    expect(screen).toHavePathname("/");
  });

  it("keeps the message when Try again fails", async () => {
    await startNameFailure();
    fakeAuth.saveName.mockResolvedValue({ ok: false, failure: "unknown" });
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText(appleNameFailureMessage("unknown"))).toBeTruthy();
    expect(screen).toHavePathname("/sign-in");
  });

  it("draws the cause line under the name failure in development", async () => {
    await startNameFailure(networkCause);
    expect(screen.getByText(appleNameFailureMessage("network"))).toBeTruthy();
    expect(screen.getByText(causeLine)).toBeTruthy();
  });

  it("draws the cause of the failed Try again under the name failure", async () => {
    await startNameFailure();
    fakeAuth.saveName.mockResolvedValue({
      ok: false,
      failure: "unknown",
      cause: { name: "AuthApiError", detail: null },
    });
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText(appleNameFailureMessage("unknown"))).toBeTruthy();
    expect(screen.getByText("AuthApiError")).toBeTruthy();
  });

  it("draws only the name failure message outside development", async () => {
    setDev(false);
    await startNameFailure(networkCause);
    expect(screen.getByText(appleNameFailureMessage("network"))).toBeTruthy();
    expect(screen.queryByText(/AuthRetryableFetchError/)).toBeNull();
  });

  it("draws the name failure as one alert", async () => {
    await startNameFailure();
    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(1);
    expect(screen.getByText(appleNameFailureMessage("network"))).toBeTruthy();
  });

  it("draws the Apple library error code in the cause line in development", async () => {
    appleAvailable();
    fakeApple.requestCredential.mockResolvedValue({
      ok: false,
      failure: "apple_request_failed",
      cause: { name: "Error", detail: null, code: "ERR_REQUEST_FAILED" },
    });
    await renderApp("/sign-in", null);
    await pressApple();
    expect(screen.getByText("Error (ERR_REQUEST_FAILED)")).toBeTruthy();
  });

  it("draws no Apple error code outside development", async () => {
    setDev(false);
    appleAvailable();
    fakeApple.requestCredential.mockResolvedValue({
      ok: false,
      failure: "apple_request_failed",
      cause: { name: "Error", detail: null, code: "ERR_REQUEST_FAILED" },
    });
    await renderApp("/sign-in", null);
    await pressApple();
    expect(screen.getByText(authFailureMessage("apple_request_failed"))).toBeTruthy();
    expect(screen.queryByText(/ERR_REQUEST_FAILED/)).toBeNull();
  });

  it("moves to Home without the name on Continue", async () => {
    await startNameFailure();
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    expect(screen).toHavePathname("/");
  });

  it("disables the email button and the links while the Apple sign-in runs", async () => {
    appleAvailable();
    fakeApple.requestCredential.mockReturnValue(new Promise(() => undefined));
    await renderApp("/sign-in", null);
    await pressApple();
    expect(screen.getByRole("button", { name: "Sign in", disabled: true })).toBeTruthy();
    expect(screen.getByText("Forgot password?").props.onPress).toBeUndefined();
    expect(screen.getByText("Create an account").props.onPress).toBeUndefined();
  });

  it("ignores the Apple button while the email sign-in runs", async () => {
    appleAvailable();
    fakeAuth.signInWithEmail.mockReturnValue(new Promise(() => undefined));
    await renderApp("/sign-in", null);
    await screen.findByTestId("apple-button");
    await fill({ email, password });
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    await pressApple();
    expect(fakeApple.requestCredential).not.toHaveBeenCalled();
  });

  it("shows the field errors and does not call the port when the form is empty", async () => {
    await renderApp("/sign-in", null);
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByText("Enter your email.")).toBeTruthy();
    expect(screen.getByText("Enter your password.")).toBeTruthy();
    expect(fakeAuth.signInWithEmail).not.toHaveBeenCalled();
  });

  it("sends the trimmed email and the password", async () => {
    fakeAuth.signInWithEmail.mockResolvedValue({ ok: false, failure: "unknown" });
    await renderApp("/sign-in", null);
    await fill({ email: ` ${email} `, password });
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(fakeAuth.signInWithEmail).toHaveBeenCalledWith({ email, password });
  });

  it("moves to Home once the session arrives after signing in", async () => {
    const session = fakeSession();
    fakeAuth.signInWithEmail.mockResolvedValue({ ok: true, value: session });
    await renderApp("/sign-in", null);
    await fill({ email, password });
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    await act(async () => emitSession(session));
    expect(screen).toHavePathname("/");
    expect(screen.queryByText("Welcome back")).toBeNull();
  });

  it("shows the invalid credentials message", async () => {
    fakeAuth.signInWithEmail.mockResolvedValue({ ok: false, failure: "invalid_credentials" });
    await renderApp("/sign-in", null);
    await fill({ email, password });
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByText(authFailureMessage("invalid_credentials"))).toBeTruthy();
    expect(screen).toHavePathname("/sign-in");
  });

  it("shows the network message and stays on Login", async () => {
    fakeAuth.signInWithEmail.mockResolvedValue({ ok: false, failure: "network" });
    await renderApp("/sign-in", null);
    await fill({ email, password });
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByText(authFailureMessage("network"))).toBeTruthy();
    expect(screen).toHavePathname("/sign-in");
  });

  it("shows the generic message for an unknown failure", async () => {
    fakeAuth.signInWithEmail.mockResolvedValue({ ok: false, failure: "unknown" });
    await renderApp("/sign-in", null);
    await fill({ email, password });
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByText(authFailureMessage("unknown"))).toBeTruthy();
  });

  it("shows the button busy and disabled while the request runs", async () => {
    const pending = deferred<{ ok: false; failure: "network" }>();
    fakeAuth.signInWithEmail.mockReturnValue(pending.promise);
    await renderApp("/sign-in", null);
    await fill({ email, password });
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    const busy = screen.getByRole("button", { name: "Sign in", busy: true, disabled: true });
    await fireEvent.press(busy);
    expect(fakeAuth.signInWithEmail).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve({ ok: false, failure: "network" }));
    expect(screen.getByRole("button", { name: "Sign in" }).props.accessibilityState.busy).not.toBe(
      true,
    );
  });

  it("disables the links while the request runs", async () => {
    fakeAuth.signInWithEmail.mockReturnValue(new Promise(() => undefined));
    await renderApp("/sign-in", null);
    await fill({ email, password });
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByText("Forgot password?").props.onPress).toBeUndefined();
    expect(screen.getByText("Create an account").props.onPress).toBeUndefined();
  });

  it("skips Login when already signed in at launch", async () => {
    await renderApp("/sign-in", fakeSession());
    expect(screen).toHavePathname("/");
    expect(screen.queryByText("Welcome back")).toBeNull();
  });

  it("does not show Login when pushed there while signed in", async () => {
    await renderApp("/", fakeSession());
    await act(async () => router.push("/sign-in"));
    expect(screen).toHavePathname("/");
    expect(screen.queryByText("Welcome back")).toBeNull();
  });

  it("opens Create account from the footer", async () => {
    await renderApp("/sign-in", null);
    await fireEvent.press(screen.getByText("Create an account"));
    expect(screen).toHavePathname("/create-account");
  });

  it("opens the request screen from Forgot password", async () => {
    await renderApp("/sign-in", null);
    await fireEvent.press(screen.getByText("Forgot password?"));
    expect(screen).toHavePathname("/forgot-password");
  });

  it("draws the cause line under the failure in development", async () => {
    fakeAuth.signInWithEmail.mockResolvedValue({
      ok: false,
      failure: "network",
      cause: networkCause,
    });
    await renderApp("/sign-in", null);
    await fill({ email, password });
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByText(authFailureMessage("network"))).toBeTruthy();
    expect(screen.getByText(causeLine)).toBeTruthy();
  });

  it("draws only the message when the failure has no cause", async () => {
    fakeAuth.signInWithEmail.mockResolvedValue({ ok: false, failure: "network" });
    await renderApp("/sign-in", null);
    await fill({ email, password });
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByText(authFailureMessage("network"))).toBeTruthy();
    expect(screen.queryByText(/AuthRetryableFetchError/)).toBeNull();
  });
});
