// apps/mobile/test/utils/home-state.test.ts
//
// Tests for the Home state.
//
// Tested:
// - homeFromReads and homeReducer
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/home-state.test.ts
//
// SEE: apps/mobile/src/utils/home-state.ts

import { describe, expect, it } from "@jest/globals";

import { homeFromReads, homeReducer, initialHome } from "@/utils/home-state";
import { activeSessionWith, completedProfile } from "../helpers/fake-data";

const profile = completedProfile();
const active = activeSessionWith({});
const loadedAt = Date.parse("2026-11-05T12:00:00Z");

describe("homeFromReads", () => {
  it("is ready with the profile and the active session", () => {
    expect(
      homeFromReads({ ok: true, value: profile }, { ok: true, value: active }, loadedAt),
    ).toEqual({
      kind: "ready",
      profile,
      activeSession: active,
      loadedAt,
    });
  });

  it("is ready with no active session", () => {
    expect(
      homeFromReads({ ok: true, value: profile }, { ok: true, value: null }, loadedAt),
    ).toEqual({
      kind: "ready",
      profile,
      activeSession: null,
      loadedAt,
    });
  });

  it("fails with the profile failure", () => {
    expect(
      homeFromReads({ ok: false, failure: "unauthorized" }, { ok: true, value: null }, loadedAt),
    ).toEqual({ kind: "failed", failure: "unauthorized" });
  });

  it("fails with the active session failure when the profile read succeeds", () => {
    expect(
      homeFromReads({ ok: true, value: profile }, { ok: false, failure: "unavailable" }, loadedAt),
    ).toEqual({ kind: "failed", failure: "unavailable" });
  });

  it("keeps the profile failure when both fail", () => {
    expect(
      homeFromReads(
        { ok: false, failure: "network" },
        { ok: false, failure: "unavailable" },
        loadedAt,
      ),
    ).toEqual({ kind: "failed", failure: "network" });
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
        loadedAt,
      }),
    ).toEqual({ kind: "ready", profile, activeSession: null, loadedAt });
  });
});
