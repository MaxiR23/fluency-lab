// apps/mobile/test/app/edit-profile.test.tsx
//
// Tests for the edit screen (name, limit, provider, level, goals and topics).
//
// Tested:
// - Loading, with data, error and an unknown field
// - The name: saves only displayName, a blank name and an 81 character name save nothing
// - The limit: saves 25.5, 0 and 1.234 show the onboarding error and save nothing
// - The provider, the level, the goals and the topics follow the onboarding rules and save
// - The save failure, Back
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/app/edit-profile.test.tsx
//
// SEE: apps/mobile/src/app/edit-profile.tsx

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";

import { dataFailureMessage } from "@/utils/data-message";
import { fakeSession, resetFakeAuth } from "../helpers/fake-auth";
import { completedProfile, fakeData, profileWith, resetFakeData } from "../helpers/fake-data";
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const ada = profileWith({
  displayName: "Ada",
  level: "intermediate",
  goals: ["work"],
  topics: ["food", "music", "travel"],
  provider: "claude",
  monthlyLimitUsd: 10,
  onboardingCompletedAt: "2026-11-05T10:00:00Z",
});

async function openEdit(field: string, profile = ada) {
  fakeData.getProfile.mockResolvedValue({ ok: true, value: profile });
  fakeData.updateProfile.mockResolvedValue({ ok: true, value: profile });
  await renderAppAt({ pathname: "/edit-profile", params: { field } }, fakeSession());
}

async function save() {
  await fireEvent.press(screen.getByRole("button", { name: "Save" }));
}

describe("Edit profile", () => {
  beforeEach(() => {
    resetFakeAuth();
    resetFakeData();
    resetFakeKeys();
  });

  it("draws the loading state", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fakeData.getProfile>>>();
    const done = { ok: true, value: ada } as const;
    // INFO: the onboarding gate and Home read the profile first; the edit screen is the third read.
    fakeData.getProfile
      .mockResolvedValueOnce(done)
      .mockResolvedValueOnce(done)
      .mockReturnValueOnce(pending.promise);
    await renderAppAt({ pathname: "/edit-profile", params: { field: "name" } }, fakeSession());
    expect(screen.getByTestId("edit-loading")).toBeTruthy();
    await act(async () => pending.resolve(done));
    expect(screen.queryByTestId("edit-loading")).toBeNull();
    expect(screen.getByLabelText("Name")).toBeTruthy();
  });

  it("draws the failure and reads again", async () => {
    const done = { ok: true, value: ada } as const;
    fakeData.getProfile
      .mockResolvedValueOnce(done)
      .mockResolvedValueOnce(done)
      .mockResolvedValueOnce({ ok: false, failure: "network" })
      .mockResolvedValue(done);
    await renderAppAt({ pathname: "/edit-profile", params: { field: "name" } }, fakeSession());
    expect(screen.getByText(dataFailureMessage("network"))).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByLabelText("Name")).toBeTruthy();
  });

  it("edits the name and saves only displayName", async () => {
    await openEdit("name");
    expect(screen.getByText("Your name")).toBeTruthy();
    expect(screen.getByLabelText("Name").props.value).toBe("Ada");
    await fireEvent.changeText(screen.getByLabelText("Name"), "Grace");
    await save();
    expect(fakeData.updateProfile).toHaveBeenCalledWith({ displayName: "Grace" });
    expect(screen).toHavePathname("/");
  });

  it("shows Enter your name. and saves nothing for a blank name", async () => {
    await openEdit("name");
    await fireEvent.changeText(screen.getByLabelText("Name"), "   ");
    await save();
    expect(screen.getByText("Enter your name.")).toBeTruthy();
    expect(fakeData.updateProfile).not.toHaveBeenCalled();
    expect(screen).toHavePathname("/edit-profile");
  });

  it("rejects an 81 character name", async () => {
    await openEdit("name");
    await fireEvent.changeText(screen.getByLabelText("Name"), "a".repeat(81));
    await save();
    expect(screen.getByText("Use at most 80 characters.")).toBeTruthy();
    expect(fakeData.updateProfile).not.toHaveBeenCalled();
  });

  it("saves a limit of 25.5", async () => {
    await openEdit("limit");
    expect(screen.getByText("Monthly limit")).toBeTruthy();
    expect(screen.getByLabelText("Monthly limit (USD)").props.value).toBe("10");
    await fireEvent.changeText(screen.getByLabelText("Monthly limit (USD)"), "25.5");
    await save();
    expect(fakeData.updateProfile).toHaveBeenCalledWith({ monthlyLimitUsd: 25.5 });
  });

  it("shows the limit error for 0 and for 1.234 and saves nothing", async () => {
    await openEdit("limit");
    for (const bad of ["0", "1.234"]) {
      await fireEvent.changeText(screen.getByLabelText("Monthly limit (USD)"), bad);
      await save();
      expect(
        screen.getByText("Enter an amount between 0.01 and 10000, with at most two decimals."),
      ).toBeTruthy();
    }
    expect(fakeData.updateProfile).not.toHaveBeenCalled();
  });

  it("saves the provider", async () => {
    await openEdit("provider");
    await fireEvent.press(screen.getByRole("radio", { name: "OpenAI" }));
    await save();
    expect(fakeData.updateProfile).toHaveBeenCalledWith({ provider: "openai" });
  });

  it("starts on the current level and saves the new one", async () => {
    await openEdit("level");
    expect(
      screen.getByRole("radio", { name: "Intermediate" }).props.accessibilityState,
    ).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByRole("radio", { name: "Advanced" }));
    await save();
    expect(fakeData.updateProfile).toHaveBeenCalledWith({ level: "advanced" });
  });

  it("disables Save with no goal, saves two goals", async () => {
    await openEdit("goals", profileWith({ ...ada, goals: [] }));
    expect(screen.getByRole("button", { name: "Save", disabled: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole("checkbox", { name: "Work" }));
    await fireEvent.press(screen.getByRole("checkbox", { name: "Travel" }));
    await save();
    expect(fakeData.updateProfile).toHaveBeenCalledWith({ goals: ["work", "travel"] });
  });

  it("disables Save with two topics and enables it at three", async () => {
    await openEdit("topics", profileWith({ ...ada, topics: ["food", "music"] }));
    expect(screen.getByText("2 selected")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save", disabled: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole("checkbox", { name: "Travel" }));
    expect(screen.getByText("3 selected")).toBeTruthy();
    await save();
    expect(fakeData.updateProfile).toHaveBeenCalledWith({ topics: ["food", "music", "travel"] });
  });

  it("shows the save failure and stays", async () => {
    await openEdit("provider");
    fakeData.updateProfile.mockResolvedValue({ ok: false, failure: "network" });
    await save();
    expect(screen.getByText(dataFailureMessage("network"))).toBeTruthy();
    expect(screen).toHavePathname("/edit-profile");
  });

  it("goes back on Back", async () => {
    await openEdit("name");
    await fireEvent.press(screen.getByRole("link", { name: "Back" }));
    expect(screen).toHavePathname("/");
  });

  it("draws the generic failure for an unknown field", async () => {
    await openEdit("email", completedProfile());
    expect(screen.getByText(dataFailureMessage("not_found"))).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    await fireEvent.press(screen.getByRole("link", { name: "Back" }));
    expect(screen).toHavePathname("/");
  });
});
