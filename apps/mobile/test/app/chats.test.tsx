// apps/mobile/test/app/chats.test.tsx
//
// Tests for Open chats.
//
// Tested:
// - Loading, with data, expected empty and error states
// - Back, the title, the intro line and the rows in the order the API sent
// - A row opens its chat; End removes the row; Delete asks first, then removes
// - A failed End keeps the row and shows the failure
// - An ended chat leaves Continue and See all on the way back to Home
//
// What is covered:
// - Normal case, empty case, edges. The swipe itself is checked on a device.
//
// Run with: pnpm exec jest apps/mobile/test/app/chats.test.tsx
//
// SEE: apps/mobile/src/app/chats.tsx

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ActiveSession } from "@fluency-lab/shared";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { Alert, type AlertButton } from "react-native";

import { dataFailureMessage } from "@/utils/data-message";
import { fakeSession, resetFakeAuth } from "../helpers/fake-auth";
import { activeSessionWith, fakeData, resetFakeData } from "../helpers/fake-data";
import { resetFakeKeys } from "../helpers/fake-keys";
import { pressAction } from "../helpers/press-action";
import { renderApp, renderAppAt } from "../helpers/render-app";

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

const weekend = activeSessionWith({ id: "s1", title: "Weekend plans" }, { text: "Where to?" });
const music = activeSessionWith({ id: "s2", topicId: "music", title: "Music talk" });
const free = activeSessionWith({ id: "s3", title: "Free chat" }, null);

function alertButtons(): AlertButton[] {
  return jest.mocked(Alert.alert).mock.calls.at(-1)?.[2] ?? [];
}

function rowNames(titles: string[]): string[] {
  return screen
    .getAllByRole("button")
    .map((button) => button.props.accessibilityLabel as string)
    .filter((name) => titles.includes(name));
}

describe("Open chats", () => {
  beforeEach(() => {
    resetFakeAuth();
    resetFakeData();
    resetFakeKeys();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    fakeData.listOpenSessions.mockResolvedValue({ ok: true, value: [weekend, music, free] });
  });

  it("draws Back, the title, the intro line and the rows in the order the API sent", async () => {
    await renderAppAt("/chats", fakeSession());
    expect(screen.getByRole("button", { name: "Back to Home" })).toBeTruthy();
    expect(screen.getByRole("header", { name: "Open chats" })).toBeTruthy();
    expect(
      screen.getByText("Pick up where you left off. Ended chats move to Progress."),
    ).toBeTruthy();
    expect(screen.getByText("Where to?")).toBeTruthy();
    expect(rowNames(["Weekend plans", "Music talk", "Free chat"])).toEqual([
      "Weekend plans",
      "Music talk",
      "Free chat",
    ]);
  });

  it("opens the chat of a row", async () => {
    await renderAppAt("/chats", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Music talk" }));
    expect(screen).toHavePathname("/chat");
    expect(screen).toHaveSearchParams({ session: "s2" });
  });

  it("goes back from Back", async () => {
    await renderAppAt("/chats", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Back to Home" }));
    expect(screen).toHavePathname("/");
  });

  it("shows a spinner while the open chats load", async () => {
    let finish!: (value: Awaited<ReturnType<typeof fakeData.listOpenSessions>>) => void;
    // INFO: the sign-in guard and Home read first; the next read is this screen's.
    fakeData.listOpenSessions.mockResolvedValueOnce({ ok: true, value: [] }).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await renderAppAt("/chats", fakeSession());
    expect(screen.getByTestId("chats-loading")).toBeTruthy();
    await act(async () => finish({ ok: true, value: [weekend] }));
    expect(screen.queryByTestId("chats-loading")).toBeNull();
    expect(screen.getByRole("button", { name: "Weekend plans" })).toBeTruthy();
  });

  it("says there are no open chats when there is none", async () => {
    fakeData.listOpenSessions.mockResolvedValue({ ok: true, value: [] });
    await renderAppAt("/chats", fakeSession());
    expect(screen.getByText("No open chats.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Weekend plans" })).toBeNull();
  });

  it("shows the failure and reads again from Try again", async () => {
    fakeData.listOpenSessions
      .mockResolvedValueOnce({ ok: true, value: [] })
      .mockResolvedValueOnce({ ok: false, failure: "unavailable" });
    await renderAppAt("/chats", fakeSession());
    expect(screen.getByText(dataFailureMessage("unavailable"))).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(screen.queryByText(dataFailureMessage("unavailable"))).toBeNull();
    expect(screen.getByRole("button", { name: "Weekend plans" })).toBeTruthy();
  });

  it("ends a chat from End and removes its row", async () => {
    fakeData.endSession.mockResolvedValue({
      ok: true,
      value: { ...weekend.session, status: "ended" },
    });
    await renderAppAt("/chats", fakeSession());
    await pressAction(screen.getByRole("button", { name: "End Weekend plans" }));
    expect(fakeData.endSession).toHaveBeenCalledWith("s1");
    expect(screen.queryByRole("button", { name: "Weekend plans" })).toBeNull();
    expect(screen.getByRole("button", { name: "Music talk" })).toBeTruthy();
  });

  it("asks before deleting and deletes only on Delete", async () => {
    fakeData.deleteSession.mockResolvedValue({ ok: true, value: music.session });
    await renderAppAt("/chats", fakeSession());
    await pressAction(screen.getByRole("button", { name: "Delete Music talk" }));

    expect(Alert.alert).toHaveBeenCalledWith(
      "Delete this chat?",
      "This can't be undone.",
      expect.any(Array),
    );
    expect(alertButtons().map((button) => [button.text, button.style])).toEqual([
      ["Cancel", "cancel"],
      ["Delete", "destructive"],
    ]);
    expect(fakeData.deleteSession).not.toHaveBeenCalled();
    await act(async () =>
      alertButtons()
        .find((button) => button.text === "Delete")
        ?.onPress?.(),
    );
    expect(fakeData.deleteSession).toHaveBeenCalledWith("s2");
    expect(screen.queryByRole("button", { name: "Music talk" })).toBeNull();
  });

  it("keeps the row and deletes nothing on Cancel", async () => {
    await renderAppAt("/chats", fakeSession());
    await pressAction(screen.getByRole("button", { name: "Delete Music talk" }));
    await act(async () =>
      alertButtons()
        .find((button) => button.text === "Cancel")
        ?.onPress?.(),
    );
    expect(fakeData.deleteSession).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Music talk" })).toBeTruthy();
  });

  it("keeps the row and shows the failure when End fails", async () => {
    fakeData.endSession.mockResolvedValue({ ok: false, failure: "network" });
    await renderAppAt("/chats", fakeSession());
    await pressAction(screen.getByRole("button", { name: "End Weekend plans" }));
    expect(screen.getByText(dataFailureMessage("network"))).toBeTruthy();
    expect(screen.getByRole("button", { name: "Weekend plans" })).toBeTruthy();
  });

  it("drops the ended chat from Continue and from See all on the way back to Home", async () => {
    let open: ActiveSession[] = [
      activeSessionWith({ id: "s1", title: "Newest chat" }),
      activeSessionWith({ id: "s2", title: "Older chat" }),
    ];
    fakeData.listOpenSessions.mockImplementation(async () => ({ ok: true, value: open }));
    fakeData.endSession.mockImplementation(async (id) => {
      open = open.filter((item) => item.session.id !== id);
      return { ok: true, value: { ...weekend.session, id, status: "ended" } };
    });
    await renderApp("/", fakeSession());
    expect(screen.getByRole("button", { name: "Newest chat" })).toBeTruthy();
    await fireEvent.press(screen.getByRole("link", { name: "See all (2)" }));
    await pressAction(screen.getByRole("button", { name: "End Newest chat" }));
    await fireEvent.press(screen.getByRole("button", { name: "Back to Home" }));

    expect(screen).toHavePathname("/");
    expect(screen.getByRole("button", { name: "Older chat" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Newest chat" })).toBeNull();
    expect(screen.queryByRole("link", { name: /See all \(/ })).toBeNull();
  });
});
