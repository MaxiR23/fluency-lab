// packages/shared/test/session-title.test.ts
//
// Tests for the title of a new session.
//
// Tested:
// - A topic session is titled with the topic label
// - A free chat is titled "Free chat"
// - A topic outside the catalog is titled with its raw id
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec vitest run packages/shared/test/session-title.test.ts
//
// SEE: packages/shared/src/session-title.ts

import { describe, expect, it } from "vitest";
import { sessionTitle } from "../src/session-title";
import { TOPICS } from "../src/topics";

describe("sessionTitle", () => {
  it("titles a topic session with the topic label", () => {
    expect(sessionTitle("food")).toBe("Food");
  });

  it("titles a free chat 'Free chat'", () => {
    expect(sessionTitle(null)).toBe("Free chat");
  });

  it("titles a session on a topic outside the catalog with the raw id", () => {
    expect(sessionTitle("cooking")).toBe("cooking");
  });

  it("titles every catalog topic with its own label", () => {
    for (const topic of TOPICS) expect(sessionTitle(topic.id)).toBe(topic.label);
  });
});
