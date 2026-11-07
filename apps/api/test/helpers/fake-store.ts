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
    getThread: vi.fn<UserStore["getThread"]>(),
    addThreadMessage: vi.fn<UserStore["addThreadMessage"]>(),
    withdrawCorrections: vi.fn<UserStore["withdrawCorrections"]>(),
    listThreadCounts: vi.fn<UserStore["listThreadCounts"]>(),
    listPracticeRunsSince: vi.fn<UserStore["listPracticeRunsSince"]>(),
    createPracticeRun: vi.fn<UserStore["createPracticeRun"]>(),
    getPracticeRun: vi.fn<UserStore["getPracticeRun"]>(),
    addPracticeItems: vi.fn<UserStore["addPracticeItems"]>(),
    answerPracticeItem: vi.fn<UserStore["answerPracticeItem"]>(),
    addPracticeCost: vi.fn<UserStore["addPracticeCost"]>(),
    setPracticeTarget: vi.fn<UserStore["setPracticeTarget"]>(),
    finishPracticeRun: vi.fn<UserStore["finishPracticeRun"]>(),
    createNote: vi.fn<UserStore["createNote"]>(),
    getNote: vi.fn<UserStore["getNote"]>(),
    deleteNote: vi.fn<UserStore["deleteNote"]>(),
    listNotes: vi.fn<UserStore["listNotes"]>(),
    listSessionNotes: vi.fn<UserStore["listSessionNotes"]>(),
    addSessionCost: vi.fn<UserStore["addSessionCost"]>(),
    endSession: vi.fn<UserStore["endSession"]>(),
    listSessionStarts: vi.fn<UserStore["listSessionStarts"]>(),
    listSessionCostsSince: vi.fn<UserStore["listSessionCostsSince"]>(),
    getStats: vi.fn<UserStore["getStats"]>(),
    getMonthProgress: vi.fn<UserStore["getMonthProgress"]>(),
    listEndedSessions: vi.fn<UserStore["listEndedSessions"]>(),
    listMistakeGroups: vi.fn<UserStore["listMistakeGroups"]>(),
    listNewWords: vi.fn<UserStore["listNewWords"]>(),
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
