// Test helper (not a test file): a fake of the data port, so no test builds a
// URL or reaches the backend. Wire it with
// jest.mock("@/data", () => ({ data: fake.fakeData })), where fake is
// jest.requireActual of this file. Call resetFakeData() in beforeEach: it makes
// getProfile answer with a completed profile, listOpenSessions with no open
// session and getSessionWeek with an empty week (Home reads all three), and
// getMonthSpend with 0 spent (Chat reads it), getProfileStats with zeros (Profile reads it)
// deleteAccount with success, so a signed in user lands on Home, and getSessionSummary with an
// empty ended session (Summary reads it).

import { jest } from "@jest/globals";
import type {
  ActiveSession,
  Message,
  Profile,
  Session,
  SessionSummary,
  SessionWeek,
} from "@fluency-lab/shared";

import type { DataPort } from "@/data/data-port";

export const fakeData = {
  getProfile: jest.fn<DataPort["getProfile"]>(),
  updateProfile: jest.fn<DataPort["updateProfile"]>(),
  getActiveSession: jest.fn<DataPort["getActiveSession"]>(),
  listOpenSessions: jest.fn<DataPort["listOpenSessions"]>(),
  deleteSession: jest.fn<DataPort["deleteSession"]>(),
  createSession: jest.fn<DataPort["createSession"]>(),
  openSession: jest.fn<DataPort["openSession"]>(),
  addMessage: jest.fn<DataPort["addMessage"]>(),
  addUsage: jest.fn<DataPort["addUsage"]>(),
  endSession: jest.fn<DataPort["endSession"]>(),
  getMonthSpend: jest.fn<DataPort["getMonthSpend"]>(),
  getSessionWeek: jest.fn<DataPort["getSessionWeek"]>(),
  getProfileStats: jest.fn<DataPort["getProfileStats"]>(),
  getSessionSummary: jest.fn<DataPort["getSessionSummary"]>(),
  deleteAccount: jest.fn<DataPort["deleteAccount"]>(),
} satisfies DataPort;

export function profileWith(overrides: Partial<Profile>): Profile {
  return {
    id: "user-1",
    displayName: null,
    level: null,
    goals: [],
    topics: [],
    provider: null,
    monthlyLimitUsd: null,
    onboardingCompletedAt: null,
    createdAt: "2026-11-05T09:00:00Z",
    updatedAt: "2026-11-05T09:00:00Z",
    ...overrides,
  };
}

export function completedProfile(): Profile {
  return profileWith({ onboardingCompletedAt: "2026-11-05T10:00:00Z" });
}

// INFO: lastMessage is overridden by default; pass null for a session with no message.
export function activeSessionWith(
  session: Partial<Session>,
  lastMessage: Partial<Message> | null = {},
): ActiveSession {
  return {
    session: {
      id: "session-1",
      topicId: null,
      title: "Travel",
      status: "active",
      summary: null,
      costUsd: 0,
      createdAt: "2026-11-05T09:00:00Z",
      updatedAt: "2026-11-05T09:30:00Z",
      ...session,
    },
    lastMessage:
      lastMessage === null
        ? null
        : {
            id: "message-1",
            sessionId: "session-1",
            role: "tutor",
            text: "Where do you want to go?",
            corrections: null,
            newWords: null,
            createdAt: "2026-11-05T09:30:00Z",
            ...lastMessage,
          },
  };
}

export function summaryWith(
  overrides: Partial<SessionSummary> = {},
  session: Partial<Session> = {},
): SessionSummary {
  return {
    session: {
      id: "session-1",
      topicId: null,
      title: "Travel",
      status: "ended",
      summary: null,
      costUsd: 0,
      createdAt: "2026-11-05T09:00:00Z",
      updatedAt: "2026-11-05T09:30:00Z",
      ...session,
    },
    messageCount: 0,
    corrections: [],
    newWords: [],
    ...overrides,
  };
}

export function weekWith(days: string[], overrides: Partial<SessionWeek> = {}): SessionWeek {
  return { weekStart: "2026-11-02", today: "2026-11-05", days, ...overrides };
}

export function resetFakeData(): void {
  for (const fn of Object.values(fakeData)) {
    fn.mockReset();
  }
  fakeData.getProfile.mockResolvedValue({ ok: true, value: completedProfile() });
  fakeData.getActiveSession.mockResolvedValue({ ok: true, value: null });
  fakeData.listOpenSessions.mockResolvedValue({ ok: true, value: [] });
  fakeData.getSessionWeek.mockResolvedValue({ ok: true, value: weekWith([]) });
  fakeData.getMonthSpend.mockResolvedValue({
    ok: true,
    value: { monthStart: "2026-11-01", spentUsd: 0 },
  });
  fakeData.getProfileStats.mockResolvedValue({
    ok: true,
    value: { sessions: 0, dayStreak: 0, newWords: 0 },
  });
  fakeData.deleteAccount.mockResolvedValue({ ok: true, value: null });
  fakeData.getSessionSummary.mockResolvedValue({ ok: true, value: summaryWith() });
}
