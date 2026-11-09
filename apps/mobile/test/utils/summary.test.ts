// apps/mobile/test/utils/summary.test.ts
//
// Tests for the Summary pure functions.
//
// Tested:
// - summaryFromReads, summaryReducer and initialSummary
// - summaryParams
// - summaryHeading, summarySubtitle and summaryStats
// - practiceAgainHref
// - A topic outside the catalog is joined by its raw id and opens a free chat
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/summary.test.ts
//
// SEE: apps/mobile/src/utils/summary.ts

import { describe, expect, it } from "@jest/globals";

import {
  initialSummary,
  practiceAgainHref,
  summaryFromReads,
  summaryHeading,
  summaryParams,
  summaryReducer,
  summaryStats,
  summarySubtitle,
} from "@/utils/summary";
import { completedProfile, summaryWith } from "../helpers/fake-data";

const profile = completedProfile();
const summary = summaryWith({ messageCount: 3 });

describe("summaryFromReads, summaryReducer and initialSummary", () => {
  it("is ready with the profile and the summary when both reads succeed", () => {
    expect(summaryFromReads({ ok: true, value: profile }, { ok: true, value: summary })).toEqual({
      kind: "ready",
      profile,
      summary,
    });
  });

  it("fails with the profile's failure", () => {
    expect(
      summaryFromReads({ ok: false, failure: "network" }, { ok: false, failure: "not_found" }),
    ).toEqual({ kind: "failed", failure: "network" });
  });

  it("fails with the summary's failure, not_found included", () => {
    expect(
      summaryFromReads({ ok: true, value: profile }, { ok: false, failure: "not_found" }),
    ).toEqual({ kind: "failed", failure: "not_found" });
  });

  it("goes back to loading on load_started and folds the reads on loaded", () => {
    const failed = { kind: "failed", failure: "unavailable" } as const;
    expect(summaryReducer(failed, { type: "load_started" })).toEqual({ kind: "loading" });
    expect(
      summaryReducer(
        { kind: "loading" },
        {
          type: "loaded",
          profile: { ok: true, value: profile },
          summary: { ok: true, value: summary },
        },
      ),
    ).toEqual({ kind: "ready", profile, summary });
  });

  it("starts loading for a session id", () => {
    expect(initialSummary("session-1")).toEqual({ kind: "loading" });
  });

  it("starts failed as not_found without a session id", () => {
    expect(initialSummary(null)).toEqual({ kind: "failed", failure: "not_found" });
  });
});

describe("summaryParams", () => {
  it("reads the session id and opens from chat by default", () => {
    expect(summaryParams({ session: "s1" })).toEqual({ sessionId: "s1", from: "chat" });
  });

  it("opens from history only for from=history", () => {
    expect(summaryParams({ session: "s1", from: "history" }).from).toBe("history");
    expect(summaryParams({ session: "s1", from: "other" }).from).toBe("chat");
  });

  it("reads the first of repeated params and treats an empty session as missing", () => {
    expect(summaryParams({ session: ["s1", "s2"], from: ["history", "chat"] })).toEqual({
      sessionId: "s1",
      from: "history",
    });
    expect(summaryParams({ session: "" }).sessionId).toBeNull();
    expect(summaryParams({}).sessionId).toBeNull();
  });
});

describe("summaryHeading", () => {
  it("names the learner", () => {
    expect(summaryHeading("Maxi")).toBe("Nice work, Maxi!");
  });

  it("says Nice work! without a name or with a blank name", () => {
    expect(summaryHeading(null)).toBe("Nice work!");
    expect(summaryHeading("   ")).toBe("Nice work!");
  });

  it("trims the name", () => {
    expect(summaryHeading(" Maxi ")).toBe("Nice work, Maxi!");
  });
});

describe("summarySubtitle", () => {
  it("joins the title and the topic with a middle dot", () => {
    const { session } = summaryWith(
      {},
      { title: "Tell me about yourself", topicId: "job_interviews" },
    );
    expect(summarySubtitle(session)).toBe("Tell me about yourself · Job interviews");
  });

  it("is only the title for a free chat or a goal starter", () => {
    expect(summarySubtitle(summaryWith({}, { title: "Free chat" }).session)).toBe("Free chat");
    expect(summarySubtitle(summaryWith({}, { title: "Talk about work" }).session)).toBe(
      "Talk about work",
    );
  });

  it("is only the title when it is the topic's own label", () => {
    const { session } = summaryWith({}, { title: "Job interviews", topicId: "job_interviews" });
    expect(summarySubtitle(session)).toBe("Job interviews");
  });

  it("joins the raw id for a topic outside the catalog", () => {
    const { session } = summaryWith({}, { title: "Cooking", topicId: "cooking" });
    expect(summarySubtitle(session)).toBe("Cooking · cooking");
  });
});

describe("summaryStats", () => {
  it("lists messages, corrections and new words in that order", () => {
    const stats = summaryStats(
      summaryWith({
        messageCount: 14,
        corrections: [
          { original: "a", corrected: "b" },
          { original: "c", corrected: "d" },
          { original: "e", corrected: "f" },
        ],
        newWords: ["x", "y"],
      }),
    );
    expect(stats).toEqual([
      { value: "14", label: "Messages" },
      { value: "3", label: "Corrections" },
      { value: "2", label: "New words" },
    ]);
  });

  it("shows zeros for an empty session", () => {
    expect(summaryStats(summaryWith())).toEqual([
      { value: "0", label: "Messages" },
      { value: "0", label: "Corrections" },
      { value: "0", label: "New words" },
    ]);
  });
});

describe("practiceAgainHref", () => {
  it("opens a chat on the session's topic", () => {
    const { session } = summaryWith({}, { topicId: "job_interviews" });
    expect(practiceAgainHref(session)).toEqual({
      pathname: "/chat",
      params: { topic: "job_interviews" },
    });
  });

  it("opens a free chat for a session without a topic", () => {
    expect(practiceAgainHref(summaryWith().session)).toBe("/chat");
  });

  it("opens a free chat for a topic outside the catalog", () => {
    expect(practiceAgainHref(summaryWith({}, { topicId: "cooking" }).session)).toBe("/chat");
  });
});

describe("summaryReducer Try again", () => {
  const network = { kind: "failed", failure: "network" } as const;

  it("keeps a network failure on screen as retrying when Try again starts", () => {
    expect(summaryReducer(network, { type: "load_started" })).toEqual({
      kind: "failed",
      failure: "network",
      retrying: true,
    });
  });

  it("goes back to loading when Try again starts after a failure that is not the network", () => {
    expect(
      summaryReducer({ kind: "failed", failure: "unavailable" }, { type: "load_started" }),
    ).toEqual({ kind: "loading" });
  });

  it("draws the data when the retried read succeeds", () => {
    const retrying = summaryReducer(network, { type: "load_started" });
    expect(
      summaryReducer(retrying, {
        type: "loaded",
        profile: { ok: true, value: profile },
        summary: { ok: true, value: summary },
      }).kind,
    ).toBe("ready");
  });

  it("draws a fresh failure, not retrying, when the retried read fails again", () => {
    const retrying = summaryReducer(network, { type: "load_started" });
    const again = summaryReducer(retrying, {
      type: "loaded",
      profile: { ok: false, failure: "network" },
      summary: { ok: true, value: summary },
    });
    expect(again).toEqual({ kind: "failed", failure: "network" });
    expect(again).not.toHaveProperty("retrying");
  });
});
