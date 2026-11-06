// apps/mobile/test/app/suggestions.test.tsx
//
// Tests for the list of every suggestion.
//
// Tested:
// - Loading, the list for the profile's level and the error state
// - Back goes to Home and a suggestion opens Chat
//
// What is covered:
// - Normal case, error case. The empty view is covered by suggestion-list.test.ts,
//   since the real catalog always has starters for a level.
//
// Run with: pnpm exec jest apps/mobile/test/app/suggestions.test.tsx
//
// SEE: apps/mobile/src/app/suggestions.tsx

import { STARTERS, allSuggestions } from "@fluency-lab/shared";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";

import { dataFailureMessage } from "@/utils/data-message";
import { fakeSession, resetFakeAuth } from "../helpers/fake-auth";
import { fakeData, profileWith, resetFakeData } from "../helpers/fake-data";
import { resetFakeKeys } from "../helpers/fake-keys";
import { renderAppAt } from "../helpers/render-app";

jest.mock("expo-font", () => ({ useFonts: jest.fn(() => [true, null]) }));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hide: jest.fn(),
}));
jest.mock("@/data", () => ({
  data: jest.requireActual<typeof import("../helpers/fake-data")>("../helpers/fake-data").fakeData,
}));
jest.mock("@/keys", () => ({
  keys: jest.requireActual<typeof import("../helpers/fake-keys")>("../helpers/fake-keys").fakeKeys,
}));
jest.mock("@/auth", () => {
  const fake = jest.requireActual<typeof import("../helpers/fake-auth")>("../helpers/fake-auth");
  return { auth: fake.fakeAuth, apple: fake.fakeApple };
});

const beginner = profileWith({
  level: "beginner",
  topics: ["music"],
  goals: ["work"],
  onboardingCompletedAt: "2026-11-05T10:00:00Z",
});

describe("Suggestions", () => {
  beforeEach(() => {
    resetFakeAuth();
    resetFakeData();
    resetFakeKeys();
    fakeData.getProfile.mockResolvedValue({ ok: true, value: beginner });
  });

  it("draws the loading state while the profile is read", async () => {
    let finish!: (value: Awaited<ReturnType<typeof fakeData.getProfile>>) => void;
    // INFO: the sign-in guard and Home read first; the third read is this screen's.
    fakeData.getProfile
      .mockResolvedValueOnce({ ok: true, value: beginner })
      .mockResolvedValueOnce({ ok: true, value: beginner })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
    await renderAppAt("/suggestions", fakeSession());
    expect(screen.getByTestId("suggestions-loading")).toBeTruthy();
    await act(async () => finish({ ok: true, value: beginner }));
    expect(screen.queryByTestId("suggestions-loading")).toBeNull();
    expect(screen.getByText("Suggested for you")).toBeTruthy();
  });

  it("lists every suggestion for the profile's level", async () => {
    await renderAppAt("/suggestions", fakeSession());
    expect(screen.getByText("Suggested for you")).toBeTruthy();
    const shown = allSuggestions(beginner);
    expect(shown.length).toBeGreaterThan(6);
    for (const suggestion of shown) {
      expect(screen.getByRole("button", { name: suggestion.title })).toBeTruthy();
    }
    const other = STARTERS.find((entry) => !entry.levels.includes("beginner"));
    expect(other).toBeDefined();
    expect(screen.queryByRole("button", { name: other?.title ?? "" })).toBeNull();
  });

  it("draws the failure and reads again on Try again", async () => {
    fakeData.getProfile.mockResolvedValue({ ok: false, failure: "network" });
    await renderAppAt("/suggestions", fakeSession());
    expect(screen.getByText(dataFailureMessage("network"))).toBeTruthy();
    fakeData.getProfile.mockResolvedValue({ ok: true, value: beginner });
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(screen.queryByText(dataFailureMessage("network"))).toBeNull();
    expect(screen.getByText("Suggested for you")).toBeTruthy();
  });

  it("goes back to Home from Back", async () => {
    await renderAppAt("/suggestions", fakeSession());
    await fireEvent.press(screen.getByRole("link", { name: "Back" }));
    expect(screen).toHavePathname("/");
  });

  it("opens Chat from a suggestion", async () => {
    await renderAppAt("/suggestions", fakeSession());
    const [first] = allSuggestions(beginner);
    await fireEvent.press(screen.getByRole("button", { name: first?.title ?? "" }));
    expect(screen).toHavePathname("/chat");
    expect(screen).toHaveSearchParams({ topic: first?.title ?? "" });
  });
});
