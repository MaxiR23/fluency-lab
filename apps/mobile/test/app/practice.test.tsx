// apps/mobile/test/app/practice.test.tsx
//
// Tests for the Practice focus screen.
//
// Tested:
// - Loading, the failed state with Try again, and Back
// - For you: the mistakes and words rows with their summaries and the default selection
// - A learner with no mistakes and no words sees only the topics, suggested first
// - The exercise count picker defaults to 5 and changes
// - Start practice pushes the practice run with the chosen focus and count
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/app/practice.test.tsx
//
// SEE: apps/mobile/src/app/practice.tsx

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";

import { dataFailureMessage } from "@/utils/data-message";
import { fakeSession, resetFakeAuth } from "../helpers/fake-auth";
import {
  fakeData,
  mistakeGroupWith,
  newWordWith,
  profileWith,
  resetFakeData,
} from "../helpers/fake-data";
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

const intermediate = profileWith({
  level: "intermediate",
  onboardingCompletedAt: "2026-11-05T10:00:00Z",
});

function withLearnerData() {
  fakeData.listMistakes.mockResolvedValue({
    ok: true,
    value: {
      items: ["Present perfect", "Articles", "Tenses", "Modals"].map((rule) =>
        mistakeGroupWith({ rule }),
      ),
      nextOffset: null,
    },
  });
  fakeData.listWords.mockResolvedValue({
    ok: true,
    value: {
      items: ["definitely", "set foot in", "catchy"].map((word) => newWordWith({ word })),
      nextOffset: null,
    },
  });
}

describe("Practice", () => {
  beforeEach(() => {
    resetFakeAuth();
    resetFakeData();
    resetFakeKeys();
    fakeData.getProfile.mockResolvedValue({ ok: true, value: intermediate });
  });

  it("draws the loading state while the reads run", async () => {
    let finish!: (value: Awaited<ReturnType<typeof fakeData.listMistakes>>) => void;
    fakeData.listMistakes
      .mockResolvedValueOnce({ ok: true, value: { items: [], nextOffset: null } })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
    await renderAppAt("/practice", fakeSession());
    expect(screen.getByTestId("practice-loading")).toBeTruthy();
    await act(async () => finish({ ok: true, value: { items: [], nextOffset: null } }));
    expect(screen.queryByTestId("practice-loading")).toBeNull();
  });

  it("draws the failure and reads again on Try again", async () => {
    fakeData.listMistakes
      .mockResolvedValueOnce({ ok: true, value: { items: [], nextOffset: null } })
      .mockResolvedValueOnce({ ok: false, failure: "network" });
    await renderAppAt("/practice", fakeSession());
    expect(screen.getByText(dataFailureMessage("network"))).toBeTruthy();
    fakeData.listMistakes.mockResolvedValue({ ok: true, value: { items: [], nextOffset: null } });
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(screen.queryByText(dataFailureMessage("network"))).toBeNull();
    expect(screen.getByRole("button", { name: "Start practice" })).toBeTruthy();
  });

  it("draws the header with Back to Home", async () => {
    await renderAppAt("/practice", fakeSession());
    expect(screen.getByRole("header", { name: "Practice" })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Back to Home" }));
    expect(screen).toHavePathname("/");
  });

  it("draws the mistakes and words rows with their summaries, mistakes selected", async () => {
    withLearnerData();
    await renderAppAt("/practice", fakeSession());
    expect(screen.getByText("For you")).toBeTruthy();
    const mistakes = screen.getByRole("radio", { name: "From your mistakes" });
    expect(mistakes.props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByText("Present perfect, articles and 2 more")).toBeTruthy();
    const words = screen.getByRole("radio", { name: "Your new words" });
    expect(words.props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.getByText("definitely, set foot in and 1 more")).toBeTruthy();
  });

  it("selects the words row when it is pressed", async () => {
    withLearnerData();
    await renderAppAt("/practice", fakeSession());
    await fireEvent.press(screen.getByRole("radio", { name: "Your new words" }));
    expect(
      screen.getByRole("radio", { name: "Your new words" }).props.accessibilityState,
    ).toMatchObject({ selected: true });
    expect(
      screen.getByRole("radio", { name: "From your mistakes" }).props.accessibilityState,
    ).toMatchObject({ selected: false });
  });

  it("draws only the topics for a learner with no mistakes and no words", async () => {
    await renderAppAt("/practice", fakeSession());
    expect(screen.queryByText("For you")).toBeNull();
    expect(screen.queryByRole("radio", { name: "From your mistakes" })).toBeNull();
    expect(screen.getByText("Or pick a topic")).toBeTruthy();
    expect(screen.getByText("Suggested for Intermediate")).toBeTruthy();
    const topics = screen
      .getAllByRole("radio")
      .filter((node) => node.props.accessibilityState.checked !== undefined);
    expect(topics.length).toBe(8);
    expect(topics[0]?.props.accessibilityLabel).toBe("Going to vs will");
    expect(topics[0]?.props.accessibilityState).toMatchObject({ checked: true });
  });

  it("draws no suggested label when the level is not set", async () => {
    fakeData.getProfile.mockResolvedValue({
      ok: true,
      value: profileWith({ onboardingCompletedAt: "2026-11-05T10:00:00Z" }),
    });
    await renderAppAt("/practice", fakeSession());
    expect(screen.queryByText(/^Suggested for/)).toBeNull();
    expect(screen.getByRole("radio", { name: "Going to vs will" })).toBeTruthy();
  });

  it("selects a topic and deselects the mistakes", async () => {
    withLearnerData();
    await renderAppAt("/practice", fakeSession());
    await fireEvent.press(screen.getByRole("radio", { name: "Conditionals" }));
    expect(
      screen.getByRole("radio", { name: "Conditionals" }).props.accessibilityState,
    ).toMatchObject({ checked: true });
    expect(
      screen.getByRole("radio", { name: "From your mistakes" }).props.accessibilityState,
    ).toMatchObject({ selected: false });
  });

  it("draws the count picker on 5 and the hint", async () => {
    await renderAppAt("/practice", fakeSession());
    expect(screen.getByText("Exercises")).toBeTruthy();
    expect(screen.getByLabelText("Number of exercises")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "5" }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByText("Miss one and 5 more come in, up to 15.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("radio", { name: "10" }));
    expect(screen.getByRole("radio", { name: "10" }).props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it("starts a mistakes practice with the chosen count", async () => {
    withLearnerData();
    await renderAppAt("/practice", fakeSession());
    await fireEvent.press(screen.getByRole("radio", { name: "15" }));
    await fireEvent.press(screen.getByRole("button", { name: "Start practice" }));
    expect(screen).toHavePathname("/practice-run");
    expect(screen).toHaveSearchParams({ focus: "mistakes", target: "15" });
  });

  it("starts a topic practice with the topic", async () => {
    await renderAppAt("/practice", fakeSession());
    await fireEvent.press(screen.getByRole("radio", { name: "Articles" }));
    await fireEvent.press(screen.getByRole("button", { name: "Start practice" }));
    expect(screen).toHavePathname("/practice-run");
    expect(screen).toHaveSearchParams({ focus: "topic", topic: "articles", target: "5" });
  });
});
