// apps/api/test/rows.test.ts
//
// Tests for the mapping of database rows to the API contract.
//
// Tested:
// - toProfile, toSession and toMessage rename snake_case rows and reject bad rows
// - toOpenSession reads a session row with its newest embedded message
// - toSessionStart reads the start time of a session row
// - toProfileStatsRow reads the session count, the session days and the new words count
// - toSessionCost reads the start time and the cost of a session row
// - toMonthProgressRow, toHistoryRow, toMistakeRow and toWordRow read the Progress rows
// - toMessage reads a message whose correction is withdrawn
// - toThreadMessage and toThreadCount read a thread row and a reply count
// - toPracticeRun, toPracticeItem and toPracticeRunWithItems read the practice rows
// - toStudyNote and toNoteRow read a note row, with and without its session
// - toProfilePatch renames an update to columns
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec vitest run apps/api/test/rows.test.ts
//
// SEE: apps/api/src/rows.ts

import { describe, expect, it } from "vitest";
import {
  toHistoryRow,
  toMessage,
  toMistakeRow,
  toMonthProgressRow,
  toNoteRow,
  toOpenSession,
  toPracticeItem,
  toPracticeRun,
  toPracticeRunWithItems,
  toProfile,
  toProfilePatch,
  toProfileStatsRow,
  toSession,
  toSessionCost,
  toSessionStart,
  toStudyNote,
  toThreadCount,
  toThreadMessage,
  toWordRow,
} from "../src/rows";

const id = "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e6f";
const stamp = "2026-01-01T10:00:00+00:00";

const profileRow = {
  id,
  display_name: "Ada",
  level: "beginner",
  goals: ["work"],
  topics: ["food"],
  monthly_limit_usd: 12.5,
  provider: "claude",
  onboarding_completed_at: stamp,
  created_at: stamp,
  updated_at: stamp,
};

const sessionRow = {
  id,
  user_id: id,
  topic_id: "music",
  title: "Music",
  status: "active",
  summary: null,
  cost_usd: 0.25,
  created_at: stamp,
  updated_at: stamp,
};

const messageRow = {
  id,
  session_id: id,
  role: "tutor",
  text: "Hi",
  corrections: { items: [{ original: "a", corrected: "b" }], explanation: "Because." },
  new_words: ["word"],
  reply_to_id: null,
  note_id: null,
  created_at: stamp,
};

function without(row: Record<string, unknown>, key: string): Record<string, unknown> {
  const copy = { ...row };
  delete copy[key];
  return copy;
}

describe("toProfile", () => {
  it("maps a profile row to the contract", () => {
    expect(toProfile(profileRow)).toEqual({
      id,
      displayName: "Ada",
      level: "beginner",
      goals: ["work"],
      topics: ["food"],
      provider: "claude",
      monthlyLimitUsd: 12.5,
      onboardingCompletedAt: stamp,
      createdAt: stamp,
      updatedAt: stamp,
    });
  });

  it("maps a fresh profile with no onboarding data", () => {
    const fresh = {
      ...profileRow,
      display_name: null,
      level: null,
      goals: [],
      topics: [],
      monthly_limit_usd: null,
      provider: null,
      onboarding_completed_at: null,
    };
    expect(toProfile(fresh)).toMatchObject({
      displayName: null,
      level: null,
      goals: [],
      topics: [],
      monthlyLimitUsd: null,
      provider: null,
      onboardingCompletedAt: null,
    });
  });

  it("returns null for a row with a missing column", () => {
    expect(toProfile(without(profileRow, "goals"))).toBeNull();
  });

  it("returns null for a level outside the list", () => {
    expect(toProfile({ ...profileRow, level: "expert" })).toBeNull();
  });

  it("returns null for something that is not a row", () => {
    expect(toProfile(null)).toBeNull();
  });
});

describe("toSession", () => {
  it("maps a session row to the contract", () => {
    expect(toSession(sessionRow)).toEqual({
      id,
      topicId: "music",
      title: "Music",
      status: "active",
      summary: null,
      costUsd: 0.25,
      createdAt: stamp,
      updatedAt: stamp,
    });
  });

  it("maps a free chat session with a null topic", () => {
    expect(toSession({ ...sessionRow, topic_id: null })?.topicId).toBeNull();
  });

  it("returns null for a row with a missing column", () => {
    expect(toSession(without(sessionRow, "title"))).toBeNull();
  });

  it("returns null for a status outside the list", () => {
    expect(toSession({ ...sessionRow, status: "paused" })).toBeNull();
  });
});

describe("toMessage", () => {
  it("maps a message row to the contract", () => {
    expect(toMessage(messageRow)).toEqual({
      id,
      sessionId: id,
      role: "tutor",
      text: "Hi",
      corrections: { items: [{ original: "a", corrected: "b" }], explanation: "Because." },
      newWords: ["word"],
      replyToId: null,
      noteId: null,
      createdAt: stamp,
    });
  });

  it("maps reply_to_id to replyToId", () => {
    expect(toMessage({ ...messageRow, reply_to_id: id })?.replyToId).toBe(id);
  });

  it("maps a null reply_to_id to null", () => {
    expect(toMessage({ ...messageRow, reply_to_id: null })?.replyToId).toBeNull();
  });

  it("rejects a message row without reply_to_id", () => {
    expect(toMessage(without(messageRow, "reply_to_id"))).toBeNull();
  });

  it("returns null for corrections that are not the saved shape", () => {
    expect(toMessage({ ...messageRow, corrections: "a" })).toBeNull();
    expect(toMessage({ ...messageRow, corrections: [{ from: "a", to: "b" }] })).toBeNull();
    expect(toMessage({ ...messageRow, new_words: "a" })).toBeNull();
  });

  it("keeps null corrections and new words", () => {
    const result = toMessage({ ...messageRow, corrections: null, new_words: null });
    expect(result?.corrections).toBeNull();
    expect(result?.newWords).toBeNull();
  });

  it("returns null for a row with a missing column", () => {
    expect(toMessage(without(messageRow, "text"))).toBeNull();
  });

  it("returns null for a role outside the list", () => {
    expect(toMessage({ ...messageRow, role: "system" })).toBeNull();
  });

  it("maps a message whose correction is withdrawn", () => {
    const corrections = {
      items: [{ original: "a", corrected: "b", withdrawn: true }],
      explanation: null,
    };
    expect(toMessage({ ...messageRow, corrections })?.corrections).toEqual(corrections);
  });
});

describe("toThreadMessage", () => {
  const threadRow = {
    id,
    message_id: id,
    role: "user",
    text: "Why?",
    new_words: ["word"],
    created_at: stamp,
  };

  it("maps a thread row to the contract", () => {
    expect(toThreadMessage(threadRow)).toEqual({
      id,
      messageId: id,
      role: "user",
      text: "Why?",
      newWords: ["word"],
      createdAt: stamp,
    });
  });

  it("maps null new words to null", () => {
    expect(toThreadMessage({ ...threadRow, new_words: null })?.newWords).toBeNull();
  });

  it("rejects a thread row with an unknown role", () => {
    expect(toThreadMessage({ ...threadRow, role: "system" })).toBeNull();
  });

  it("rejects a thread row without message_id", () => {
    expect(toThreadMessage(without(threadRow, "message_id"))).toBeNull();
  });
});

describe("toThreadCount", () => {
  it("maps a count row", () => {
    expect(toThreadCount({ message_id: id, reply_count: 3 })).toEqual({ messageId: id, count: 3 });
  });

  it("rejects a count that is a string", () => {
    expect(toThreadCount({ message_id: id, reply_count: "3" })).toBeNull();
  });
});

describe("toProfilePatch", () => {
  const now = new Date("2026-02-03T04:05:06.000Z");

  it("renames every field to its column", () => {
    expect(
      toProfilePatch(
        {
          displayName: "Ada",
          level: "advanced",
          goals: ["work"],
          topics: ["food"],
          provider: "openai",
          monthlyLimitUsd: 5,
        },
        now,
      ),
    ).toEqual({
      display_name: "Ada",
      level: "advanced",
      goals: ["work"],
      topics: ["food"],
      provider: "openai",
      monthly_limit_usd: 5,
    });
  });

  it("sets onboarding_completed_at from the clock", () => {
    expect(toProfilePatch({ onboardingCompleted: true }, now)).toEqual({
      onboarding_completed_at: "2026-02-03T04:05:06.000Z",
    });
  });

  it("leaves out absent fields", () => {
    expect(toProfilePatch({ level: "beginner" }, now)).toEqual({ level: "beginner" });
  });

  it("keeps a null display name as null", () => {
    expect(toProfilePatch({ displayName: null }, now)).toEqual({ display_name: null });
  });
});

describe("toSessionStart", () => {
  it("returns the created_at of the row", () => {
    expect(toSessionStart({ created_at: stamp })).toBe(stamp);
  });

  it("returns null for a missing field", () => {
    expect(toSessionStart({})).toBeNull();
  });

  it("returns null for text that is not a timestamp", () => {
    expect(toSessionStart({ created_at: "yesterday" })).toBeNull();
  });

  it("returns null for a number", () => {
    expect(toSessionStart({ created_at: 1 })).toBeNull();
  });
});

describe("toSessionCost", () => {
  it("maps a cost row", () => {
    expect(toSessionCost({ created_at: stamp, cost_usd: 0.000145 })).toEqual({
      createdAt: stamp,
      costUsd: 0.000145,
    });
  });

  it("maps a zero cost", () => {
    expect(toSessionCost({ created_at: stamp, cost_usd: 0 })?.costUsd).toBe(0);
  });

  it("returns null for a row without a cost or with a bad date", () => {
    expect(toSessionCost({ created_at: stamp })).toBeNull();
    expect(toSessionCost({ created_at: "yesterday", cost_usd: 1 })).toBeNull();
  });
});

describe("toOpenSession", () => {
  it("maps a session row with its newest message", () => {
    expect(toOpenSession({ ...sessionRow, messages: [messageRow] })).toMatchObject({
      session: { id, title: "Music" },
      lastMessage: { text: "Hi", role: "tutor" },
    });
  });

  it("maps a session with no messages to a null last message", () => {
    expect(toOpenSession({ ...sessionRow, messages: [] })).toMatchObject({
      session: { id },
      lastMessage: null,
    });
  });

  it("returns null for a bad session row", () => {
    expect(toOpenSession({ id, messages: [] })).toBeNull();
  });

  it("returns null for a bad embedded message", () => {
    expect(toOpenSession({ ...sessionRow, messages: [{ id }] })).toBeNull();
  });

  it("returns null without a messages list", () => {
    expect(toOpenSession(sessionRow)).toBeNull();
  });
});

describe("toProfileStatsRow", () => {
  it("parses the count, the days and the new words", () => {
    expect(
      toProfileStatsRow({
        session_count: 12,
        session_days: ["2026-11-06", "2026-11-05"],
        new_words: 48,
      }),
    ).toEqual({ sessionCount: 12, sessionDays: ["2026-11-06", "2026-11-05"], newWords: 48 });
  });

  it("parses a user with no sessions", () => {
    expect(toProfileStatsRow({ session_count: 0, session_days: [], new_words: 0 })).toEqual({
      sessionCount: 0,
      sessionDays: [],
      newWords: 0,
    });
  });

  it("returns null for a bad day, a non-number count or a missing field", () => {
    expect(
      toProfileStatsRow({ session_count: 1, session_days: ["yesterday"], new_words: 0 }),
    ).toBeNull();
    expect(toProfileStatsRow({ session_count: "1", session_days: [], new_words: 0 })).toBeNull();
    expect(toProfileStatsRow({ session_count: 1, session_days: [] })).toBeNull();
    expect(toProfileStatsRow(null)).toBeNull();
  });
});

describe("toMonthProgressRow", () => {
  it("maps the three counts", () => {
    expect(
      toMonthProgressRow({ session_count: 12, correction_count: 31, new_word_count: 48 }),
    ).toEqual({ sessionCount: 12, correctionCount: 31, newWordCount: 48 });
  });

  it("maps zeros", () => {
    expect(
      toMonthProgressRow({ session_count: 0, correction_count: 0, new_word_count: 0 }),
    ).toEqual({ sessionCount: 0, correctionCount: 0, newWordCount: 0 });
  });

  it("rejects a missing count", () => {
    expect(toMonthProgressRow({ session_count: 1, correction_count: 1 })).toBeNull();
    expect(toMonthProgressRow(null)).toBeNull();
  });
});

describe("toHistoryRow", () => {
  const counts = { message_count: 14, correction_count: 3 };

  it("maps a session row with its message and correction counts", () => {
    expect(toHistoryRow({ ...sessionRow, ...counts })).toEqual({
      session: toSession(sessionRow),
      messageCount: 14,
      correctionCount: 3,
    });
  });

  it("rejects a row without counts", () => {
    expect(toHistoryRow(sessionRow)).toBeNull();
  });

  it("rejects a bad session row", () => {
    expect(toHistoryRow({ ...without(sessionRow, "title"), ...counts })).toBeNull();
  });
});

describe("toMistakeRow", () => {
  const row = { rule: "Articles", times: 4, original: "a apple", corrected: "an apple" };

  it("maps a rule, times and the latest example", () => {
    expect(toMistakeRow(row)).toEqual(row);
  });

  it("maps a null rule", () => {
    expect(toMistakeRow({ ...row, rule: null })).toEqual({ ...row, rule: null });
  });

  it("rejects a missing original", () => {
    expect(toMistakeRow(without(row, "original"))).toBeNull();
  });
});

describe("toWordRow", () => {
  it("maps the word, its message text and the timestamp", () => {
    expect(toWordRow({ word: "catchy", sentence: "That song.", created_at: stamp })).toEqual({
      word: "catchy",
      sentence: "That song.",
      createdAt: stamp,
    });
  });

  it("rejects a timestamp that is not ISO", () => {
    expect(
      toWordRow({ word: "catchy", sentence: "That song.", created_at: "yesterday" }),
    ).toBeNull();
  });
});

describe("practice rows", () => {
  const runRow = {
    id,
    focus: "topic",
    topic_id: "conditionals",
    target: 10,
    note_id: null,
    cost_usd: 0.000145,
    created_at: stamp,
    finished_at: null,
  };
  const itemRow = (position: number) => ({
    id: `${id.slice(0, -1)}${position}`,
    run_id: id,
    position,
    kind: "choose",
    rule: "Present perfect",
    prompt: "I ___ there.",
    options: ["have been", "was", "am"],
    accepted: ["have been"],
    explanation: "Experience.",
    source: null,
    user_answer: null,
    correct: null,
    answered_at: null,
  });

  it("maps a practice run row", () => {
    expect(toPracticeRun(runRow)).toEqual({
      id,
      focus: "topic",
      topicId: "conditionals",
      noteId: null,
      target: 10,
      costUsd: 0.000145,
      createdAt: stamp,
      finishedAt: null,
    });
  });

  it("returns null for a run with an unknown focus or target", () => {
    expect(toPracticeRun({ ...runRow, focus: "chat" })).toBeNull();
    expect(toPracticeRun({ ...runRow, target: 7 })).toBeNull();
    expect(toPracticeRun(null)).toBeNull();
  });

  it("maps an item row", () => {
    expect(toPracticeItem({ ...itemRow(0), user_answer: "was", correct: false })).toMatchObject({
      runId: id,
      position: 0,
      options: ["have been", "was", "am"],
      accepted: ["have been"],
      userAnswer: "was",
      correct: false,
      answeredAt: null,
    });
  });

  it("returns null for an unknown kind and for options that are not strings", () => {
    expect(toPracticeItem({ ...itemRow(0), kind: "riddle" })).toBeNull();
    expect(toPracticeItem({ ...itemRow(0), options: [1, 2, 3] })).toBeNull();
    expect(toPracticeItem({ ...itemRow(0), accepted: [1] })).toBeNull();
  });

  it("maps a run with its items sorted by position", () => {
    const mapped = toPracticeRunWithItems({
      ...runRow,
      practice_items: [itemRow(2), itemRow(0), itemRow(1)],
    });
    expect(mapped?.items.map((item) => item.position)).toEqual([0, 1, 2]);
    expect(mapped?.run.id).toBe(id);
  });

  it("maps a run with no items", () => {
    expect(toPracticeRunWithItems({ ...runRow, practice_items: [] })).toEqual({
      run: toPracticeRun(runRow),
      items: [],
    });
  });

  it("returns null when one item is bad", () => {
    expect(
      toPracticeRunWithItems({ ...runRow, practice_items: [itemRow(0), { id: 1 }] }),
    ).toBeNull();
    expect(toPracticeRunWithItems(runRow)).toBeNull();
  });
});

describe("study note rows", () => {
  const tableContent = {
    columns: ["Form", "When", "Example"],
    rows: [["going to", "plans", "I'm going to study."]],
    remember: "Plans use going to.",
  };
  const noteRow = {
    id,
    session_id: id,
    kind: "table",
    title: "Future forms",
    topic: "Going to, will",
    content: tableContent,
    created_at: stamp,
    sessions: { title: "Free chat" },
  };

  it("maps a note row with its session title", () => {
    expect(toStudyNote(noteRow)).toEqual({
      id,
      sessionId: id,
      sessionTitle: "Free chat",
      kind: "table",
      title: "Future forms",
      topic: "Going to, will",
      content: tableContent,
      createdAt: stamp,
    });
  });

  it("maps a note row with no session to null ids and title", () => {
    expect(toStudyNote({ ...noteRow, session_id: null, sessions: null })).toMatchObject({
      sessionId: null,
      sessionTitle: null,
    });
  });

  it("rejects a note row whose content does not match its kind", () => {
    expect(toStudyNote({ ...noteRow, kind: "summary" })).toBeNull();
    expect(toStudyNote({ ...noteRow, content: "x" })).toBeNull();
    expect(toStudyNote(null)).toBeNull();
  });

  it("maps a note list row", () => {
    expect(
      toNoteRow({
        id,
        kind: "summary",
        title: "t",
        topic: "p",
        created_at: "2026-11-05T01:00:00+00:00",
      }),
    ).toEqual({
      id,
      kind: "summary",
      title: "t",
      topic: "p",
      createdAt: "2026-11-05T01:00:00+00:00",
    });
  });

  it("rejects a note list row with an unknown kind", () => {
    expect(
      toNoteRow({
        id,
        kind: "poem",
        title: "t",
        topic: "p",
        created_at: "2026-11-05T01:00:00+00:00",
      }),
    ).toBeNull();
  });

  it("maps the note id of a message and of a practice run", () => {
    expect(toMessage({ ...messageRow, note_id: id })?.noteId).toBe(id);
    expect(toMessage({ ...messageRow, note_id: null })?.noteId).toBeNull();
    expect(toMessage(without(messageRow, "note_id"))).toBeNull();
    const run = {
      id,
      focus: "note",
      topic_id: null,
      note_id: id,
      target: 5,
      cost_usd: 0,
      created_at: stamp,
      finished_at: null,
    };
    expect(toPracticeRun(run)?.noteId).toBe(id);
    expect(toPracticeRun({ ...run, note_id: null })?.noteId).toBeNull();
  });
});
