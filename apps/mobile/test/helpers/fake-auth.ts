// Test helper (not a test file): fakes of the auth port and the Apple port, so
// no test touches the library or the backend. Wire both with
// jest.mock("@/auth", () => ({ auth: fake.fakeAuth, apple: fake.fakeApple })),
// where fake is jest.requireActual of this file.

import { jest } from "@jest/globals";

import type { ApplePort, AuthPort, AuthSession } from "@/auth/auth-port";
import { generatedSecret } from "./generated-secret";

type Listener = (session: AuthSession | null) => void;

let listener: Listener | null = null;

export const fakeAuth = {
  signInWithEmail: jest.fn<AuthPort["signInWithEmail"]>(),
  signUpWithEmail: jest.fn<AuthPort["signUpWithEmail"]>(),
  requestPasswordReset: jest.fn<AuthPort["requestPasswordReset"]>(),
  confirmPasswordReset: jest.fn<AuthPort["confirmPasswordReset"]>(),
  signInWithApple: jest.fn<AuthPort["signInWithApple"]>(),
  saveName: jest.fn<AuthPort["saveName"]>(),
  signOut: jest.fn<AuthPort["signOut"]>(),
  currentSession: jest.fn<AuthPort["currentSession"]>(),
  onSessionChange: jest.fn<AuthPort["onSessionChange"]>(),
} satisfies AuthPort;

export const fakeApple = {
  isAvailable: jest.fn<ApplePort["isAvailable"]>(),
  requestCredential: jest.fn<ApplePort["requestCredential"]>(),
} satisfies ApplePort;

export function fakeSession(): AuthSession {
  return {
    accessToken: generatedSecret("token"),
    user: { id: "user-1", email: "name@email.com" },
  };
}

export function emitSession(session: AuthSession | null): void {
  if (listener === null) {
    throw new Error("no session listener is registered");
  }
  listener(session);
}

export function resetFakeAuth(): void {
  listener = null;
  for (const fn of Object.values(fakeAuth)) {
    fn.mockReset();
  }
  for (const fn of Object.values(fakeApple)) {
    fn.mockReset();
  }
  // INFO: the launch restore never settles by default, so tests keep driving the launch
  // with emitSession.
  fakeAuth.currentSession.mockReturnValue(new Promise(() => {}));
  fakeApple.isAvailable.mockResolvedValue({ ok: true, value: false });
  fakeAuth.onSessionChange.mockImplementation((next) => {
    listener = next;
    return () => {
      if (listener === next) listener = null;
    };
  });
}
