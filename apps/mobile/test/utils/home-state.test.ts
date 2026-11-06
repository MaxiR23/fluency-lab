// apps/mobile/test/utils/home-state.test.ts
//
// Tests for the Home state.
//
// Tested:
// - homeFromReads (profile, open sessions and week) and homeReducer
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/home-state.test.ts
//
// SEE: apps/mobile/src/utils/home-state.ts

import { describe, expect, it } from "@jest/globals";

import { homeFromReads, homeReducer, initialHome } from "@/utils/home-state";
import { activeSessionWith, completedProfile, weekWith } from "../helpers/fake-data";

const profile = completedProfile();
const newest = activeSessionWith({ id: "session-2" });
const older = activeSessionWith({ id: "session-1" });
const week = weekWith(["2026-11-02"]);
const loadedAt = Date.parse("2026-11-05T12:00:00Z");

describe("homeFromReads", () => {
  it("is ready with the newest open session as Continue and the count", () => {
    expect(
      homeFromReads(
        { ok: true, value: profile },
        { ok: true, value: [newest, older] },
        { ok: true, value: week },
        loadedAt,
      ),
    ).toEqual({ kind: "ready", profile, activeSession: newest, openCount: 2, week, loadedAt });
  });

  it("is ready with no Continue and a count of 0 for no open sessions", () => {
    const empty = weekWith([]);
    expect(
      homeFromReads(
        { ok: true, value: profile },
        { ok: true, value: [] },
        { ok: true, value: empty },
        loadedAt,
      ),
    ).toEqual({
      kind: "ready",
      profile,
      activeSession: null,
      openCount: 0,
      week: empty,
      loadedAt,
    });
  });

  it("fails with the profile failure", () => {
    expect(
      homeFromReads(
        { ok: false, failure: "unauthorized" },
        { ok: true, value: [] },
        { ok: true, value: week },
        loadedAt,
      ),
    ).toEqual({ kind: "failed", failure: "unauthorized" });
  });

  it("fails with the open sessions failure when the profile read succeeds", () => {
    expect(
      homeFromReads(
        { ok: true, value: profile },
        { ok: false, failure: "unavailable" },
        { ok: true, value: week },
        loadedAt,
      ),
    ).toEqual({ kind: "failed", failure: "unavailable" });
  });

  it("fails with the week failure when only the week read fails", () => {
    expect(
      homeFromReads(
        { ok: true, value: profile },
        { ok: true, value: [] },
        { ok: false, failure: "invalid_input" },
        loadedAt,
      ),
    ).toEqual({ kind: "failed", failure: "invalid_input" });
  });

  it("keeps the profile failure first when several fail", () => {
    expect(
      homeFromReads(
        { ok: false, failure: "network" },
        { ok: false, failure: "unavailable" },
        { ok: false, failure: "bad_response" },
        loadedAt,
      ),
    ).toEqual({ kind: "failed", failure: "network" });
  });

  it("keeps the open sessions failure before the week failure", () => {
    expect(
      homeFromReads(
        { ok: true, value: profile },
        { ok: false, failure: "unavailable" },
        { ok: false, failure: "bad_response" },
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
        profile: { ok: true, value: profile },
        open: { ok: true, value: [] },
        week: { ok: true, value: week },
        loadedAt,
      }),
    ).toEqual({ kind: "ready", profile, activeSession: null, openCount: 0, week, loadedAt });
  });
});
