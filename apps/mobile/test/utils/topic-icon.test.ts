// apps/mobile/test/utils/topic-icon.test.ts
//
// Tests for the icon of a topic, a goal and a session.
//
// Tested:
// - The topic and goal icon maps
// - starterIcon and sessionIcon
// - sessionIcon falls back to the chat icon for an unknown topic
//
// What is covered:
// - Normal case, edges (a topic outside the catalog). An empty case does not apply: the maps are closed.
//
// Run with: pnpm exec jest apps/mobile/test/utils/topic-icon.test.ts
//
// SEE: apps/mobile/src/utils/topic-icon.ts

import { describe, expect, it } from "@jest/globals";
import { GOALS, TOPIC_IDS } from "@fluency-lab/shared";

import { GOAL_ICONS, TOPIC_ICONS, sessionIcon, starterIcon } from "@/utils/topic-icon";

describe("topic icons", () => {
  it("gives every topic a different icon", () => {
    const icons = TOPIC_IDS.map((id) => TOPIC_ICONS[id]);
    expect(icons).toHaveLength(12);
    expect(new Set(icons).size).toBe(12);
  });

  it("draws Travel as the globe and Job interviews as the briefcase", () => {
    expect(TOPIC_ICONS.travel).toBe("globe");
    expect(TOPIC_ICONS.job_interviews).toBe("briefcase");
  });

  it("gives every goal an icon", () => {
    expect(GOALS.map((goal) => GOAL_ICONS[goal])).toEqual([
      "briefcase",
      "globe",
      "clipboard",
      "chat",
    ]);
  });

  it("uses the topic's icon for a topic starter and the goal's for a goal starter", () => {
    expect(starterIcon({ topicId: "music", goal: null })).toBe("note");
    expect(starterIcon({ topicId: null, goal: "exams" })).toBe("clipboard");
  });

  it("uses the chat icon for a free chat", () => {
    expect(sessionIcon(null)).toBe("chat");
    expect(sessionIcon("travel")).toBe("globe");
  });

  it("uses the chat icon for a topic outside the catalog", () => {
    expect(sessionIcon("cooking")).toBe("chat");
    expect(sessionIcon("")).toBe("chat");
  });
});
