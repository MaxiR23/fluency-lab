// apps/mobile/test/utils/home-state.test.ts
//
// Tests for the Home state.
//
// Tested:
// - homeFromReads (profile, active session and week) and homeReducer
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
const active = activeSessionWith({});
const week = weekWith(["2026-11-02"]);
const loadedAt = Date.parse("2026-11-05T12:00:00Z");

describe("homeFromReads", () => {
  it("is ready with the profile, the active session and the week", () => {
    expect(
      homeFromReads(
        { ok: true, value: profile },
        { ok: true, value: active },
        { ok: true, value: week },
        loadedAt,
      ),
    ).toEqual({ kind: "ready", profile, activeSession: active, week, loadedAt });
  });

  it("is ready with no active session and an empty week", () => {
    const empty = weekWith([]);
    expect(
      homeFromReads(
        { ok: true, value: profile },
        { ok: true, value: null },
        { ok: true, value: empty },
        loadedAt,
      ),
    ).toEqual({ kind: "ready", profile, activeSession: null, week: empty, loadedAt });
  });

  it("fails with the profile failure", () => {
    expect(
      homeFromReads(
        { ok: false, failure: "unauthorized" },
        { ok: true, value: null },
        { ok: true, value: week },
        loadedAt,
      ),
    ).toEqual({ kind: "failed", failure: "unauthorized" });
  });

  it("fails with the active session failure when the profile read succeeds", () => {
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
        { ok: true, value: null },
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

  it("keeps the active session failure before the week failure", () => {
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
        active: { ok: true, value: null },
        week: { ok: true, value: week },
        loadedAt,
      }),
    ).toEqual({ kind: "ready", profile, activeSession: null, week, loadedAt });
  });
});
