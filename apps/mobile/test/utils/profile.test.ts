// apps/mobile/test/utils/profile.test.ts
//
// Tests for the Profile pure functions.
//
// Tested:
// - profileFromReads and profileReducer
// - profileHeader, statTiles and learningValues
// - deleteAccountButtons and the deletion steps (deletionReducer)
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/profile.test.ts
//
// SEE: apps/mobile/src/utils/profile.ts

import { describe, expect, it, jest } from "@jest/globals";

import {
  deleteAccountButtons,
  deleteAccountPrompt,
  deletionReducer,
  initialDeletion,
  initialProfile,
  learningValues,
  profileFromReads,
  profileHeader,
  profileReducer,
  statTiles,
  type Deletion,
} from "@/utils/profile";
import { completedProfile, profileWith } from "../helpers/fake-data";

const stats = { sessions: 12, dayStreak: 3, newWords: 48 };

describe("profileFromReads and profileReducer", () => {
  it("is ready with the profile and the stats", () => {
    const profile = completedProfile();
    expect(profileFromReads({ ok: true, value: profile }, { ok: true, value: stats })).toEqual({
      kind: "ready",
      profile,
      stats,
    });
  });

  it("is ready with zero stats", () => {
    const zeros = { sessions: 0, dayStreak: 0, newWords: 0 };
    expect(
      profileFromReads({ ok: true, value: completedProfile() }, { ok: true, value: zeros }),
    ).toMatchObject({ kind: "ready", stats: zeros });
  });

  it("fails with the profile failure first, then the stats failure", () => {
    expect(
      profileFromReads({ ok: false, failure: "unauthorized" }, { ok: false, failure: "network" }),
    ).toEqual({ kind: "failed", failure: "unauthorized" });
    expect(
      profileFromReads({ ok: true, value: completedProfile() }, { ok: false, failure: "network" }),
    ).toEqual({ kind: "failed", failure: "network" });
  });

  it("load_started goes back to loading and loaded builds the state", () => {
    const loaded = profileReducer(initialProfile, {
      type: "loaded",
      profile: { ok: true, value: completedProfile() },
      stats: { ok: true, value: stats },
    });
    expect(loaded.kind).toBe("ready");
    expect(profileReducer(loaded, { type: "load_started" })).toEqual(initialProfile);
    expect(initialProfile).toEqual({ kind: "loading" });
  });
});

describe("profileHeader", () => {
  it("gives the initial, the name and the email", () => {
    expect(profileHeader(profileWith({ displayName: "Maxi" }), "m@example.com")).toEqual({
      initial: "M",
      name: "Maxi",
      email: "m@example.com",
    });
  });

  it("says No name set with no initial and no email for a new user", () => {
    expect(profileHeader(profileWith({ displayName: null }), null)).toEqual({
      initial: null,
      name: "No name set",
      email: null,
    });
  });

  it("treats a blank name as no name", () => {
    expect(profileHeader(profileWith({ displayName: "   " }), null)).toMatchObject({
      initial: null,
      name: "No name set",
    });
  });

  it("takes the first character of a one-letter name and of an emoji name", () => {
    expect(profileHeader(profileWith({ displayName: "a" }), null).initial).toBe("A");
    expect(profileHeader(profileWith({ displayName: "😀 Max" }), null).initial).toBe("😀");
  });
});

describe("statTiles", () => {
  it("gives the three tiles in order", () => {
    expect(statTiles(stats)).toEqual([
      { value: "12", label: "Sessions" },
      { value: "3", label: "Day streak" },
      { value: "48", label: "New words" },
    ]);
  });

  it("gives zeros as text", () => {
    expect(statTiles({ sessions: 0, dayStreak: 0, newWords: 0 }).map((tile) => tile.value)).toEqual(
      ["0", "0", "0"],
    );
  });
});

describe("learningValues", () => {
  it("gives the level label, the goal labels and the topic count", () => {
    expect(
      learningValues(
        profileWith({
          level: "intermediate",
          goals: ["work", "conversation"],
          topics: ["food", "music", "travel", "sports"],
        }),
      ),
    ).toEqual({
      level: "Intermediate",
      goals: "Work, Everyday conversation",
      topics: "4 selected",
    });
  });

  it("says Not set for no level and no goals, and 0 selected for no topics", () => {
    expect(learningValues(profileWith({}))).toEqual({
      level: "Not set",
      goals: "Not set",
      topics: "0 selected",
    });
  });
});

describe("deleteAccountPrompt and deleteAccountButtons", () => {
  it("asks before deleting", () => {
    expect(deleteAccountPrompt).toEqual({
      title: "Delete your account?",
      message: "This removes your profile, chats and progress. It can't be undone.",
    });
  });

  it("offers Cancel then Delete, Delete destructive and calling its callback", () => {
    const onDelete = jest.fn();
    const buttons = deleteAccountButtons(onDelete);
    expect(buttons.map((button) => [button.text, button.style])).toEqual([
      ["Cancel", "cancel"],
      ["Delete", "destructive"],
    ]);
    expect(onDelete).not.toHaveBeenCalled();
    buttons[1]?.onPress?.();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

describe("deletionReducer", () => {
  it("starts at the account step", () => {
    expect(deletionReducer(initialDeletion, { type: "started" })).toEqual({
      step: "account",
      running: true,
      failure: null,
    });
  });

  it("moves to the key step after the account", () => {
    const running: Deletion = { step: "account", running: true, failure: null };
    expect(deletionReducer(running, { type: "account_deleted" })).toMatchObject({ step: "key" });
  });

  it("moves to the session step after the key", () => {
    const running: Deletion = { step: "key", running: true, failure: null };
    expect(deletionReducer(running, { type: "key_cleared" })).toMatchObject({ step: "session" });
  });

  it("keeps the failed step so a retry does not delete the account twice", () => {
    const failed = deletionReducer(
      { step: "key", running: true, failure: null },
      { type: "failed", step: "key", message: "no key", cause: { name: "Error", detail: null } },
    );
    expect(failed).toEqual({
      step: "key",
      running: false,
      failure: { message: "no key", cause: { name: "Error", detail: null } },
    });
    expect(deletionReducer(failed, { type: "started" })).toMatchObject({
      step: "key",
      running: true,
    });
  });

  it("clears the failure on a new start", () => {
    const failed = deletionReducer(initialDeletion, {
      type: "failed",
      step: "account",
      message: "nope",
    });
    expect(failed.failure).toEqual({ message: "nope" });
    expect(deletionReducer(failed, { type: "started" }).failure).toBeNull();
  });
});
