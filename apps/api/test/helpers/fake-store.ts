// Test helper (not a test file): a fake of the Store port. Each method is a
// vi.fn the test programs, and the callers passed to forUser are recorded.

import { vi } from "vitest";
import type { Caller, Store, UserStore } from "../../src/store";

export function createFakeStore() {
  const callers: Caller[] = [];
  const user = {
    getProfile: vi.fn<UserStore["getProfile"]>(),
    updateProfile: vi.fn<UserStore["updateProfile"]>(),
    getActiveSession: vi.fn<UserStore["getActiveSession"]>(),
    createSession: vi.fn<UserStore["createSession"]>(),
    listMessages: vi.fn<UserStore["listMessages"]>(),
  };
  const store: Store = {
    forUser(caller) {
      callers.push(caller);
      return user;
    },
  };
  return { store, user, callers };
}
