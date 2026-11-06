// apps/mobile/test/app/onboarding.test.tsx
//
// Tests for the onboarding route and the routing around it.
//
// Tested:
// - The profile check states: loading, failure with Try again, unauthorized
// - Sign out from the check failure: success, failure message, busy state
// - Who lands on onboarding and who goes to Home
// - Each of the four steps, their rules and the Back link
// - Finish: validation, the key in secure storage, the profile update, failures
// - Skip for now (it deletes any stored key), Back while saving, and that the key reaches no data call and no request
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/app/onboarding.test.tsx
//
// SEE: apps/mobile/src/app/onboarding.tsx

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ProfileUpdate } from "@fluency-lab/shared";
import { act, fireEvent, screen } from "@testing-library/react-native";

import { authFailureMessage } from "@/utils/auth-message";
import { apiKeyNote, monthlyLimitNote } from "@/utils/onboarding-options";
import {
  dataFailureMessage,
  keyDeleteFailureMessage,
  keySaveFailureMessage,
} from "@/utils/data-message";
import { emitSession, fakeAuth, fakeSession, resetFakeAuth } from "../helpers/fake-auth";
import { completedProfile, fakeData, profileWith, resetFakeData } from "../helpers/fake-data";
import { fakeKeys, resetFakeKeys } from "../helpers/fake-keys";
import { generatedSecret } from "../helpers/generated-secret";
import { renderApp } from "../helpers/render-app";

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

async function openOnboarding() {
  fakeData.getProfile.mockResolvedValue({ ok: true, value: profileWith({}) });
  await renderApp("/onboarding", fakeSession());
}

async function press(name: string) {
  await fireEvent.press(screen.getByRole("button", { name }));
}

async function pickLevel() {
  await fireEvent.press(screen.getByRole("radio", { name: "Beginner" }));
  await press("Continue");
}

async function pickGoal() {
  await fireEvent.press(screen.getByRole("checkbox", { name: "Work" }));
  await press("Continue");
}

async function pickTopics(labels = ["Food", "Music", "Books"]) {
  for (const label of labels) {
    await fireEvent.press(screen.getByRole("checkbox", { name: label }));
  }
}

async function openAiStep() {
  await openOnboarding();
  await pickLevel();
  await pickGoal();
  await pickTopics();
  await press("Continue");
}

const finishUpdate: ProfileUpdate = {
  level: "beginner",
  goals: ["work"],
  topics: ["food", "music", "books"],
  provider: "claude",
  monthlyLimitUsd: 10,
  onboardingCompleted: true,
};
const skipUpdate: ProfileUpdate = {
  level: "beginner",
  goals: ["work"],
  topics: ["food", "music", "books"],
  onboardingCompleted: true,
};

describe("Onboarding profile check", () => {
  beforeEach(() => {
    resetFakeAuth();
    resetFakeData();
    resetFakeKeys();
  });

  it("draws the loading state and no step while the profile loads", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fakeData.getProfile>>>();
    fakeData.getProfile.mockReturnValue(pending.promise);
    await renderApp("/onboarding", fakeSession());
    expect(screen.getByTestId("onboarding-loading")).toBeTruthy();
    expect(screen.queryByText("Step 1 of 4")).toBeNull();
    await act(async () => pending.resolve({ ok: true, value: profileWith({}) }));
  });

  it("draws the failure and reads again on Try again", async () => {
    fakeData.getProfile.mockResolvedValueOnce({ ok: false, failure: "network" });
    fakeData.getProfile.mockResolvedValueOnce({ ok: true, value: profileWith({}) });
    await renderApp("/onboarding", fakeSession());
    expect(screen.getByText(dataFailureMessage("network"))).toBeTruthy();
    expect(screen.queryByText("Step 1 of 4")).toBeNull();
    await press("Try again");
    expect(screen.getByText("Step 1 of 4")).toBeTruthy();
    expect(fakeData.getProfile).toHaveBeenCalledTimes(2);
  });

  it("draws the unauthorized message when the profile read is unauthorized", async () => {
    fakeData.getProfile.mockResolvedValue({ ok: false, failure: "unauthorized" });
    await renderApp("/onboarding", fakeSession());
    expect(screen.getByText(dataFailureMessage("unauthorized"))).toBeTruthy();
  });

  it("signs out from the check failure and lands on Login", async () => {
    fakeData.getProfile.mockResolvedValue({ ok: false, failure: "unauthorized" });
    fakeAuth.signOut.mockImplementation(async () => {
      emitSession(null);
      return { ok: true, value: null };
    });
    await renderApp("/onboarding", fakeSession());
    await press("Sign out");
    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(screen).toHavePathname("/sign-in");
  });

  it("shows the sign out failure and keeps Try again and Sign out", async () => {
    fakeData.getProfile.mockResolvedValue({ ok: false, failure: "network" });
    fakeAuth.signOut.mockResolvedValue({ ok: false, failure: "unknown" });
    await renderApp("/onboarding", fakeSession());
    await press("Sign out");
    expect(screen.getByText(authFailureMessage("unknown"))).toBeTruthy();
    expect(screen.getByText(dataFailureMessage("network"))).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("shows Sign out busy and disabled while the request runs", async () => {
    fakeData.getProfile.mockResolvedValue({ ok: false, failure: "network" });
    const pending = deferred<{ ok: false; failure: "network" }>();
    fakeAuth.signOut.mockReturnValue(pending.promise);
    await renderApp("/onboarding", fakeSession());
    await press("Sign out");
    const busy = screen.getByRole("button", { name: "Sign out", busy: true, disabled: true });
    await fireEvent.press(busy);
    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve({ ok: false, failure: "network" }));
  });
});

describe("Onboarding routing", () => {
  beforeEach(() => {
    resetFakeAuth();
    resetFakeData();
    resetFakeKeys();
  });

  it("lands a new user on onboarding after the first sign-in", async () => {
    fakeData.getProfile.mockResolvedValue({ ok: true, value: profileWith({}) });
    await renderApp("/sign-in", null);
    expect(screen).toHavePathname("/sign-in");
    await act(async () => emitSession(fakeSession()));
    expect(screen).toHavePathname("/onboarding");
    expect(screen.getByText("Step 1 of 4")).toBeTruthy();
  });

  it("sends a user who completed onboarding to Home and never draws a step", async () => {
    await renderApp("/", fakeSession());
    expect(screen).toHavePathname("/");
    expect(screen.queryByText(/Step \d of 4/)).toBeNull();
  });

  it("does not open onboarding when pushed there after completing it", async () => {
    fakeData.getProfile.mockResolvedValue({ ok: true, value: completedProfile() });
    await renderApp("/onboarding", fakeSession());
    expect(screen).toHavePathname("/");
  });

  it("sends a signed out user to Login, not onboarding", async () => {
    await renderApp("/onboarding", null);
    expect(screen).toHavePathname("/sign-in");
    expect(fakeData.getProfile).not.toHaveBeenCalled();
  });
});

describe("Onboarding steps", () => {
  beforeEach(() => {
    resetFakeAuth();
    resetFakeData();
    resetFakeKeys();
  });

  it("draws the three levels with their descriptions", async () => {
    await openOnboarding();
    expect(screen.getByText("Level")).toBeTruthy();
    expect(screen.getByText("Beginner")).toBeTruthy();
    expect(screen.getByText("I can talk about my day, but I make mistakes.")).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("keeps Continue disabled until a level is picked", async () => {
    await openOnboarding();
    expect(screen.getByRole("button", { name: "Continue", disabled: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole("radio", { name: "Beginner" }));
    expect(screen.getByRole("button", { name: "Continue", disabled: false })).toBeTruthy();
  });

  it("selects only one level at a time", async () => {
    await openOnboarding();
    await fireEvent.press(screen.getByRole("radio", { name: "Beginner" }));
    await fireEvent.press(screen.getByRole("radio", { name: "Advanced" }));
    expect(screen.getByRole("radio", { name: "Beginner" }).props.accessibilityState).toMatchObject({
      selected: false,
    });
    expect(screen.getByRole("radio", { name: "Advanced" }).props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it("draws no Back on step 1", async () => {
    await openOnboarding();
    expect(screen.queryByText("Back")).toBeNull();
  });

  it("draws the four goals and Back", async () => {
    await openOnboarding();
    await pickLevel();
    expect(screen.getByText("Step 2 of 4")).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
    expect(screen.getByText("Everyday conversation")).toBeTruthy();
    expect(screen.getByText("Back")).toBeTruthy();
  });

  it("keeps Continue disabled with no goal and enables it with one", async () => {
    await openOnboarding();
    await pickLevel();
    expect(screen.getByRole("button", { name: "Continue", disabled: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole("checkbox", { name: "Work" }));
    expect(screen.getByRole("button", { name: "Continue", disabled: false })).toBeTruthy();
  });

  it("allows several goals", async () => {
    await openOnboarding();
    await pickLevel();
    await fireEvent.press(screen.getByRole("checkbox", { name: "Work" }));
    await fireEvent.press(screen.getByRole("checkbox", { name: "Travel" }));
    expect(screen.getByRole("checkbox", { name: "Work" }).props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.getByRole("checkbox", { name: "Travel" }).props.accessibilityState).toMatchObject(
      {
        checked: true,
      },
    );
  });

  it("returns to step 1 with the level kept on Back", async () => {
    await openOnboarding();
    await pickLevel();
    await fireEvent.press(screen.getByText("Back"));
    expect(screen.getByText("Step 1 of 4")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Beginner" }).props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it("draws every catalog topic as a chip", async () => {
    await openOnboarding();
    await pickLevel();
    await pickGoal();
    expect(screen.getByText("Step 3 of 4")).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(12);
  });

  it("shows the counter and keeps Continue disabled below three topics", async () => {
    await openOnboarding();
    await pickLevel();
    await pickGoal();
    expect(screen.getByText("0 selected")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue", disabled: true })).toBeTruthy();
    await pickTopics(["Food"]);
    expect(screen.getByText("1 selected")).toBeTruthy();
    await pickTopics(["Music"]);
    expect(screen.getByText("2 selected")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue", disabled: true })).toBeTruthy();
  });

  it("enables Continue at three selected", async () => {
    await openOnboarding();
    await pickLevel();
    await pickGoal();
    await pickTopics();
    expect(screen.getByText("3 selected")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue", disabled: false })).toBeTruthy();
  });

  it("unselects a topic on a second press", async () => {
    await openOnboarding();
    await pickLevel();
    await pickGoal();
    await pickTopics(["Food"]);
    await pickTopics(["Food"]);
    expect(screen.getByText("0 selected")).toBeTruthy();
  });
});

describe("Onboarding AI step", () => {
  beforeEach(() => {
    resetFakeAuth();
    resetFakeData();
    resetFakeKeys();
  });

  it("draws Claude selected, the secure key field, the limit of 10 and both notes", async () => {
    await openAiStep();
    expect(screen.getByText("Step 4 of 4")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Claude" }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByLabelText("API key").props.secureTextEntry).toBe(true);
    expect(screen.getByLabelText("Monthly limit (USD)").props.value).toBe("10");
    expect(screen.getByText(apiKeyNote)).toBeTruthy();
    expect(screen.getByText(monthlyLimitNote)).toBeTruthy();
  });

  it("switches the provider to OpenAI", async () => {
    await openAiStep();
    await fireEvent.press(screen.getByRole("radio", { name: "OpenAI" }));
    expect(screen.getByRole("radio", { name: "OpenAI" }).props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it("asks for the key and saves nothing when the key is empty", async () => {
    await openAiStep();
    await press("Finish");
    expect(screen.getByText("Enter your API key, or skip for now.")).toBeTruthy();
    expect(fakeKeys.saveApiKey).not.toHaveBeenCalled();
    expect(fakeData.updateProfile).not.toHaveBeenCalled();
  });

  it("rejects an invalid limit and saves nothing", async () => {
    await openAiStep();
    await fireEvent.changeText(screen.getByLabelText("API key"), generatedSecret("api-key"));
    await fireEvent.changeText(screen.getByLabelText("Monthly limit (USD)"), "0");
    await press("Finish");
    expect(
      screen.getByText("Enter an amount between 0.01 and 10000, with at most two decimals."),
    ).toBeTruthy();
    expect(fakeKeys.saveApiKey).not.toHaveBeenCalled();
    expect(fakeData.updateProfile).not.toHaveBeenCalled();
  });

  it("saves the key in secure storage, then the profile, and lands on Home", async () => {
    const apiKey = generatedSecret("api-key");
    fakeData.updateProfile.mockResolvedValue({ ok: true, value: completedProfile() });
    await openAiStep();
    await fireEvent.changeText(screen.getByLabelText("API key"), `  ${apiKey}  `);
    await press("Finish");
    expect(fakeKeys.saveApiKey).toHaveBeenCalledWith(apiKey);
    expect(fakeData.updateProfile).toHaveBeenCalledWith(finishUpdate);
    expect(fakeKeys.saveApiKey.mock.invocationCallOrder[0]).toBeLessThan(
      fakeData.updateProfile.mock.invocationCallOrder[0] ?? 0,
    );
    expect(screen).toHavePathname("/");
  });

  it("never passes the key to the data port or any request", async () => {
    const apiKey = generatedSecret("api-key");
    const fetchSpy = jest.spyOn(globalThis, "fetch");
    fakeData.updateProfile.mockResolvedValue({ ok: true, value: completedProfile() });
    await openAiStep();
    await fireEvent.changeText(screen.getByLabelText("API key"), apiKey);
    await press("Finish");
    for (const fn of Object.values(fakeData)) {
      expect(JSON.stringify(fn.mock.calls)).not.toContain(apiKey);
    }
    for (const fn of Object.values(fakeAuth)) {
      expect(JSON.stringify(fn.mock.calls)).not.toContain(apiKey);
    }
    expect(JSON.stringify(fetchSpy.mock.calls)).not.toContain(apiKey);
    fetchSpy.mockRestore();
  });

  it("shows the key failure and does not save the profile when secure storage fails", async () => {
    fakeKeys.saveApiKey.mockResolvedValue({ ok: false, failure: "not_saved" });
    await openAiStep();
    await fireEvent.changeText(screen.getByLabelText("API key"), generatedSecret("api-key"));
    await press("Finish");
    expect(screen.getByText(keySaveFailureMessage)).toBeTruthy();
    expect(fakeData.updateProfile).not.toHaveBeenCalled();
    expect(screen.getByText("Step 4 of 4")).toBeTruthy();
  });

  it("shows the save failure and stays on step 4 when the profile update fails", async () => {
    fakeData.updateProfile.mockResolvedValue({ ok: false, failure: "network" });
    await openAiStep();
    await fireEvent.changeText(screen.getByLabelText("API key"), generatedSecret("api-key"));
    await press("Finish");
    expect(screen.getByText(dataFailureMessage("network"))).toBeTruthy();
    expect(screen.getByText("Step 4 of 4")).toBeTruthy();
    expect(screen).toHavePathname("/onboarding");
  });

  it("shows Finish busy and Skip disabled while saving", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fakeData.updateProfile>>>();
    fakeData.updateProfile.mockReturnValue(pending.promise);
    await openAiStep();
    await fireEvent.changeText(screen.getByLabelText("API key"), generatedSecret("api-key"));
    await press("Finish");
    expect(screen.getByRole("button", { name: "Finish", busy: true, disabled: true })).toBeTruthy();
    expect(screen.getByText("Skip for now").props.onPress).toBeUndefined();
    expect(screen.getByText("Back").props.onPress).toBeUndefined();
    expect(screen.getByText("Back").props.disabled).toBe(true);
    await act(async () => pending.resolve({ ok: false, failure: "network" }));
  });
});

describe("Onboarding Skip", () => {
  beforeEach(() => {
    resetFakeAuth();
    resetFakeData();
    resetFakeKeys();
  });

  it("completes onboarding without a key on Skip for now", async () => {
    fakeData.updateProfile.mockResolvedValue({ ok: true, value: completedProfile() });
    await openAiStep();
    await fireEvent.press(screen.getByText("Skip for now"));
    expect(fakeKeys.saveApiKey).not.toHaveBeenCalled();
    expect(fakeData.updateProfile).toHaveBeenCalledWith(skipUpdate);
    expect(screen).toHavePathname("/");
  });

  it("deletes any stored key before completing on Skip for now", async () => {
    fakeData.updateProfile.mockResolvedValue({ ok: true, value: completedProfile() });
    await openAiStep();
    await fireEvent.press(screen.getByText("Skip for now"));
    expect(fakeKeys.deleteApiKey).toHaveBeenCalledTimes(1);
    expect(fakeKeys.deleteApiKey.mock.invocationCallOrder[0]).toBeLessThan(
      fakeData.updateProfile.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("removes the key a failed Finish saved when the user then skips", async () => {
    fakeData.updateProfile.mockResolvedValueOnce({ ok: false, failure: "network" });
    await openAiStep();
    await fireEvent.changeText(screen.getByLabelText("API key"), generatedSecret("api-key"));
    await press("Finish");
    fakeData.updateProfile.mockResolvedValue({ ok: true, value: completedProfile() });
    await fireEvent.press(screen.getByText("Skip for now"));
    expect(fakeKeys.deleteApiKey).toHaveBeenCalledTimes(1);
    expect(fakeData.updateProfile).toHaveBeenLastCalledWith(skipUpdate);
  });

  it("does not delete a key on Finish", async () => {
    fakeData.updateProfile.mockResolvedValue({ ok: true, value: completedProfile() });
    await openAiStep();
    await fireEvent.changeText(screen.getByLabelText("API key"), generatedSecret("api-key"));
    await press("Finish");
    expect(fakeKeys.deleteApiKey).not.toHaveBeenCalled();
  });

  it("shows the delete failure and does not complete when the key cannot be deleted", async () => {
    fakeKeys.deleteApiKey.mockResolvedValue({ ok: false, failure: "not_deleted" });
    await openAiStep();
    await fireEvent.press(screen.getByText("Skip for now"));
    expect(screen.getByText(keyDeleteFailureMessage)).toBeTruthy();
    expect(fakeData.updateProfile).not.toHaveBeenCalled();
    expect(screen).toHavePathname("/onboarding");
  });

  it("disables Back while Skip is running", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fakeData.updateProfile>>>();
    fakeData.updateProfile.mockReturnValue(pending.promise);
    await openAiStep();
    await fireEvent.press(screen.getByText("Skip for now"));
    expect(screen.getByText("Back").props.onPress).toBeUndefined();
    expect(screen.getByText("Back").props.disabled).toBe(true);
    await act(async () => pending.resolve({ ok: false, failure: "network" }));
  });

  it("shows the failure and stays when Skip cannot save", async () => {
    fakeData.updateProfile.mockResolvedValue({ ok: false, failure: "unavailable" });
    await openAiStep();
    await fireEvent.press(screen.getByText("Skip for now"));
    expect(screen.getByText(dataFailureMessage("unavailable"))).toBeTruthy();
    expect(screen).toHavePathname("/onboarding");
  });
});
