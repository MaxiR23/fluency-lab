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
    listOpenSessions: vi.fn<UserStore["listOpenSessions"]>(),
    deleteSession: vi.fn<UserStore["deleteSession"]>(),
    createSession: vi.fn<UserStore["createSession"]>(),
    getSessionWithMessages: vi.fn<UserStore["getSessionWithMessages"]>(),
    addMessage: vi.fn<UserStore["addMessage"]>(),
    addSessionCost: vi.fn<UserStore["addSessionCost"]>(),
    endSession: vi.fn<UserStore["endSession"]>(),
    listSessionStarts: vi.fn<UserStore["listSessionStarts"]>(),
    listSessionCostsSince: vi.fn<UserStore["listSessionCostsSince"]>(),
    getStats: vi.fn<UserStore["getStats"]>(),
    deleteAccount: vi.fn<UserStore["deleteAccount"]>(),
  };
  const store: Store = {
    forUser(caller) {
      callers.push(caller);
      return user;
    },
  };
  return { store, user, callers };
}
