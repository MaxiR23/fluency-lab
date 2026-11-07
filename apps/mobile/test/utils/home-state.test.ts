// apps/mobile/test/utils/home-state.test.ts
//
// Tests for the Home state.
//
// Tested:
// - homeFromReads (profile, open sessions, week, today's practice and mistakes) and homeReducer
// - The ready state carries today's card: today's run, or the start state with no run
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/home-state.test.ts
//
// SEE: apps/mobile/src/utils/home-state.ts

import { describe, expect, it } from "@jest/globals";
import type {
  ActiveSession,
  MistakePage,
  PracticeRunWithItems,
  Profile,
  SessionWeek,
} from "@fluency-lab/shared";

import type { DataOutcome } from "@/data/data-port";

import { homeFromReads, homeReducer, initialHome } from "@/utils/home-state";
import { todayCard } from "@/utils/today-practice";
import {
  activeSessionWith,
  completedProfile,
  mistakeGroupWith,
  practiceItemWith,
  practiceTodayWith,
  weekWith,
} from "../helpers/fake-data";

const profile = completedProfile();
const newest = activeSessionWith({ id: "session-2" });
const older = activeSessionWith({ id: "session-1" });
const week = weekWith(["2026-11-02"]);
const loadedAt = Date.parse("2026-11-05T12:00:00Z");
const none = { items: [], nextOffset: null };
const noRun: DataOutcome<PracticeRunWithItems | null> = { ok: true, value: null };
const noMistakes: DataOutcome<MistakePage> = { ok: true, value: none };
const okProfile: DataOutcome<Profile> = { ok: true, value: profile };
const okOpen: DataOutcome<ActiveSession[]> = { ok: true, value: [] };
const okWeek: DataOutcome<SessionWeek> = { ok: true, value: week };

describe("homeFromReads", () => {
  it("is ready with the newest open session as Continue and the count", () => {
    expect(
      homeFromReads(
        okProfile,
        { ok: true, value: [newest, older] },
        okWeek,
        noRun,
        noMistakes,
        loadedAt,
      ),
    ).toEqual({
      kind: "ready",
      profile,
      activeSession: newest,
      openCount: 2,
      week,
      today: todayCard({ today: null, mistakes: none, level: null }),
      loadedAt,
    });
  });

  it("is ready with no Continue and a count of 0 for no open sessions", () => {
    expect(homeFromReads(okProfile, okOpen, okWeek, noRun, noMistakes, loadedAt)).toMatchObject({
      kind: "ready",
      activeSession: null,
      openCount: 0,
    });
  });

  it("is ready with today's card", () => {
    const today = practiceTodayWith([practiceItemWith({ correct: true })]);
    const state = homeFromReads(
      okProfile,
      okOpen,
      okWeek,
      { ok: true, value: today },
      noMistakes,
      loadedAt,
    );
    expect(state.kind === "ready" && state.today).toEqual(
      todayCard({ today, mistakes: none, level: null }),
    );
    expect(state.kind === "ready" && state.today.action).toBe("Keep going");
  });

  it("is ready with the start state when there is no run", () => {
    const mistakes = { items: [mistakeGroupWith({ rule: "Articles" })], nextOffset: null };
    const state = homeFromReads(
      okProfile,
      okOpen,
      okWeek,
      noRun,
      { ok: true, value: mistakes },
      loadedAt,
    );
    expect(state.kind === "ready" && state.today).toMatchObject({
      action: "Start practice",
      title: "From your mistakes",
      chips: ["Articles"],
    });
  });

  it("fails with the profile failure", () => {
    expect(
      homeFromReads(
        { ok: false, failure: "unauthorized" },
        okOpen,
        okWeek,
        noRun,
        noMistakes,
        loadedAt,
      ),
    ).toEqual({ kind: "failed", failure: "unauthorized" });
  });

  it("fails with the open sessions failure when the profile read succeeds", () => {
    expect(
      homeFromReads(
        okProfile,
        { ok: false, failure: "unavailable" },
        okWeek,
        noRun,
        noMistakes,
        loadedAt,
      ),
    ).toEqual({ kind: "failed", failure: "unavailable" });
  });

  it("fails with the week failure when only the week read fails", () => {
    expect(
      homeFromReads(
        okProfile,
        okOpen,
        { ok: false, failure: "invalid_input" },
        noRun,
        noMistakes,
        loadedAt,
      ),
    ).toEqual({ kind: "failed", failure: "invalid_input" });
  });

  it("fails when today's practice cannot be read", () => {
    expect(
      homeFromReads(
        okProfile,
        okOpen,
        okWeek,
        { ok: false, failure: "network" },
        noMistakes,
        loadedAt,
      ),
    ).toEqual({ kind: "failed", failure: "network" });
  });

  it("fails when the mistakes cannot be read", () => {
    expect(
      homeFromReads(
        okProfile,
        okOpen,
        okWeek,
        noRun,
        { ok: false, failure: "bad_response" },
        loadedAt,
      ),
    ).toEqual({ kind: "failed", failure: "bad_response" });
  });

  it("keeps the profile failure first when several fail", () => {
    expect(
      homeFromReads(
        { ok: false, failure: "network" },
        { ok: false, failure: "unavailable" },
        { ok: false, failure: "bad_response" },
        { ok: false, failure: "unauthorized" },
        { ok: false, failure: "not_found" },
        loadedAt,
      ),
    ).toEqual({ kind: "failed", failure: "network" });
  });

  it("keeps the open sessions failure before the week failure", () => {
    expect(
      homeFromReads(
        okProfile,
        { ok: false, failure: "unavailable" },
        { ok: false, failure: "bad_response" },
        noRun,
        noMistakes,
        loadedAt,
      ),
    ).toEqual({ kind: "failed", failure: "unavailable" });
  });
});

describe("homeReducer", () => {
  it("goes back to loading on load_started", () => {
    expect(homeReducer({ kind: "failed", failure: "network" }, { type: "load_started" })).toEqual(
      initialHome,
    );
  });

  it("becomes the state of the reads on loaded", () => {
    expect(
      homeReducer(initialHome, {
        type: "loaded",
        profile: okProfile,
        open: okOpen,
        week: okWeek,
        today: noRun,
        mistakes: noMistakes,
        loadedAt,
      }),
    ).toEqual({
      kind: "ready",
      profile,
      activeSession: null,
      openCount: 0,
      week,
      today: todayCard({ today: null, mistakes: none, level: null }),
      loadedAt,
    });
  });
});
