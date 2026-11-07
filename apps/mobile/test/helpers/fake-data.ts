// Test helper (not a test file): a fake of the data port, so no test builds a
// URL or reaches the backend. Wire it with
// jest.mock("@/data", () => ({ data: fake.fakeData })), where fake is
// jest.requireActual of this file. Call resetFakeData() in beforeEach: it makes
// getProfile answer with a completed profile, listOpenSessions with no open
// session and getSessionWeek with an empty week (Home reads all three), and
// getMonthSpend with 0 spent (Chat reads it), getProfileStats with zeros (Profile reads it)
// deleteAccount with success, so a signed in user lands on Home, and getSessionSummary with an
// empty ended session (Summary reads it). Progress reads all five of getMonthProgress, listHistory,
// listMistakes, listWords and listNotes: zeros and empty pages. Thread reads openThread: a thread with no
// messages on a learner message with two corrections. Home also reads getTodayPractice: no run today.

import { jest } from "@jest/globals";
import type {
  ActiveSession,
  CorrectionThread,
  HistoryItem,
  Message,
  MistakeGroup,
  NewWordItem,
  StudyNote,
  PracticeItem,
  PracticeRun,
  PracticeRunWithItems,
  Profile,
  Session,
  SessionSummary,
  SessionWeek,
  ThreadMessage,
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
  createNote: jest.fn<DataPort["createNote"]>(),
  getNote: jest.fn<DataPort["getNote"]>(),
  deleteNote: jest.fn<DataPort["deleteNote"]>(),
  listNotes: jest.fn<DataPort["listNotes"]>(),
  openThread: jest.fn<DataPort["openThread"]>(),
  addThreadMessage: jest.fn<DataPort["addThreadMessage"]>(),
  withdrawCorrections: jest.fn<DataPort["withdrawCorrections"]>(),
  getMonthSpend: jest.fn<DataPort["getMonthSpend"]>(),
  getSessionWeek: jest.fn<DataPort["getSessionWeek"]>(),
  getProfileStats: jest.fn<DataPort["getProfileStats"]>(),
  getSessionSummary: jest.fn<DataPort["getSessionSummary"]>(),
  getMonthProgress: jest.fn<DataPort["getMonthProgress"]>(),
  listHistory: jest.fn<DataPort["listHistory"]>(),
  listMistakes: jest.fn<DataPort["listMistakes"]>(),
  listWords: jest.fn<DataPort["listWords"]>(),
  getTodayPractice: jest.fn<DataPort["getTodayPractice"]>(),
  createPracticeRun: jest.fn<DataPort["createPracticeRun"]>(),
  openPracticeRun: jest.fn<DataPort["openPracticeRun"]>(),
  addPracticeItems: jest.fn<DataPort["addPracticeItems"]>(),
  answerPracticeItem: jest.fn<DataPort["answerPracticeItem"]>(),
  addPracticeUsage: jest.fn<DataPort["addPracticeUsage"]>(),
  setPracticeTarget: jest.fn<DataPort["setPracticeTarget"]>(),
  finishPracticeRun: jest.fn<DataPort["finishPracticeRun"]>(),
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
            replyToId: null,
            noteId: null,
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

export function historyItemWith(
  overrides: Partial<HistoryItem> = {},
  session: Partial<Session> = {},
): HistoryItem {
  return {
    session: {
      id: "session-1",
      topicId: null,
      title: "Tell me about yourself",
      status: "ended",
      summary: null,
      costUsd: 0,
      createdAt: "2026-11-05T09:00:00Z",
      updatedAt: "2026-11-05T09:30:00Z",
      ...session,
    },
    day: "2026-11-05",
    messageCount: 14,
    correctionCount: 3,
    ...overrides,
  };
}

export function mistakeGroupWith(overrides: Partial<MistakeGroup> = {}): MistakeGroup {
  return {
    rule: "Present perfect",
    times: 5,
    latest: { original: "I have went", corrected: "I have gone" },
    ...overrides,
  };
}

export function newWordWith(overrides: Partial<NewWordItem> = {}): NewWordItem {
  return { word: "catchy", sentence: "That song is catchy.", day: "2026-11-05", ...overrides };
}

export const THREAD_SENTENCE = "I never been to Japan, but I want to go the next year.";

// INFO: a learner message with two corrections, each with a rule, and a thread with no messages.
export function threadWith(
  overrides: Partial<CorrectionThread> = {},
  message: Partial<Message> = {},
): CorrectionThread {
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
    },
    message: {
      id: "message-1",
      sessionId: "session-1",
      role: "user",
      text: THREAD_SENTENCE,
      corrections: {
        items: [
          { original: "the next year", corrected: "next year", rule: "Articles with years" },
          { original: "I never been", corrected: "I've never been", rule: "Present perfect" },
        ],
        explanation: "No article before next year; use the present perfect.",
      },
      newWords: null,
      replyToId: null,
      noteId: null,
      createdAt: "2026-11-05T09:10:00Z",
      ...message,
    },
    messages: [],
    ...overrides,
  };
}

export function threadMessageWith(overrides: Partial<ThreadMessage> = {}): ThreadMessage {
  return {
    id: "thread-row-1",
    messageId: "message-1",
    role: "user",
    text: "Why is it wrong?",
    newWords: null,
    createdAt: "2026-11-05T09:20:00Z",
    ...overrides,
  };
}

export function practiceRunWith(overrides: Partial<PracticeRun> = {}): PracticeRun {
  return {
    id: "run-1",
    focus: "mistakes",
    topicId: null,
    noteId: null,
    target: 5,
    costUsd: 0,
    createdAt: "2026-11-05T09:00:00Z",
    finishedAt: null,
    ...overrides,
  };
}

export function practiceItemWith(overrides: Partial<PracticeItem> = {}): PracticeItem {
  return {
    id: "item-1",
    runId: "run-1",
    position: 0,
    kind: "choose",
    rule: "Present perfect",
    prompt: "I ___ to Japan twice.",
    options: ["have been", "was", "am"],
    accepted: ["have been"],
    explanation: "Use the present perfect for an experience.",
    source: null,
    userAnswer: null,
    correct: null,
    answeredAt: null,
    ...overrides,
  };
}

// INFO: a run with its items; the run defaults to a mistakes run of 5 with no items.
export function practiceTodayWith(
  items: PracticeItem[] = [],
  run: Partial<PracticeRun> = {},
): PracticeRunWithItems {
  return { run: practiceRunWith(run), items };
}

// INFO: a table note made in session-1 by default; pass kind "summary" content through overrides.
export function noteWith(overrides: Partial<StudyNote> = {}): StudyNote {
  const base = {
    id: "note-1",
    sessionId: "session-1" as string | null,
    sessionTitle: "Free chat" as string | null,
    title: "Future forms",
    topic: "Going to, will",
    createdAt: "2026-11-05T09:40:00Z",
  };
  const table: StudyNote = {
    ...base,
    kind: "table",
    content: {
      columns: ["Form", "When", "Example"],
      rows: [
        ["going to", "plans already made", "I'm going to study tonight."],
        ["will", "decisions made now", "I'll help you with that."],
      ],
      remember: "Plans use going to; instant decisions use will.",
    },
  };
  return { ...table, ...overrides } as StudyNote;
}

export function weekWith(days: string[], overrides: Partial<SessionWeek> = {}): SessionWeek {
  return { weekStart: "2026-11-02", today: "2026-11-05", days, perfectDays: [], ...overrides };
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
  fakeData.getMonthProgress.mockResolvedValue({
    ok: true,
    value: { monthStart: "2026-11-01", sessions: 0, corrections: 0, newWords: 0 },
  });
  fakeData.listHistory.mockResolvedValue({ ok: true, value: { items: [], nextOffset: null } });
  fakeData.listMistakes.mockResolvedValue({ ok: true, value: { items: [], nextOffset: null } });
  fakeData.listWords.mockResolvedValue({ ok: true, value: { items: [], nextOffset: null } });
  fakeData.deleteAccount.mockResolvedValue({ ok: true, value: null });
  fakeData.getSessionSummary.mockResolvedValue({ ok: true, value: summaryWith() });
  fakeData.openThread.mockResolvedValue({ ok: true, value: threadWith() });
  fakeData.getTodayPractice.mockResolvedValue({ ok: true, value: null });
  fakeData.listNotes.mockResolvedValue({
    ok: true,
    value: { items: [], nextOffset: null, today: "2026-11-05" },
  });
  fakeData.getNote.mockResolvedValue({ ok: true, value: noteWith() });
  fakeData.createNote.mockImplementation(async (input) => ({
    ok: true,
    value: { ...input, id: "note-1", sessionTitle: null, createdAt: "2026-11-05T09:40:00Z" },
  }));
  fakeData.deleteNote.mockResolvedValue({ ok: true, value: { id: "note-1" } });
}
