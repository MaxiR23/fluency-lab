// apps/mobile/test/utils/profile-edit.test.ts
//
// Tests for the profile edit pure functions.
//
// Tested:
// - editField reads the route param; editTitle names the screen
// - editDraft and editDraftReducer
// - canSaveEdit, editErrors and editUpdate for every field
// - editStateReducer
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/profile-edit.test.ts
//
// SEE: apps/mobile/src/utils/profile-edit.ts

import { describe, expect, it } from "@jest/globals";
import { profileUpdateSchema } from "@fluency-lab/shared";

import {
  canSaveEdit,
  editDraft,
  editDraftReducer,
  editErrors,
  editField,
  editStateReducer,
  editTitle,
  editUpdate,
  initialEditState,
  type EditDraft,
  type EditField,
} from "@/utils/profile-edit";
import { completedProfile, profileWith } from "../helpers/fake-data";

function draftWith(overrides: Partial<EditDraft>): EditDraft {
  return { ...editDraft(completedProfile()), ...overrides };
}

describe("editField", () => {
  it("reads each known field", () => {
    for (const field of ["name", "limit", "provider", "level", "goals", "topics"] as const) {
      expect(editField(field)).toBe(field);
    }
  });

  it("returns null for an unknown, empty or missing param", () => {
    expect(editField("email")).toBeNull();
    expect(editField("")).toBeNull();
    expect(editField(undefined)).toBeNull();
  });

  it("reads the first value of an array param", () => {
    expect(editField(["goals", "name"])).toBe("goals");
    expect(editField([])).toBeNull();
  });
});

describe("editTitle", () => {
  it("names each screen", () => {
    expect(editTitle("name")).toBe("Your name");
    expect(editTitle("limit")).toBe("Monthly limit");
    expect(editTitle("provider")).toBe("Provider");
    expect(editTitle("level")).toBe("Level");
    expect(editTitle("goals")).toBe("Goal");
    expect(editTitle("topics")).toBe("Topics");
  });
});

describe("editDraft", () => {
  it("copies the profile values", () => {
    const profile = profileWith({
      displayName: "Ada",
      monthlyLimitUsd: 25.5,
      provider: "openai",
      level: "advanced",
      goals: ["work"],
      topics: ["food", "music", "travel"],
    });
    expect(editDraft(profile)).toEqual({
      name: "Ada",
      limit: "25.5",
      provider: "openai",
      level: "advanced",
      goals: ["work"],
      topics: ["food", "music", "travel"],
    });
  });

  it("falls back to an empty name, the default limit and claude", () => {
    expect(editDraft(profileWith({}))).toEqual({
      name: "",
      limit: "10",
      provider: "claude",
      level: null,
      goals: [],
      topics: [],
    });
  });
});

describe("editDraftReducer", () => {
  const base = draftWith({ goals: [], topics: [] });

  it("changes the name, the limit, the provider and the level", () => {
    expect(editDraftReducer(base, { type: "name_changed", name: "Bo" }).name).toBe("Bo");
    expect(editDraftReducer(base, { type: "limit_changed", limit: "5" }).limit).toBe("5");
    expect(editDraftReducer(base, { type: "provider_picked", provider: "openai" }).provider).toBe(
      "openai",
    );
    expect(editDraftReducer(base, { type: "level_picked", level: "beginner" }).level).toBe(
      "beginner",
    );
  });

  it("toggles a goal and a topic on and off", () => {
    const on = editDraftReducer(base, { type: "goal_toggled", goal: "work" });
    expect(on.goals).toEqual(["work"]);
    expect(editDraftReducer(on, { type: "goal_toggled", goal: "work" }).goals).toEqual([]);
    const topic = editDraftReducer(base, { type: "topic_toggled", topic: "food" });
    expect(topic.topics).toEqual(["food"]);
    expect(editDraftReducer(topic, { type: "topic_toggled", topic: "food" }).topics).toEqual([]);
  });
});

describe("canSaveEdit", () => {
  it("needs a level for the level field", () => {
    expect(canSaveEdit("level", draftWith({ level: null }))).toBe(false);
    expect(canSaveEdit("level", draftWith({ level: "advanced" }))).toBe(true);
  });

  it("needs at least one goal", () => {
    expect(canSaveEdit("goals", draftWith({ goals: [] }))).toBe(false);
    expect(canSaveEdit("goals", draftWith({ goals: ["work", "travel"] }))).toBe(true);
  });

  it("needs three topics", () => {
    expect(canSaveEdit("topics", draftWith({ topics: ["food", "music"] }))).toBe(false);
    expect(canSaveEdit("topics", draftWith({ topics: ["food", "music", "travel"] }))).toBe(true);
  });

  it("is always true for the name, the limit and the provider", () => {
    const blank = draftWith({ name: "", limit: "" });
    for (const field of ["name", "limit", "provider"] as const) {
      expect(canSaveEdit(field, blank)).toBe(true);
    }
  });
});

describe("editErrors", () => {
  it("asks for a name when blank", () => {
    expect(editErrors("name", draftWith({ name: "  " }))).toEqual({ name: "Enter your name." });
  });

  it("accepts 80 characters and rejects 81", () => {
    expect(editErrors("name", draftWith({ name: "a".repeat(80) }))).toEqual({});
    expect(editErrors("name", draftWith({ name: "a".repeat(81) }))).toEqual({
      name: "Use at most 80 characters.",
    });
  });

  it("validates the limit with the onboarding rules", () => {
    expect(editErrors("limit", draftWith({ limit: "0.01" }))).toEqual({});
    expect(editErrors("limit", draftWith({ limit: "10000" }))).toEqual({});
    expect(editErrors("limit", draftWith({ limit: "" }))).toEqual({
      limit: "Enter an amount in USD.",
    });
    for (const bad of ["0", "10000.01", "1.234"]) {
      expect(editErrors("limit", draftWith({ limit: bad })).limit).toContain("between 0.01");
    }
  });

  it("has no errors for the other fields", () => {
    for (const field of ["provider", "level", "goals", "topics"] as const) {
      expect(editErrors(field, draftWith({ name: "", limit: "" }))).toEqual({});
    }
  });
});

describe("editUpdate", () => {
  it("carries only displayName for the name, trimmed", () => {
    expect(editUpdate("name", draftWith({ name: "  Ada " }))).toEqual({ displayName: "Ada" });
  });

  it("carries only the limit as a number", () => {
    expect(editUpdate("limit", draftWith({ limit: "25.5" }))).toEqual({ monthlyLimitUsd: 25.5 });
    expect(editUpdate("limit", draftWith({ limit: "0.01" }))).toEqual({ monthlyLimitUsd: 0.01 });
  });

  it("returns null for an invalid limit", () => {
    expect(editUpdate("limit", draftWith({ limit: "10000.01" }))).toBeNull();
    expect(editUpdate("limit", draftWith({ limit: "" }))).toBeNull();
  });

  it("carries only the provider, the level, the goals or the topics", () => {
    expect(editUpdate("provider", draftWith({ provider: "openai" }))).toEqual({
      provider: "openai",
    });
    expect(editUpdate("level", draftWith({ level: "beginner" }))).toEqual({ level: "beginner" });
    expect(editUpdate("goals", draftWith({ goals: ["work"] }))).toEqual({ goals: ["work"] });
    expect(editUpdate("topics", draftWith({ topics: ["food", "music", "travel"] }))).toEqual({
      topics: ["food", "music", "travel"],
    });
  });

  it("returns null for a blank name and for no level", () => {
    expect(editUpdate("name", draftWith({ name: " " }))).toBeNull();
    expect(editUpdate("level", draftWith({ level: null }))).toBeNull();
  });

  it("builds an update the API accepts for every field", () => {
    const fields: EditField[] = ["name", "limit", "provider", "level", "goals", "topics"];
    const draft = draftWith({
      name: "Ada",
      limit: "12",
      level: "advanced",
      goals: ["work"],
      topics: ["food", "music", "travel"],
    });
    for (const field of fields) {
      const update = editUpdate(field, draft);
      expect(update).not.toBeNull();
      expect(profileUpdateSchema.safeParse(update).success).toBe(true);
    }
  });
});

describe("editStateReducer", () => {
  const profile = completedProfile();
  const ready = editStateReducer(initialEditState, {
    type: "loaded",
    profile: { ok: true, value: profile },
  });

  it("starts loading and is ready with the draft of the profile", () => {
    expect(initialEditState).toEqual({ kind: "loading" });
    expect(ready).toEqual({
      kind: "ready",
      draft: editDraft(profile),
      errors: {},
      saving: false,
      saveFailure: null,
    });
  });

  it("fails with the read failure and goes back to loading", () => {
    const failed = editStateReducer(initialEditState, {
      type: "loaded",
      profile: { ok: false, failure: "network" },
    });
    expect(failed).toEqual({ kind: "failed", failure: "network" });
    expect(editStateReducer(failed, { type: "load_started" })).toEqual(initialEditState);
  });

  it("applies a draft event and clears the errors and the save failure", () => {
    const withErrors = editStateReducer(ready, { type: "save_blocked", errors: { name: "x" } });
    const next = editStateReducer(withErrors, {
      type: "draft_changed",
      event: { type: "name_changed", name: "Bo" },
    });
    expect(next).toMatchObject({ kind: "ready", errors: {}, saveFailure: null });
    expect(next.kind === "ready" && next.draft.name).toBe("Bo");
  });

  it("blocks a save with errors, starts a save and keeps a save failure", () => {
    const blocked = editStateReducer(ready, { type: "save_blocked", errors: { name: "x" } });
    expect(blocked).toMatchObject({ errors: { name: "x" }, saving: false });
    const saving = editStateReducer(blocked, { type: "save_started" });
    expect(saving).toMatchObject({ saving: true, errors: {}, saveFailure: null });
    const failed = editStateReducer(saving, { type: "save_failed", message: "Could not save" });
    expect(failed).toMatchObject({ saving: false, saveFailure: "Could not save" });
    expect(editStateReducer(failed, { type: "save_finished" })).toMatchObject({ saving: false });
  });

  it("ignores edit events while not ready", () => {
    expect(editStateReducer(initialEditState, { type: "save_started" })).toEqual(initialEditState);
  });
});
