// apps/mobile/test/app/profile.test.tsx
//
// Tests for the Profile screen.
//
// Tested:
// - Loading, with data, expected empty (a new user) and error states
// - The avatar, the name, the email, Edit name and the three stats from the API
// - The learning values, and Level, Goals and Topics open their edits
// - Back goes to Home, and a name saved on the edit screen shows on Profile and in Home's greeting
// - Sign out lands on Login, with its failures
// - Delete account asks first, deletes the account, the stored key and the session in order,
//   shows each failure and resumes at the failed step
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/app/profile.test.tsx
//
// SEE: apps/mobile/src/app/profile.tsx

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen, within } from "@testing-library/react-native";
import { router } from "expo-router";
import { Alert, type AlertButton } from "react-native";

import type { Profile } from "@fluency-lab/shared";

import { authFailureMessage } from "@/utils/auth-message";
import { dataFailureMessage, keyDeleteFailureMessage } from "@/utils/data-message";
import { offlineCardBody, retryingLabel } from "@/utils/load-failure";
import { greeting } from "@/utils/home";
import { emitSession, fakeAuth, fakeSession, resetFakeAuth } from "../helpers/fake-auth";
import { fakeData, profileWith, resetFakeData } from "../helpers/fake-data";
import { fakeKeys, resetFakeKeys } from "../helpers/fake-keys";
import { renderApp, renderAppAt } from "../helpers/render-app";
import { setDev } from "../helpers/set-dev";

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

const savedDev = __DEV__;
const networkCause = { name: "AuthRetryableFetchError", detail: "offline" };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const maxi = profileWith({
  displayName: "Maxi",
  level: "intermediate",
  goals: ["work", "conversation"],
  topics: ["food", "travel", "music", "sports"],
  onboardingCompletedAt: "2026-11-05T10:00:00Z",
});

function alertButtons(): AlertButton[] {
  const call = jest.mocked(Alert.alert).mock.calls.at(-1);
  return call?.[2] ?? [];
}

async function confirmDelete() {
  await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
  await act(async () =>
    alertButtons()
      .find((button) => button.text === "Delete")
      ?.onPress?.(),
  );
}

describe("Profile", () => {
  beforeEach(() => {
    resetFakeAuth();
    resetFakeData();
    resetFakeKeys();
    fakeData.getProfile.mockResolvedValue({ ok: true, value: maxi });
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    setDev(savedDev);
  });

  it("draws the loading state", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fakeData.getProfileStats>>>();
    fakeData.getProfileStats.mockReturnValue(pending.promise);
    await renderAppAt("/profile", fakeSession());
    expect(screen.getByTestId("profile-loading")).toBeTruthy();
    await act(async () =>
      pending.resolve({ ok: true, value: { sessions: 0, dayStreak: 0, newWords: 0 } }),
    );
    expect(screen.queryByTestId("profile-loading")).toBeNull();
  });

  it("draws the avatar initial, the name, the email and Edit name", async () => {
    await renderAppAt("/profile", fakeSession());
    const header = within(screen.getByTestId("profile-header"));
    expect(header.getByText("M", { includeHiddenElements: true })).toBeTruthy();
    expect(header.getByText("Maxi")).toBeTruthy();
    expect(header.getByText("name@email.com")).toBeTruthy();
    expect(header.getByRole("button", { name: "Edit name" })).toBeTruthy();
    expect(screen.getByRole("header", { name: "Profile" })).toBeTruthy();
  });

  it("draws 12 sessions, 3 day streak and 48 new words from the API", async () => {
    fakeData.getProfileStats.mockResolvedValue({
      ok: true,
      value: { sessions: 12, dayStreak: 3, newWords: 48 },
    });
    await renderAppAt("/profile", fakeSession());
    const tiles = screen.getAllByTestId("stat-card").map((tile) => within(tile));
    expect(tiles).toHaveLength(3);
    expect(tiles[0]?.getByText("12")).toBeTruthy();
    expect(tiles[0]?.getByText("Sessions")).toBeTruthy();
    expect(tiles[1]?.getByText("3")).toBeTruthy();
    expect(tiles[1]?.getByText("Day streak")).toBeTruthy();
    expect(tiles[2]?.getByText("48")).toBeTruthy();
    expect(tiles[2]?.getByText("New words")).toBeTruthy();
  });

  it("draws zeros and Not set for a new user", async () => {
    fakeData.getProfile.mockResolvedValue({
      ok: true,
      value: profileWith({ onboardingCompletedAt: "2026-11-05T10:00:00Z" }),
    });
    await renderAppAt("/profile", fakeSession());
    const tiles = screen.getAllByTestId("stat-card").map((tile) => within(tile));
    for (const tile of tiles) expect(tile.getByText("0")).toBeTruthy();
    const header = within(screen.getByTestId("profile-header"));
    expect(header.getByText("No name set")).toBeTruthy();
    expect(screen.getAllByText("Not set")).toHaveLength(2);
    expect(screen.getByText("0 selected")).toBeTruthy();
  });

  it("draws Intermediate, the goal labels and 4 selected", async () => {
    await renderAppAt("/profile", fakeSession());
    expect(screen.getByRole("header", { name: "Learning" })).toBeTruthy();
    expect(screen.getByText("Intermediate")).toBeTruthy();
    expect(screen.getByText("Work, Everyday conversation")).toBeTruthy();
    expect(screen.getByText("4 selected")).toBeTruthy();
  });

  it("keeps the red failure and Try again when the read fails without the network", async () => {
    fakeData.getProfileStats.mockResolvedValueOnce({ ok: false, failure: "unavailable" });
    await renderAppAt("/profile", fakeSession());
    expect(screen.getByText(dataFailureMessage("unavailable"))).toBeTruthy();
    expect(screen.queryByText("Can't load your profile")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("Maxi")).toBeTruthy();
    expect(screen.queryByText(dataFailureMessage("unavailable"))).toBeNull();
  });

  it("draws the can't-connect card under the header when the read fails on the network", async () => {
    fakeData.getProfileStats.mockResolvedValueOnce({ ok: false, failure: "network" });
    await renderAppAt("/profile", fakeSession());
    expect(screen.getByRole("header", { name: "Profile" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to Home" })).toBeTruthy();
    expect(screen.getByRole("header", { name: "Can't load your profile" })).toBeTruthy();
    expect(screen.getByText(offlineCardBody)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByText(dataFailureMessage("network"))).toBeNull();
  });

  it("shows Trying again\u2026 while Try again reads, then draws the profile when the server is back", async () => {
    let finish!: (value: Awaited<ReturnType<typeof fakeData.getProfileStats>>) => void;
    fakeData.getProfileStats
      .mockResolvedValueOnce({ ok: false, failure: "network" })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
    await renderAppAt("/profile", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(
      screen.getByRole("button", { name: "Try again", busy: true, disabled: true }),
    ).toBeTruthy();
    expect(screen.getByText(retryingLabel)).toBeTruthy();
    await act(async () => finish({ ok: true, value: { sessions: 1, dayStreak: 1, newWords: 1 } }));
    expect(screen.queryByText(retryingLabel)).toBeNull();
    expect(screen.getByText("Maxi")).toBeTruthy();
  });

  it("opens the level, goals and topics edits", async () => {
    await renderAppAt("/profile", fakeSession());
    for (const [name, field] of [
      ["Level", "level"],
      ["Goals", "goals"],
      ["Topics", "topics"],
    ] as const) {
      await fireEvent.press(screen.getByRole("button", { name }));
      expect(screen).toHavePathname("/edit-profile");
      expect(screen).toHaveSearchParams({ field });
      await act(async () => router.back());
      expect(screen).toHavePathname("/profile");
    }
  });

  it("opens the name edit from Edit name", async () => {
    await renderAppAt("/profile", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Edit name" }));
    expect(screen).toHaveSearchParams({ field: "name" });
  });

  it("goes back to Home on Back", async () => {
    await renderAppAt("/profile", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Back to Home" }));
    expect(screen).toHavePathname("/");
  });

  it("saves a new name and Home greets with it", async () => {
    let current: Profile = profileWith({
      displayName: "Ada",
      onboardingCompletedAt: "2026-11-05T10:00:00Z",
    });
    fakeData.getProfile.mockImplementation(async () => ({ ok: true, value: current }));
    fakeData.updateProfile.mockImplementation(async (update) => {
      current = { ...current, displayName: update.displayName ?? null };
      return { ok: true, value: current };
    });
    await renderApp("/", fakeSession());
    expect(screen.getByText(greeting("Ada", new Date()))).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Profile" }));
    expect(screen).toHavePathname("/profile");
    await fireEvent.press(screen.getByRole("button", { name: "Edit name" }));
    await fireEvent.changeText(screen.getByLabelText("Name"), "Grace");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    expect(screen).toHavePathname("/profile");
    expect(within(screen.getByTestId("profile-header")).getByText("Grace")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Back to Home" }));
    expect(screen).toHavePathname("/");
    expect(screen.getByText(greeting("Grace", new Date()))).toBeTruthy();
  });

  describe("Sign out", () => {
    it("signs out from the Sign out row and lands on Login", async () => {
      fakeAuth.signOut.mockImplementation(async () => {
        emitSession(null);
        return { ok: true, value: null };
      });
      await renderAppAt("/profile", fakeSession());
      await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
      expect(screen).toHavePathname("/sign-in");
    });

    it("shows the message and stays on Profile when sign out fails", async () => {
      fakeAuth.signOut.mockResolvedValue({ ok: false, failure: "network" });
      await renderAppAt("/profile", fakeSession());
      await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
      expect(screen.getByText(authFailureMessage("network"))).toBeTruthy();
      expect(screen).toHavePathname("/profile");
    });

    it("draws the cause line in development only", async () => {
      fakeAuth.signOut.mockResolvedValue({ ok: false, failure: "network", cause: networkCause });
      await renderAppAt("/profile", fakeSession());
      await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
      expect(screen.getByText("AuthRetryableFetchError: offline")).toBeTruthy();
    });

    it("draws only the message outside development", async () => {
      setDev(false);
      fakeAuth.signOut.mockResolvedValue({ ok: false, failure: "network", cause: networkCause });
      await renderAppAt("/profile", fakeSession());
      await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
      expect(screen.getByText(authFailureMessage("network"))).toBeTruthy();
      expect(screen.queryByText(/AuthRetryableFetchError/)).toBeNull();
    });

    it("shows the row busy while the request runs", async () => {
      const pending = deferred<{ ok: false; failure: "network" }>();
      fakeAuth.signOut.mockReturnValue(pending.promise);
      await renderAppAt("/profile", fakeSession());
      await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
      await fireEvent.press(
        screen.getByRole("button", { name: "Sign out", busy: true, disabled: true }),
      );
      expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
      await act(async () => pending.resolve({ ok: false, failure: "network" }));
    });
  });

  describe("Delete account", () => {
    it("asks before deleting and deletes nothing on Cancel", async () => {
      await renderAppAt("/profile", fakeSession());
      await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
      expect(Alert.alert).toHaveBeenCalledWith(
        "Delete your account?",
        "This removes your profile, chats and progress. It can't be undone.",
        expect.any(Array),
      );
      await act(async () =>
        alertButtons()
          .find((button) => button.text === "Cancel")
          ?.onPress?.(),
      );
      expect(fakeData.deleteAccount).not.toHaveBeenCalled();
      expect(fakeKeys.deleteApiKey).not.toHaveBeenCalled();
      expect(fakeAuth.signOut).not.toHaveBeenCalled();
    });

    it("deletes the account, clears the stored key, signs out and lands on Login", async () => {
      fakeAuth.signOut.mockImplementation(async () => {
        emitSession(null);
        return { ok: true, value: null };
      });
      await renderAppAt("/profile", fakeSession());
      await confirmDelete();
      expect(fakeData.deleteAccount).toHaveBeenCalledTimes(1);
      expect(fakeKeys.deleteApiKey).toHaveBeenCalledTimes(1);
      expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
      expect(screen).toHavePathname("/sign-in");
    });

    it("shows the deletion failure and keeps the user signed in", async () => {
      fakeData.deleteAccount.mockResolvedValue({ ok: false, failure: "network" });
      await renderAppAt("/profile", fakeSession());
      await confirmDelete();
      expect(screen.getByText(dataFailureMessage("network"))).toBeTruthy();
      expect(fakeKeys.deleteApiKey).not.toHaveBeenCalled();
      expect(fakeAuth.signOut).not.toHaveBeenCalled();
      expect(screen).toHavePathname("/profile");
    });

    it("shows the key failure after the account was deleted and retries only the key", async () => {
      fakeKeys.deleteApiKey.mockResolvedValueOnce({ ok: false, failure: "not_deleted" });
      fakeAuth.signOut.mockImplementation(async () => {
        emitSession(null);
        return { ok: true, value: null };
      });
      await renderAppAt("/profile", fakeSession());
      await confirmDelete();
      expect(screen.getByText(keyDeleteFailureMessage)).toBeTruthy();
      expect(screen).toHavePathname("/profile");
      await confirmDelete();
      expect(fakeData.deleteAccount).toHaveBeenCalledTimes(1);
      expect(fakeKeys.deleteApiKey).toHaveBeenCalledTimes(2);
      expect(screen).toHavePathname("/sign-in");
    });
  });
});
