// apps/mobile/test/app/sign-in.test.tsx
//
// Tests for the Login screen.
//
// Tested:
// - The approved Login texts, placeholders and the place kept for providers
// - Validation, the request, its busy state and each failure message
// - The guard: signed in users skip Login
// - The links to Create account and to the password reset
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/app/sign-in.test.tsx
//
// SEE: apps/mobile/src/app/sign-in.tsx

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import { authFailureMessage } from "@/utils/auth-message";
import { emitSession, fakeAuth, fakeSession, resetFakeAuth } from "../helpers/fake-auth";
import { generatedSecret } from "../helpers/generated-secret";
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
const password = generatedSecret("password");

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function fill(values: { email: string; password: string }) {
  await fireEvent.changeText(screen.getByLabelText("Email"), values.email);
  await fireEvent.changeText(screen.getByLabelText("Password"), values.password);
}

describe("Login screen", () => {
  beforeEach(() => {
    resetFakeAuth();
  });

  it("draws every text of the approved Login", async () => {
    await renderApp("/", null);
    expect(screen).toHavePathname("/sign-in");
    expect(screen.getByText("Fluency Lab")).toBeTruthy();
    expect(screen.getByText("Welcome back")).toBeTruthy();
    expect(screen.getByText("Practice English by writing, at your own pace.")).toBeTruthy();
    expect(screen.getByText("Email")).toBeTruthy();
    expect(screen.getByText("Password")).toBeTruthy();
    expect(screen.getByText("Forgot password?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByText("or")).toBeTruthy();
    expect(screen.getByText(/New here\?/)).toBeTruthy();
    expect(screen.getByText("Create an account")).toBeTruthy();
  });

  it("draws the two placeholders", async () => {
    await renderApp("/sign-in", null);
    expect(screen.getByLabelText("Email").props.placeholder).toBe("name@email.com");
    expect(screen.getByLabelText("Password").props.placeholder).toBe("Your password");
    expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(true);
  });

  it("shows no Google or Apple button and keeps the place for the providers", async () => {
    await renderApp("/sign-in", null);
    expect(screen.queryByText(/google/i)).toBeNull();
    expect(screen.queryByText(/apple/i)).toBeNull();
    expect(screen.getByTestId("sign-in-providers")).toBeTruthy();
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
});
