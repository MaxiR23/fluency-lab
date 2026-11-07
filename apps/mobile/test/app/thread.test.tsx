// apps/mobile/test/app/thread.test.tsx
//
// Tests for the Thread screen.
//
// Tested:
// - Loading while the key is read; the failed state with Try again; no key
// - Empty: the header, the pinned sentence, corrections and rule, the three chips and the composer
// - With messages: the rows in order, a new word row after the learner's question
// - Send clears the composer back to one line and the pill after a long question
// - A chip sends its text, the typing dots show while pending, and the reply is drawn
// - A tutor withdrawal draws Withdrawn on the pinned card
// - Leaving and reopening shows the earlier messages in order
// - The 80% warning, the 100% block, the OpenAI notice and an invalid key with Update key
// - Back returns to the previous screen; signed out users cannot reach the thread
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/app/thread.test.tsx
//
// SEE: apps/mobile/src/app/thread.tsx

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen, within } from "@testing-library/react-native";
import { router } from "expo-router";
import { StyleSheet } from "react-native";

import { composerMaxHeight } from "@/components/chat-composer-style";
import { radius, size } from "@/constants/theme";
import { fakeSession, resetFakeAuth } from "../helpers/fake-auth";
import { fakeAi, resetFakeAi, threadReplyWith } from "../helpers/fake-ai";
import {
  fakeData,
  profileWith,
  resetFakeData,
  threadMessageWith,
  threadWith,
  THREAD_SENTENCE,
} from "../helpers/fake-data";
import { fakeHaptics } from "../helpers/fake-haptics";
import { fakeKeys, resetFakeKeys } from "../helpers/fake-keys";
import { renderApp, renderAppAt } from "../helpers/render-app";

jest.mock("expo-font", () => ({ useFonts: jest.fn(() => [true, null]) }));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hide: jest.fn(),
}));
jest.mock("@/data", () => ({
  data: jest.requireActual<typeof import("../helpers/fake-data")>("../helpers/fake-data").fakeData,
}));
jest.mock("@/ai", () => ({
  ai: jest.requireActual<typeof import("../helpers/fake-ai")>("../helpers/fake-ai").fakeAi,
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

const open = { pathname: "/thread", params: { message: "message-1" } } as const;

describe("Thread", () => {
  beforeEach(() => {
    resetFakeAuth();
    resetFakeData();
    resetFakeKeys();
    resetFakeAi();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function withKey(
    provider: "claude" | "openai" | null = "claude",
    extra: Parameters<typeof profileWith>[0] = {},
  ) {
    fakeKeys.hasApiKey.mockResolvedValue({ ok: true, value: true });
    fakeData.getProfile.mockResolvedValue({
      ok: true,
      value: profileWith({
        provider,
        displayName: "Ada",
        level: "intermediate",
        onboardingCompletedAt: "2026-11-05T10:00:00Z",
        ...extra,
      }),
    });
    fakeData.addThreadMessage.mockImplementation(async (messageId, input) => ({
      ok: true,
      value: threadMessageWith({ id: `saved-${input.text}`, messageId, role: input.role }),
    }));
    fakeData.addUsage.mockResolvedValue({ ok: true, value: threadWith().session });
  }

  function withSpent(spentUsd: number) {
    fakeData.getMonthSpend.mockResolvedValue({
      ok: true,
      value: { monthStart: "2026-11-01", spentUsd },
    });
  }

  it("draws the loading state while the key is read", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fakeKeys.hasApiKey>>>();
    fakeKeys.hasApiKey.mockReturnValue(pending.promise);
    await renderAppAt(open, fakeSession());
    expect(screen.getByTestId("thread-loading")).toBeTruthy();
    await act(async () => pending.resolve({ ok: true, value: false }));
    expect(screen.queryByTestId("thread-loading")).toBeNull();
  });

  it("draws the empty thread: header, pinned card, chips and composer, no bubble", async () => {
    withKey();
    await renderAppAt(open, fakeSession());

    expect(screen.getByRole("header", { name: "Correction" })).toBeTruthy();
    expect(screen.getByText("Travel")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to the chat" })).toBeTruthy();
    expect(screen.getByText(THREAD_SENTENCE)).toBeTruthy();
    expect(screen.getByText("the next year")).toBeTruthy();
    expect(screen.getByText("I never been")).toBeTruthy();
    expect(screen.getByText("Articles with years · Present perfect")).toBeTruthy();
    expect(screen.queryByText("2 corrections")).toBeNull();
    expect(screen.getByRole("button", { name: "Why is it wrong?" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "I think I was right" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Other ways" })).toBeTruthy();
    expect(screen.getByPlaceholderText("Ask about this correction…")).toBeTruthy();
    expect(screen.getByLabelText("Ask about this correction")).toBeTruthy();
    expect(screen.queryByTestId("typing-indicator")).toBeNull();
    expect(fakeAi.replyInThread).not.toHaveBeenCalled();
  });

  it("draws the saved rows in order with a new word after the learner's question", async () => {
    withKey();
    fakeData.openThread.mockResolvedValue({
      ok: true,
      value: threadWith({
        messages: [
          threadMessageWith({ text: "Is laid-back right?", newWords: ["laid-back"] }),
          threadMessageWith({ id: "t2", role: "tutor", text: "Yes, it is." }),
        ],
      }),
    });
    await renderAppAt(open, fakeSession());

    const texts = screen
      .getAllByText(/Is laid-back right\?|Yes, it is\.|laid-back$/)
      .map((n) => n.props.children);
    expect(texts[0]).toBe("Is laid-back right?");
    expect(screen.getByText("New word")).toBeTruthy();
    expect(texts).toContain("Yes, it is.");
    expect(texts.indexOf("laid-back")).toBeGreaterThan(texts.indexOf("Is laid-back right?"));
    expect(texts.indexOf("laid-back")).toBeLessThan(texts.indexOf("Yes, it is."));
  });

  it("a chip sends its text, shows the typing dots and draws the reply", async () => {
    withKey();
    const pending = deferred<Awaited<ReturnType<typeof fakeAi.replyInThread>>>();
    fakeAi.replyInThread.mockReturnValue(pending.promise);
    await renderAppAt(open, fakeSession());

    await fireEvent.press(screen.getByRole("button", { name: "Why is it wrong?" }));

    expect(fakeAi.replyInThread.mock.calls[0][0].turns.at(-1)).toEqual({
      role: "user",
      text: "Why is it wrong?",
    });
    expect(fakeHaptics.play).toHaveBeenCalledWith("send");
    expect(screen.getByTestId("typing-indicator")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "I think I was right", disabled: true }),
    ).toBeTruthy();
    await act(async () =>
      pending.resolve({ ok: true, value: threadReplyWith({ reply: "Because of the article." }) }),
    );
    expect(screen.queryByTestId("typing-indicator")).toBeNull();
    // INFO: the chip and the learner bubble both read this text.
    expect(screen.getAllByText("Why is it wrong?")).toHaveLength(2);
    expect(screen.getByText("Because of the article.")).toBeTruthy();
    expect(fakeData.addThreadMessage).toHaveBeenCalledTimes(2);
    expect(fakeData.addUsage).toHaveBeenCalledWith("session-1", expect.anything());
  });

  it("sends the typed text with Send", async () => {
    withKey();
    await renderAppAt(open, fakeSession());
    await fireEvent.changeText(
      screen.getByPlaceholderText("Ask about this correction…"),
      "Can I say it another way?",
    );
    await fireEvent.press(screen.getByRole("button", { name: "Send", disabled: false }));
    expect(fakeAi.replyInThread.mock.calls[0][0].turns.at(-1)).toEqual({
      role: "user",
      text: "Can I say it another way?",
    });
  });

  it("takes the composer back to one line and the pill after a long question is sent", async () => {
    withKey();
    await renderAppAt(open, fakeSession());
    const lines = "First line\nSecond line\nThird line\nFourth line\nFifth line\nSixth line";
    await fireEvent.changeText(screen.getByPlaceholderText("Ask about this correction…"), lines);
    await fireEvent(screen.getByLabelText("Ask about this correction"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: composerMaxHeight } },
    });
    expect(
      StyleSheet.flatten(screen.getByLabelText("Ask about this correction").props.style)
        .borderRadius,
    ).toBe(radius.control);
    await fireEvent.press(screen.getByRole("button", { name: "Send", disabled: false }));
    const cleared = StyleSheet.flatten(
      screen.getByLabelText("Ask about this correction").props.style,
    );
    expect(cleared.height).toBe(size.control);
    expect(cleared.borderRadius).toBe(radius.pill);
  });

  it("a tutor withdrawal draws Withdrawn on that correction in the pinned card", async () => {
    withKey();
    fakeAi.replyInThread.mockResolvedValue({
      ok: true,
      value: threadReplyWith({ reply: "You are right.", withdrawn: [1] }),
    });
    fakeData.withdrawCorrections.mockResolvedValue({
      ok: true,
      value: threadWith(
        {},
        {
          corrections: {
            items: [
              {
                original: "the next year",
                corrected: "next year",
                rule: "Articles with years",
                withdrawn: true,
              },
              { original: "I never been", corrected: "I've never been", rule: "Present perfect" },
            ],
            explanation: null,
          },
        },
      ).message,
    });
    await renderAppAt(open, fakeSession());
    expect(screen.queryByText("Withdrawn")).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "I think I was right" }));

    expect(screen.getByText("Withdrawn")).toBeTruthy();
    expect(screen.getByText("the next year → next year")).toBeTruthy();
    expect(fakeData.withdrawCorrections).toHaveBeenCalledWith("message-1", [0]);
  });

  it("leaving and reopening shows the earlier messages in order", async () => {
    withKey();
    await renderAppAt(open, fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Why is it wrong?" }));
    expect(screen.getByText("The article is not needed with next year.")).toBeTruthy();

    await act(async () => router.back());
    expect(screen.queryByRole("header", { name: "Correction" })).toBeNull();

    fakeData.openThread.mockResolvedValue({
      ok: true,
      value: threadWith({
        messages: [
          threadMessageWith({ text: "Why is it wrong?" }),
          threadMessageWith({
            id: "t2",
            role: "tutor",
            text: "The article is not needed with next year.",
          }),
        ],
      }),
    });
    await act(async () => router.push(open));

    const order = within(screen.getByTestId("message-list"))
      .getAllByText(/Why is it wrong\?|The article is not needed/)
      .map((n) => n.props.children);
    expect(order[0]).toBe("Why is it wrong?");
    expect(order[order.length - 1]).toBe("The article is not needed with next year.");
  });

  it("draws the failed state and Try again reads again", async () => {
    withKey();
    fakeData.openThread.mockResolvedValueOnce({ ok: false, failure: "network" });
    await renderAppAt(open, fakeSession());
    expect(
      screen.getByText("Could not reach the server. Check your connection and try again."),
    ).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));

    expect(fakeData.openThread).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("header", { name: "Correction" })).toBeTruthy();
  });

  it("draws the no-key state: the connect card, no chips, the locked composer", async () => {
    await renderAppAt(open, fakeSession());

    expect(screen.getByRole("header", { name: "Correction" })).toBeTruthy();
    expect(screen.getByText("No AI connected")).toBeTruthy();
    expect(screen.getByText("Connect your AI to start")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Why is it wrong?" })).toBeNull();
    const input = screen.getByPlaceholderText("Add a key to start chatting");
    expect(input.props.editable).toBe(false);
    expect(fakeData.openThread).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole("button", { name: "Add API key" }));
    expect(screen).toHavePathname("/api-key");
  });

  it("blocks at 100% of the limit: the message, disabled chips and Send, and no AI call", async () => {
    withKey("claude", { monthlyLimitUsd: 10 });
    withSpent(10);
    await renderAppAt(open, fakeSession());

    expect(screen.getByText("You reached your monthly limit.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Why is it wrong?", disabled: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send", disabled: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Other ways" }));
    expect(fakeAi.replyInThread).not.toHaveBeenCalled();
  });

  it("warns at 80% of the limit and a chip still works", async () => {
    withKey("claude", { monthlyLimitUsd: 10 });
    withSpent(8);
    await renderAppAt(open, fakeSession());
    expect(screen.getByText("You're close to your monthly limit.")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Other ways" }));

    expect(fakeAi.replyInThread).toHaveBeenCalledTimes(1);
  });

  it("says OpenAI is coming soon and locks sending", async () => {
    withKey("openai");
    await renderAppAt(open, fakeSession());

    expect(screen.getByText("OpenAI is coming soon. Use a Claude key for now.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send", disabled: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Update key" }));
    expect(screen).toHavePathname("/api-key");
  });

  it("offers Update key after an invalid key failure", async () => {
    withKey();
    fakeAi.replyInThread.mockResolvedValue({ ok: false, failure: "invalid_key" });
    await renderAppAt(open, fakeSession());

    await fireEvent.press(screen.getByRole("button", { name: "Why is it wrong?" }));

    expect(
      screen.getByText("Your API key was not accepted. Update it to keep chatting."),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Update key" }));
    expect(screen).toHavePathname("/api-key");
  });

  it("goes back with Back to the chat", async () => {
    withKey();
    await renderAppAt(open, fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Back to the chat" }));
    expect(screen.queryByRole("header", { name: "Correction" })).toBeNull();
  });

  it("lands on Login when signed out", async () => {
    await renderApp("/thread?message=message-1", null);
    expect(screen).toHavePathname("/sign-in");
    expect(screen.queryByRole("header", { name: "Correction" })).toBeNull();
  });
});
