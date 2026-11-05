// Test helper (not a test file): a fake of the auth port, so no test touches
// the library or the backend. Wire it with
// jest.mock("@/auth", () => ({ auth: jest.requireActual(...).fakeAuth })).

import { jest } from "@jest/globals";

import type { AuthPort, AuthSession } from "@/auth/auth-port";
import { generatedSecret } from "./generated-secret";

type Listener = (session: AuthSession | null) => void;

let listener: Listener | null = null;

export const fakeAuth = {
  signInWithEmail: jest.fn<AuthPort["signInWithEmail"]>(),
  signUpWithEmail: jest.fn<AuthPort["signUpWithEmail"]>(),
  requestPasswordReset: jest.fn<AuthPort["requestPasswordReset"]>(),
  confirmPasswordReset: jest.fn<AuthPort["confirmPasswordReset"]>(),
  signInWithApple: jest.fn<AuthPort["signInWithApple"]>(),
  signOut: jest.fn<AuthPort["signOut"]>(),
  currentSession: jest.fn<AuthPort["currentSession"]>(),
  onSessionChange: jest.fn<AuthPort["onSessionChange"]>(),
} satisfies AuthPort;

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
  fakeAuth.onSessionChange.mockImplementation((next) => {
    listener = next;
    return () => {
      if (listener === next) listener = null;
    };
  });
}
