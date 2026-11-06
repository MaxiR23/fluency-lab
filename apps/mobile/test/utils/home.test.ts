// apps/mobile/test/utils/home.test.ts
//
// Tests for the Home greeting and the Continue card.
//
// Tested:
// - greeting and continueCard
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/home.test.ts
//
// SEE: apps/mobile/src/utils/home.ts

import { describe, expect, it } from "@jest/globals";

import { continueCard, greeting } from "@/utils/home";
import { activeSessionWith } from "../helpers/fake-data";

const now = Date.parse("2026-11-05T12:00:00Z");

describe("greeting", () => {
  it("greets by display name", () => {
    expect(greeting("Maxi")).toBe("Hi, Maxi");
  });

  it("trims the display name", () => {
    expect(greeting("  Maxi  ")).toBe("Hi, Maxi");
  });

  it("says Hi without a display name", () => {
    expect(greeting(null)).toBe("Hi");
  });

  it("says Hi for an empty or blank display name", () => {
    expect(greeting("")).toBe("Hi");
    expect(greeting("   ")).toBe("Hi");
  });
});

describe("continueCard", () => {
  it("shows the session title, the last message and its relative time", () => {
    const active = activeSessionWith(
      {},
      { text: "How was your trip?", createdAt: "2026-11-05T11:55:00Z" },
    );
    expect(continueCard(active, now)).toEqual({
      title: "Travel",
      preview: "How was your trip?",
      time: "5 min ago",
    });
  });

  it("shows No messages yet and the session's update time when there is no message", () => {
    const active = activeSessionWith({ updatedAt: "2026-11-05T09:00:00Z" }, null);
    expect(continueCard(active, now)).toEqual({
      title: "Travel",
      preview: "No messages yet",
      time: "3 h ago",
    });
  });

  it("has no time when the date cannot be read", () => {
    const active = activeSessionWith({}, { createdAt: "not a date" });
    expect(continueCard(active, now).time).toBeNull();
  });
});
