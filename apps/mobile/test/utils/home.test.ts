// apps/mobile/test/utils/home.test.ts
//
// Tests for the Home greeting, the avatar initial and the Continue card.
//
// Tested:
// - greeting by the hour and the display name
// - avatarInitial from the display name
// - continueCard title, meta and icon
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/home.test.ts
//
// SEE: apps/mobile/src/utils/home.ts

import { describe, expect, it } from "@jest/globals";

import { avatarInitial, continueCard, greeting } from "@/utils/home";
import { activeSessionWith } from "../helpers/fake-data";

const now = Date.parse("2026-11-05T12:00:00Z");

// INFO: the local-time constructor keeps these independent of the machine's zone.
function at(hour: number, minute: number): Date {
  return new Date(2026, 10, 5, hour, minute);
}

describe("greeting", () => {
  it("says good morning from 5:00 to 11:59", () => {
    expect(greeting(null, at(5, 0))).toBe("Good morning");
    expect(greeting(null, at(11, 59))).toBe("Good morning");
  });

  it("says good afternoon from 12:00 to 17:59", () => {
    expect(greeting(null, at(12, 0))).toBe("Good afternoon");
    expect(greeting(null, at(17, 59))).toBe("Good afternoon");
  });

  it("says good evening from 18:00 to 4:59", () => {
    expect(greeting(null, at(18, 0))).toBe("Good evening");
    expect(greeting(null, at(23, 59))).toBe("Good evening");
    expect(greeting(null, at(0, 0))).toBe("Good evening");
    expect(greeting(null, at(4, 59))).toBe("Good evening");
  });

  it("adds the trimmed display name", () => {
    expect(greeting("  Maxi  ", at(9, 0))).toBe("Good morning, Maxi");
  });

  it("has no name for null, empty or blank", () => {
    expect(greeting(null, at(9, 0))).toBe("Good morning");
    expect(greeting("", at(9, 0))).toBe("Good morning");
    expect(greeting("   ", at(9, 0))).toBe("Good morning");
  });
});

describe("avatarInitial", () => {
  it("is the upper-cased first letter of the name", () => {
    expect(avatarInitial("maxi")).toBe("M");
  });

  it("ignores leading spaces", () => {
    expect(avatarInitial("  ada")).toBe("A");
  });

  it("keeps a character outside the basic plane whole", () => {
    expect(avatarInitial("𝒜da")).toBe("𝒜");
  });

  it("is null without a name", () => {
    expect(avatarInitial(null)).toBeNull();
    expect(avatarInitial("")).toBeNull();
    expect(avatarInitial("   ")).toBeNull();
  });
});

describe("continueCard", () => {
  it("joins the topic label and the relative time", () => {
    const active = activeSessionWith(
      { topicId: "job_interviews", title: "Job interviews" },
      { createdAt: "2026-11-04T12:00:00Z" },
    );
    expect(continueCard(active, now)).toEqual({
      title: "Job interviews",
      meta: "Job interviews · yesterday",
      icon: "briefcase",
    });
  });

  it("names a free chat 'Free chat' with the chat icon", () => {
    const active = activeSessionWith(
      { topicId: null, title: "Free chat" },
      { createdAt: "2026-11-05T11:55:00Z" },
    );
    expect(continueCard(active, now)).toEqual({
      title: "Free chat",
      meta: "Free chat · 5 min ago",
      icon: "chat",
    });
  });

  it("uses the session's update time when it has no message", () => {
    const active = activeSessionWith({ updatedAt: "2026-11-05T09:00:00Z" }, null);
    expect(continueCard(active, now).meta).toBe("Free chat · 3 h ago");
  });

  it("drops the time when it cannot be read", () => {
    const active = activeSessionWith({ topicId: "music" }, { createdAt: "not a date" });
    expect(continueCard(active, now).meta).toBe("Music");
  });
});
