// apps/mobile/test/utils/practice-run-state.test.ts
//
// Tests for the view of the practice run screen, built from the reads it needs.
//
// Tested:
// - practiceRunView: loading, no key, failed and ready for a new run and for a resumed one
// - practiceNotice: the notice under the exercise
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/practice-run-state.test.ts
//
// SEE: apps/mobile/src/utils/practice-run-state.ts

import { describe, expect, it } from "@jest/globals";
import type { MistakePage, MonthSpend, Profile, WordPage } from "@fluency-lab/shared";

import type { DataOutcome } from "@/data/data-port";
import type { KeyPresenceOutcome } from "@/keys/key-port";
import type { PracticeOrigin } from "@/utils/practice-focus";

import {
  practiceNotFoundMessage,
  practiceNotice,
  practiceRunView,
} from "@/utils/practice-run-state";
import { roundRequest } from "@/utils/practice-prompt";
import { practiceStep } from "@/utils/practice-run";
import {
  completedProfile,
  mistakeGroupWith,
  practiceItemWith,
  practiceTodayWith,
} from "../helpers/fake-data";

const key: KeyPresenceOutcome = { ok: true, value: true };
const profileValue: Profile = {
  ...completedProfile(),
  level: "intermediate",
  monthlyLimitUsd: 10,
};
const profile: DataOutcome<Profile> = { ok: true, value: profileValue };
const spend: DataOutcome<MonthSpend> = {
  ok: true,
  value: { monthStart: "2026-11-01", spentUsd: 1 },
};
const mistakes: DataOutcome<MistakePage> = {
  ok: true,
  value: { items: [mistakeGroupWith()], nextOffset: null },
};
const words: DataOutcome<WordPage> = {
  ok: true,
  value: { items: [{ word: "catchy", sentence: "s", day: "2026-11-05" }], nextOffset: null },
};
const newMistakes: PracticeOrigin = { kind: "new", input: { focus: "mistakes", target: 5 } };

type ViewInput = Parameters<typeof practiceRunView>[0];
const base: ViewInput = {
  key,
  profile,
  spend,
  origin: newMistakes,
  opened: null,
  mistakes,
  words: null,
  language: null,
};

describe("practiceRunView", () => {
  it("is no_key without a key", () => {
    expect(practiceRunView({ ...base, key: { ok: true, value: false }, spend: null })).toEqual({
      kind: "no_key",
    });
  });

  it("fails when the key cannot be read", () => {
    const view = practiceRunView({
      ...base,
      key: { ok: false, failure: "not_read", cause: { name: "KeyRead", detail: null } },
    });
    expect(view.kind).toBe("failed");
  });

  it("fails on a profile, spend or run read failure", () => {
    const failed = { ok: false, failure: "network" } as const;
    expect(practiceRunView({ ...base, profile: failed }).kind).toBe("failed");
    expect(practiceRunView({ ...base, spend: failed }).kind).toBe("failed");
    expect(
      practiceRunView({
        ...base,
        origin: { kind: "resume", runId: "run-1" },
        opened: failed,
      }).kind,
    ).toBe("failed");
  });

  it("fails on the focus data read the run needs", () => {
    const failed = { ok: false, failure: "network" } as const;
    expect(practiceRunView({ ...base, mistakes: failed }).kind).toBe("failed");
  });

  it("fails with not found for another user's run", () => {
    expect(
      practiceRunView({
        ...base,
        origin: { kind: "resume", runId: "run-1" },
        opened: { ok: false, failure: "not_found" },
      }),
    ).toEqual({ kind: "failed", message: practiceNotFoundMessage });
  });

  it("fails with not found for an unknown origin", () => {
    expect(practiceRunView({ ...base, origin: null })).toEqual({
      kind: "failed",
      message: practiceNotFoundMessage,
    });
  });

  it("is loading until the reads it needs are done", () => {
    expect(practiceRunView({ ...base, spend: null })).toEqual({ kind: "loading" });
    expect(practiceRunView({ ...base, mistakes: null })).toEqual({ kind: "loading" });
    expect(
      practiceRunView({ ...base, origin: { kind: "resume", runId: "run-1" }, opened: null }),
    ).toEqual({ kind: "loading" });
  });

  it("is ready for a new run and creates it first", () => {
    const view = practiceRunView(base);
    expect(view.kind === "ready" && view.run.phase).toBe("creating");
    expect(view.kind === "ready" && view.run.displayName).toBe(null);
    expect(view.kind === "ready" && view.run.spentUsd).toBe(1);
  });

  it("needs no focus read for a topic run and sends the topic with the level", () => {
    const view = practiceRunView({
      ...base,
      origin: { kind: "new", input: { focus: "topic", topicId: "conditionals", target: 10 } },
      mistakes: null,
    });
    expect(view.kind === "ready" && view.run.focus).toEqual({
      kind: "topic",
      topic: "Conditionals",
      level: "intermediate",
    });
  });

  it("reads the words for a words run", () => {
    expect(
      practiceRunView({
        ...base,
        origin: { kind: "new", input: { focus: "words", target: 5 } },
        mistakes: null,
        words: null,
      }),
    ).toEqual({ kind: "loading" });
    const view = practiceRunView({
      ...base,
      origin: { kind: "new", input: { focus: "words", target: 5 } },
      mistakes: null,
      words,
    });
    expect(view.kind === "ready" && view.run.focus).toEqual({ kind: "words", words: ["catchy"] });
  });

  it("is ready for a resumed run with its items", () => {
    const view = practiceRunView({
      ...base,
      origin: { kind: "resume", runId: "run-1" },
      opened: { ok: true, value: practiceTodayWith([practiceItemWith()]) },
    });
    expect(view.kind === "ready" && view.run.phase).toBe("answering");
    expect(view.kind === "ready" && view.run.items).toHaveLength(1);
  });

  it("is ready for a run with no items and asks the round again", () => {
    const view = practiceRunView({
      ...base,
      origin: { kind: "resume", runId: "run-1" },
      opened: { ok: true, value: practiceTodayWith([]) },
    });
    expect(view.kind).toBe("ready");
    if (view.kind !== "ready") return;
    expect(view.run.phase).toBe("asking");
    expect(practiceStep(view.run)).toEqual({
      kind: "round",
      request: roundRequest({
        focus: view.run.focus,
        count: 5,
        missedRules: [],
        language: null,
      }),
    });
  });

  it("carries the name and the language", () => {
    const view = practiceRunView({
      ...base,
      profile: { ok: true, value: { ...profileValue, displayName: "Maxi" } },
      language: "es-AR",
    });
    expect(view.kind === "ready" && [view.run.displayName, view.run.language]).toEqual([
      "Maxi",
      "es-AR",
    ]);
  });
});

describe("practiceNotice", () => {
  function ready(spentUsd: number, provider: "claude" | "openai" = "claude") {
    const view = practiceRunView({
      ...base,
      profile: { ok: true, value: { ...profileValue, provider } },
      spend: { ok: true, value: { monthStart: "2026-11-01", spentUsd } },
    });
    if (view.kind !== "ready") throw new Error("expected ready");
    return view.run;
  }

  it("has no notice under the limit", () => {
    expect(practiceNotice(ready(1))).toBeNull();
  });

  it("warns at 80% and blocks at 100%", () => {
    expect(practiceNotice(ready(8))?.kind).toBe("warning");
    expect(practiceNotice(ready(10))?.kind).toBe("limit");
  });

  it("says OpenAI is not supported yet", () => {
    expect(practiceNotice(ready(0, "openai"))?.kind).toBe("unsupported");
  });
});
