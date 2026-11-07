// apps/mobile/test/app/chat.test.tsx
//
// Tests for the Chat screen.
//
// Tested:
// - Loading, no key, ready (the opener or greeting) and the key, profile and spend read errors
// - The header: the starter's title or Free chat, the provider line, Back and the X (End session)
// - The composer is one line and the pill again after a long message is sent
// - A message gets a tutor reply with corrections and new words, with the typing indicator
// - A saved session from Continue draws its messages and corrections
// - Each AI failure draws its message and action; the cause line shows in development only
// - The 80% warning, the 100% block and the provider OpenAI notice
// - The X asks to confirm; End saves and opens the session's Summary
// - Cancel keeps the chat open; Back keeps the session open and Home offers Continue
// - The no key state: card, locked input and Send, Add API key opens the key step
// - The ready state: Send follows the draft, the composer sits in the keyboard footer
// - Send plays the send haptic, and nothing plays when haptics are off
// - Swiping a tutor message opens the reply preview with one reply haptic; its X cancels it
// - A sent reply draws the quote, a resumed chat draws it again, a learner message or a locked chat cannot be swiped
// - A saved message with corrections offers Ask about this with its reply count, and opens its thread
// - Coming back from a thread draws the new count and a withdrawn correction; thread text never shows in the chat
// - The state updates when the key step goes back to Chat
// - Signed out users cannot reach Chat
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/app/chat.test.tsx
//
// SEE: apps/mobile/src/app/chat.tsx

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { STARTERS, type Message, type Session } from "@fluency-lab/shared";
import { act, fireEvent, screen, within } from "@testing-library/react-native";
import { type Href, router } from "expo-router";
import { Alert, type AlertButton, StyleSheet } from "react-native";
import { State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";

import { composerMaxHeight } from "@/components/chat-composer-style";
import { radius, size } from "@/constants/theme";
import { dataFailureMessage, keyReadFailureMessage } from "@/utils/data-message";
import { fakeSession, resetFakeAuth } from "../helpers/fake-auth";
import { fakeAi, resetFakeAi, tutorReplyWith } from "../helpers/fake-ai";
import {
  activeSessionWith,
  completedProfile,
  fakeData,
  profileWith,
  resetFakeData,
} from "../helpers/fake-data";
import { fakeHaptics, fakeHapticsSetting } from "../helpers/fake-haptics";
import { fakeKeys, resetFakeKeys } from "../helpers/fake-keys";
import { renderApp, renderAppAt } from "../helpers/render-app";
import { generatedSecret } from "../helpers/generated-secret";
import { setDev } from "../helpers/set-dev";

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

// INFO: jest renders no keyboard; this spy proves the chat no longer draws React Native's view.
const keyboardAvoidingRenders: number[] = [];
jest.mock("react-native/Libraries/Components/Keyboard/KeyboardAvoidingView", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    __esModule: true,
    default: ({ children, ...rest }: { children?: unknown }) => {
      keyboardAvoidingRenders.push(1);
      return <View {...rest}>{children as never}</View>;
    },
  };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const savedDev = __DEV__;
const starter = STARTERS[0];

const session: Session = {
  id: "session-1",
  topicId: "travel",
  title: "Travel plans",
  status: "active",
  summary: null,
  costUsd: 0,
  createdAt: "2026-11-05T09:00:00Z",
  updatedAt: "2026-11-05T09:30:00Z",
};

function saved(role: Message["role"], text: string, extra: Partial<Message> = {}): Message {
  return {
    id: `m-${text}`,
    sessionId: "session-1",
    role,
    text,
    corrections: null,
    newWords: null,
    replyToId: null,
    createdAt: "2026-11-05T09:00:00Z",
    ...extra,
  };
}

// INFO: the design's sample reply: two corrections, one explanation and a new word.
const designReply = tutorReplyWith({
  reply: "Japan is wonderful! What would you like to see there?",
  corrections: [
    { original: "the next year", corrected: "next year" },
    { original: "I never been", corrected: "I've never been" },
  ],
  explanation: "No article before next year; use the present perfect.",
  newWords: ["definitely"],
});

describe("Chat", () => {
  beforeEach(() => {
    resetFakeAuth();
    resetFakeData();
    resetFakeKeys();
    resetFakeAi();
    keyboardAvoidingRenders.length = 0;
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    setDev(savedDev);
  });

  async function sendMessage(text: string) {
    await fireEvent.changeText(screen.getByPlaceholderText("Write in English\u2026"), text);
    await fireEvent.press(screen.getByRole("button", { name: "Send", disabled: false }));
  }

  function alertButtons(): AlertButton[] {
    const call = jest.mocked(Alert.alert).mock.calls.at(-1);
    return call?.[2] ?? [];
  }

  async function confirmEnd() {
    await fireEvent.press(screen.getByRole("button", { name: "End session" }));
    await act(async () =>
      alertButtons()
        .find((button) => button.text === "End")
        ?.onPress?.(),
    );
  }

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
        onboardingCompletedAt: "2026-11-05T10:00:00Z",
        ...extra,
      }),
    });
    fakeData.createSession.mockResolvedValue({ ok: true, value: session });
    fakeData.addMessage.mockResolvedValue({ ok: true, value: saved("user", "x") });
    fakeData.addUsage.mockResolvedValue({ ok: true, value: session });
    fakeData.endSession.mockResolvedValue({ ok: true, value: { ...session, status: "ended" } });
  }

  it("draws the loading state while the key is read", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fakeKeys.hasApiKey>>>();
    fakeKeys.hasApiKey.mockReturnValue(pending.promise);
    await renderAppAt("/chat", fakeSession());
    expect(screen.getByTestId("chat-loading")).toBeTruthy();
    await act(async () => pending.resolve({ ok: true, value: false }));
    expect(screen.queryByTestId("chat-loading")).toBeNull();
  });

  it("draws the no-key state: header, card, locked input and Send", async () => {
    await renderAppAt("/chat", fakeSession());
    expect(screen.getByRole("header", { name: "Free chat" })).toBeTruthy();
    expect(screen.getByText("No AI connected")).toBeTruthy();
    expect(screen.getByText("Connect your AI to start")).toBeTruthy();
    expect(
      screen.getByText("Add your Claude or OpenAI key. It stays only on this device."),
    ).toBeTruthy();
    expect(screen.getByPlaceholderText("Add a key to start chatting").props.editable).toBe(false);
    expect(screen.getByRole("button", { name: "Send", disabled: true })).toBeTruthy();
  });

  it("opens the key step from Add API key", async () => {
    await renderAppAt("/chat", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Add API key" }));
    expect(screen).toHavePathname("/api-key");
  });

  it("draws the free chat greeting with the provider when a key is saved", async () => {
    withKey("claude");
    await renderAppAt("/chat", fakeSession());
    expect(screen.getByText("Claude")).toBeTruthy();
    expect(screen.getByTestId("message-list")).toBeTruthy();
    expect(screen.getByText("Hi Ada! What would you like to talk about today?")).toBeTruthy();
    expect(screen.queryByText("New word")).toBeNull();
    expect(fakeAi.reply).not.toHaveBeenCalled();
    expect(fakeData.createSession).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("Write in English\u2026")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send", disabled: true })).toBeTruthy();
    expect(screen.queryByText("Connect your AI to start")).toBeNull();
  });

  it("draws the composer in the keyboard footer and no React Native keyboard avoiding view", async () => {
    withKey();
    await renderAppAt("/chat", fakeSession());
    expect(keyboardAvoidingRenders).toEqual([]);
    const footer = screen.getByTestId("chat-footer");
    expect(within(footer).getByPlaceholderText("Write in English\u2026")).toBeTruthy();
    expect(typeof footer.props.offset.opened).toBe("number");
  });

  it("enables Send after typing and disables it again when cleared", async () => {
    withKey();
    await renderAppAt("/chat", fakeSession());
    const input = screen.getByPlaceholderText("Write in English\u2026");
    await fireEvent.changeText(input, "Hello");
    expect(screen.getByRole("button", { name: "Send", disabled: false })).toBeTruthy();
    await fireEvent.changeText(input, "");
    expect(screen.getByRole("button", { name: "Send", disabled: true })).toBeTruthy();
  });

  it("takes the composer back to one line and the pill after a long message is sent", async () => {
    withKey();
    await renderAppAt("/chat", fakeSession());
    const lines = "First line\nSecond line\nThird line\nFourth line\nFifth line\nSixth line";
    await fireEvent.changeText(screen.getByPlaceholderText("Write in English\u2026"), lines);
    await fireEvent(screen.getByLabelText("Message"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: composerMaxHeight } },
    });
    expect(StyleSheet.flatten(screen.getByLabelText("Message").props.style).borderRadius).toBe(
      radius.control,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Send", disabled: false }));
    const cleared = StyleSheet.flatten(screen.getByLabelText("Message").props.style);
    expect(cleared.height).toBe(size.control);
    expect(cleared.borderRadius).toBe(radius.pill);
  });

  it("plays the send haptic when Send is pressed", async () => {
    withKey();
    await renderAppAt("/chat", fakeSession());
    await sendMessage("Hello");
    expect(fakeHaptics.play).toHaveBeenCalledWith("send");
    expect(fakeHaptics.play).toHaveBeenCalledTimes(1);
  });

  it("plays nothing on Send when haptics are off", async () => {
    fakeHapticsSetting.read.mockResolvedValue({ ok: true, value: false });
    withKey();
    await renderAppAt("/chat", fakeSession());
    await sendMessage("Hello");
    expect(fakeHaptics.play).not.toHaveBeenCalled();
  });

  async function swipeToReply(rowId: string) {
    await act(async () => {
      fireGestureHandler(getByGestureTestId(`reply-swipe-${rowId}`), [
        { state: State.BEGAN },
        { state: State.ACTIVE, translationX: 0 },
        { state: State.ACTIVE, translationX: 56 },
        { state: State.END, translationX: 56 },
      ]);
      // INFO: the router's test renderer fakes timers, and the gesture callbacks reach the JS
      // side through a microtask, which the fake clock holds until it moves.
      jest.advanceTimersByTime(0);
    });
  }

  const greeting = "Hi Ada! What would you like to talk about today?";

  it("swiping a tutor message shows the reply preview and plays one reply haptic", async () => {
    withKey();
    await renderAppAt("/chat", fakeSession());

    await swipeToReply("opening");

    expect(screen.getByText("Replying to Claude")).toBeTruthy();
    expect(screen.getAllByText(greeting)).toHaveLength(2);
    expect(fakeHaptics.play.mock.calls.filter(([kind]) => kind === "reply")).toHaveLength(1);
  });

  it("a learner message cannot be swiped", async () => {
    withKey();
    await renderAppAt("/chat", fakeSession());
    await sendMessage("Hello");

    expect(() => getByGestureTestId("reply-swipe-message-1")).toThrow();
    expect(getByGestureTestId("reply-swipe-message-2")).toBeTruthy();
  });

  it("the X cancels the reply", async () => {
    withKey();
    await renderAppAt("/chat", fakeSession());
    await swipeToReply("opening");

    await fireEvent.press(screen.getByRole("button", { name: "Cancel reply" }));

    expect(screen.queryByText("Replying to Claude")).toBeNull();
    expect(screen.getAllByText(greeting)).toHaveLength(1);
  });

  it("sending a reply clears the preview and draws the quote on the sent message", async () => {
    withKey();
    await renderAppAt("/chat", fakeSession());
    await swipeToReply("opening");

    await sendMessage("Hello");

    expect(screen.queryByText("Replying to Claude")).toBeNull();
    expect(screen.getByRole("button", { name: "Go to the quoted message" })).toBeTruthy();
    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("a resumed chat draws the quote of a saved reply", async () => {
    withKey();
    const tutor = saved("tutor", "Where do you want to go?");
    fakeData.openSession.mockResolvedValue({
      ok: true,
      value: {
        session,
        messages: [tutor, saved("user", "To Rome", { replyToId: tutor.id })],
        threadReplies: [],
      },
    });
    await renderAppAt({ pathname: "/chat", params: { session: "session-1" } }, fakeSession());

    expect(screen.getByRole("button", { name: "Go to the quoted message" })).toBeTruthy();
    expect(screen.getAllByText("Where do you want to go?")).toHaveLength(2);
    expect(screen.getByText("To Rome")).toBeTruthy();
  });

  it("a locked chat cannot start a reply", async () => {
    withKey("openai");
    await renderAppAt("/chat", fakeSession());

    expect(() => getByGestureTestId("reply-swipe-opening")).toThrow();
  });

  it("draws the starter's title and opener", async () => {
    withKey();
    await renderAppAt({ pathname: "/chat", params: { starter: starter.id } }, fakeSession());
    expect(screen.getByRole("header", { name: starter.title })).toBeTruthy();
    expect(screen.getByText(starter.opener)).toBeTruthy();
  });

  it("draws the starter's title in the no-key state", async () => {
    await renderAppAt({ pathname: "/chat", params: { starter: starter.id } }, fakeSession());
    expect(screen.getByRole("header", { name: starter.title })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "End session" })).toBeNull();
  });

  it("a message gets a tutor reply with corrections and new words", async () => {
    withKey();
    fakeAi.reply.mockResolvedValue({ ok: true, value: designReply });
    await renderAppAt("/chat", fakeSession());

    await sendMessage("I never been to Japan, but I want to go the next year.");

    expect(screen.getByText("I never been to Japan, but I want to go the next year.")).toBeTruthy();
    expect(screen.getByText("2 corrections")).toBeTruthy();
    expect(screen.getByText("the next year")).toBeTruthy();
    expect(screen.getByText("I never been")).toBeTruthy();
    expect(screen.getByText(/next year$/)).toBeTruthy();
    expect(screen.getByText("No article before next year; use the present perfect.")).toBeTruthy();
    expect(screen.getByText("New word")).toBeTruthy();
    expect(screen.getByText("definitely")).toBeTruthy();
    expect(screen.getByText("Japan is wonderful! What would you like to see there?")).toBeTruthy();
    expect(screen.getByPlaceholderText("Write in English\u2026").props.value).toBe("");
    expect(screen.queryByTestId("typing-indicator")).toBeNull();
  });

  it("shows the typing indicator while the reply is pending", async () => {
    withKey();
    let finish!: (value: Awaited<ReturnType<typeof fakeAi.reply>>) => void;
    fakeAi.reply.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await renderAppAt("/chat", fakeSession());

    await sendMessage("Hello");

    expect(screen.getByTestId("typing-indicator")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send", disabled: true })).toBeTruthy();
    await act(async () => finish({ ok: true, value: tutorReplyWith() }));
    expect(screen.queryByTestId("typing-indicator")).toBeNull();
  });

  it("draws the saved messages and corrections of a session from Continue", async () => {
    withKey();
    fakeData.openSession.mockResolvedValue({
      ok: true,
      value: {
        session,
        messages: [
          saved("tutor", "Where do you want to go?"),
          saved("user", "I goed to Rome", {
            corrections: {
              items: [{ original: "goed", corrected: "went" }],
              explanation: "Go is irregular.",
            },
            newWords: ["itinerary"],
          }),
        ],
        threadReplies: [],
      },
    });
    await renderAppAt({ pathname: "/chat", params: { session: "session-1" } }, fakeSession());

    expect(fakeData.openSession).toHaveBeenCalledWith("session-1");
    expect(screen.getByRole("header", { name: "Travel plans" })).toBeTruthy();
    expect(screen.getByText("Where do you want to go?")).toBeTruthy();
    expect(screen.getByText("I goed to Rome")).toBeTruthy();
    expect(screen.getByText("1 correction")).toBeTruthy();
    expect(screen.getByText("Go is irregular.")).toBeTruthy();
    expect(screen.getByText("itinerary")).toBeTruthy();
  });

  describe("threads", () => {
    const corrected = (extra: Partial<Message> = {}) =>
      saved("user", "I goed to Rome", {
        corrections: {
          items: [{ original: "goed", corrected: "went" }],
          explanation: "Go is irregular.",
        },
        ...extra,
      });
    const resumed = { pathname: "/chat", params: { session: "session-1" } } as const;

    function openWith(
      messages: Message[],
      threadReplies: { messageId: string; count: number }[] = [],
    ) {
      fakeData.openSession.mockResolvedValue({
        ok: true,
        value: { session, messages, threadReplies },
      });
    }

    it("a resumed session draws Ask about this with 2 replies under the corrections", async () => {
      withKey();
      const message = corrected();
      openWith([saved("tutor", "Where?"), message], [{ messageId: message.id, count: 2 }]);
      await renderAppAt(resumed, fakeSession());

      expect(screen.getByText("Ask about this")).toBeTruthy();
      expect(screen.getByText("2 replies")).toBeTruthy();
    });

    it("draws the row without a count when the thread has no messages", async () => {
      withKey();
      openWith([corrected()]);
      await renderAppAt(resumed, fakeSession());
      expect(screen.getByText("Ask about this")).toBeTruthy();
      expect(screen.queryByText(/repl(y|ies)$/)).toBeNull();
    });

    it("draws no row for a message without corrections", async () => {
      withKey();
      openWith([saved("tutor", "Where?"), saved("user", "Rome")]);
      await renderAppAt(resumed, fakeSession());
      expect(screen.queryByText("Ask about this")).toBeNull();
    });

    it("draws no row for a message that is still being saved", async () => {
      withKey();
      const pending = deferred<Awaited<ReturnType<typeof fakeData.addMessage>>>();
      // INFO: the opener saves, then the learner's message waits for its write.
      fakeData.addMessage
        .mockResolvedValueOnce({ ok: true, value: saved("tutor", "opening") })
        .mockReturnValue(pending.promise);
      fakeAi.reply.mockResolvedValue({ ok: true, value: designReply });
      await renderAppAt("/chat", fakeSession());

      await sendMessage("I never been to Japan, but I want to go the next year.");

      expect(screen.getByText("2 corrections")).toBeTruthy();
      expect(screen.queryByText("Ask about this")).toBeNull();
      await act(async () => pending.resolve({ ok: true, value: saved("user", "x") }));
    });

    it("tapping Ask about this opens the thread of that saved message", async () => {
      withKey();
      const message = corrected();
      openWith([saved("tutor", "Where?"), message]);
      fakeData.openThread.mockResolvedValue({
        ok: true,
        value: {
          session,
          message,
          messages: [],
        },
      });
      await renderAppAt(resumed, fakeSession());

      await fireEvent.press(screen.getByRole("button", { name: "Ask about this" }));

      expect(screen).toHavePathname("/thread");
      expect(screen).toHaveSearchParams({ message: message.id });
      expect(fakeData.openThread).toHaveBeenCalledWith(message.id);
      expect(await screen.findByRole("header", { name: "Correction" })).toBeTruthy();
      expect(screen.getByText("I goed to Rome")).toBeTruthy();
    });

    it("coming back from a thread draws the new count and the withdrawn correction", async () => {
      withKey();
      const message = corrected();
      openWith([saved("tutor", "Where?"), message]);
      fakeData.openThread.mockResolvedValue({
        ok: true,
        value: { session, message, messages: [] },
      });
      await renderAppAt(resumed, fakeSession());
      await fireEvent.press(screen.getByRole("button", { name: "Ask about this" }));
      expect(await screen.findByRole("header", { name: "Correction" })).toBeTruthy();
      expect(screen.queryByText("Withdrawn")).toBeNull();

      openWith(
        [
          saved("tutor", "Where?"),
          corrected({
            corrections: {
              items: [{ original: "goed", corrected: "went", withdrawn: true }],
              explanation: "Go is irregular.",
            },
          }),
        ],
        [{ messageId: message.id, count: 2 }],
      );
      await act(async () => router.back());

      expect(await screen.findByText("2 replies")).toBeTruthy();
      expect(screen.getByText("Withdrawn")).toBeTruthy();
      expect(screen.getByText("goed → went")).toBeTruthy();
    });

    it("draws the count but no thread text in the chat", async () => {
      withKey();
      const message = corrected();
      openWith([message], [{ messageId: message.id, count: 3 }]);
      fakeData.openThread.mockResolvedValue({
        ok: true,
        value: {
          session,
          message,
          messages: [
            {
              id: "t1",
              messageId: message.id,
              role: "user",
              text: "Why is it wrong?",
              newWords: null,
              createdAt: "2026-11-05T09:10:00Z",
            },
          ],
        },
      });
      await renderAppAt(resumed, fakeSession());

      expect(screen.getByText("3 replies")).toBeTruthy();
      expect(screen.queryByText("Why is it wrong?")).toBeNull();
      expect(fakeData.openThread).not.toHaveBeenCalled();
    });
  });

  it("draws the ended message for an ended session", async () => {
    withKey();
    fakeData.openSession.mockResolvedValue({
      ok: true,
      value: { session: { ...session, status: "ended" }, messages: [], threadReplies: [] },
    });
    await renderAppAt({ pathname: "/chat", params: { session: "session-1" } }, fakeSession());
    expect(screen.getByText("This conversation has ended.")).toBeTruthy();
  });

  it("draws the invalid key message, with the cause in development, and Update key opens the key step", async () => {
    withKey();
    fakeAi.reply.mockResolvedValue({
      ok: false,
      failure: "invalid_key",
      cause: { name: "HttpError", code: "authentication_error", detail: null },
    });
    await renderAppAt("/chat", fakeSession());

    await sendMessage("Hello");

    expect(
      screen.getByText("Your API key was not accepted. Update it to keep chatting."),
    ).toBeTruthy();
    expect(screen.getByText("HttpError (authentication_error)")).toBeTruthy();
    expect(screen.getByPlaceholderText("Write in English\u2026").props.value).toBe("Hello");
    await fireEvent.press(screen.getByRole("button", { name: "Update key" }));
    expect(screen).toHavePathname("/api-key");
  });

  it("hides the cause line outside development", async () => {
    setDev(false);
    withKey();
    fakeAi.reply.mockResolvedValue({
      ok: false,
      failure: "invalid_key",
      cause: { name: "HttpError", code: "authentication_error", detail: null },
    });
    await renderAppAt("/chat", fakeSession());

    await sendMessage("Hello");

    expect(
      screen.getByText("Your API key was not accepted. Update it to keep chatting."),
    ).toBeTruthy();
    expect(screen.queryByText("HttpError (authentication_error)")).toBeNull();
  });

  it("draws the rate limit message and Try again sends the same text again", async () => {
    withKey();
    fakeAi.reply.mockResolvedValueOnce({ ok: false, failure: "rate_limited" });
    await renderAppAt("/chat", fakeSession());

    await sendMessage("Hello");
    expect(
      screen.getByText(
        "Too many messages for your API key right now. Wait a moment and try again.",
      ),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));

    expect(fakeAi.reply).toHaveBeenCalledTimes(2);
    expect(fakeAi.reply.mock.calls[1][0].turns.at(-1)).toEqual({ role: "user", text: "Hello" });
    expect(screen.queryByText(/Too many messages/)).toBeNull();
    expect(screen.getByText("Nice! Where did you go?")).toBeTruthy();
  });

  it.each([
    ["overloaded", "The AI is busy right now. Try again in a moment."],
    ["network", "Could not reach the AI. Check your connection and try again."],
  ] as const)("draws the %s message with Try again", async (failure, message) => {
    withKey();
    fakeAi.reply.mockResolvedValue({ ok: false, failure });
    await renderAppAt("/chat", fakeSession());

    await sendMessage("Hello");

    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("draws a save failure and Try again resumes the rest without asking the tutor again", async () => {
    withKey();
    fakeData.addUsage.mockResolvedValueOnce({ ok: false, failure: "network" });
    await renderAppAt("/chat", fakeSession());

    await sendMessage("Hello");
    expect(screen.getByText(dataFailureMessage("network"))).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));

    expect(fakeAi.reply).toHaveBeenCalledTimes(1);
    expect(fakeData.addUsage).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(dataFailureMessage("network"))).toBeNull();
  });

  it("warns above the input at 80% of the limit and Send still works", async () => {
    withKey("claude", { monthlyLimitUsd: 10 });
    fakeData.getMonthSpend.mockResolvedValue({
      ok: true,
      value: { monthStart: "2026-11-01", spentUsd: 8 },
    });
    await renderAppAt("/chat", fakeSession());
    expect(screen.getByText("You're close to your monthly limit.")).toBeTruthy();

    await sendMessage("Hello");

    expect(fakeAi.reply).toHaveBeenCalledTimes(1);
  });

  it("blocks sending at 100% of the limit and never calls the AI", async () => {
    withKey("claude", { monthlyLimitUsd: 10 });
    fakeData.getMonthSpend.mockResolvedValue({
      ok: true,
      value: { monthStart: "2026-11-01", spentUsd: 10 },
    });
    await renderAppAt("/chat", fakeSession());

    expect(screen.getByText("You reached your monthly limit.")).toBeTruthy();
    expect(screen.getByText("SpendLimit")).toBeTruthy();
    expect(screen.getByPlaceholderText("Write in English\u2026").props.editable).toBe(false);
    expect(screen.getByRole("button", { name: "Send", disabled: true })).toBeTruthy();
    expect(fakeAi.reply).not.toHaveBeenCalled();
  });

  it("says OpenAI is coming soon, offers Update key and locks sending", async () => {
    withKey("openai");
    await renderAppAt("/chat", fakeSession());

    expect(screen.getByText("OpenAI is coming soon. Use a Claude key for now.")).toBeTruthy();
    expect(screen.getByPlaceholderText("Write in English\u2026").props.editable).toBe(false);
    expect(screen.getByRole("button", { name: "Send", disabled: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Update key" }));
    expect(screen).toHavePathname("/api-key");
  });

  it("End after a turn saves and opens the session's Summary", async () => {
    withKey();
    await renderAppAt("/chat", fakeSession());
    await sendMessage("Hello");

    await confirmEnd();

    expect(fakeData.endSession).toHaveBeenCalledWith("session-1");
    expect(screen).toHavePathname("/summary");
    expect(screen).toHaveSearchParams({ session: "session-1" });
    expect(await screen.findByText("Nice work, Ada!")).toBeTruthy();
  });

  it.each([
    ["Home", [] as string[]],
    ["Suggestions", ["/suggestions"]],
    ["Open chats", ["/chats"]],
  ])("going back from Summary lands on Home when the chat came from %s", async (_name, via) => {
    withKey();
    await renderApp("/", fakeSession());
    for (const path of via) await act(async () => router.push(path as Href));
    await act(async () => router.push("/chat"));
    await sendMessage("Hello");

    await confirmEnd();
    expect(screen).toHavePathname("/summary");
    await act(async () => router.back());

    expect(screen).toHavePathname("/");
  });

  it("asks to confirm before ending", async () => {
    withKey();
    await renderAppAt("/chat", fakeSession());
    await sendMessage("Hello");

    await fireEvent.press(screen.getByRole("button", { name: "End session" }));

    expect(Alert.alert).toHaveBeenCalledWith("End this session?", undefined, expect.any(Array));
    expect(alertButtons().map((button) => [button.text, button.style])).toEqual([
      ["Cancel", "cancel"],
      ["End", "destructive"],
    ]);
    expect(fakeData.endSession).not.toHaveBeenCalled();
    expect(screen).toHavePathname("/chat");
  });

  it("Cancel keeps the chat open and ends nothing", async () => {
    withKey();
    await renderAppAt("/chat", fakeSession());
    await sendMessage("Hello");

    await fireEvent.press(screen.getByRole("button", { name: "End session" }));
    await act(async () =>
      alertButtons()
        .find((button) => button.text === "Cancel")
        ?.onPress?.(),
    );

    expect(fakeData.endSession).not.toHaveBeenCalled();
    expect(screen).toHavePathname("/chat");
    expect(screen.getByPlaceholderText("Write in English\u2026")).toBeTruthy();
  });

  it("Back after a turn keeps the session open and Home offers Continue", async () => {
    withKey();
    fakeData.listOpenSessions.mockResolvedValue({
      ok: true,
      value: [activeSessionWith({ id: "session-1", title: "Free chat" })],
    });
    await renderAppAt("/chat", fakeSession());
    await sendMessage("Hello");

    await fireEvent.press(screen.getByRole("button", { name: "Back to Home" }));

    expect(fakeData.endSession).not.toHaveBeenCalled();
    expect(screen).toHavePathname("/");
    expect(await screen.findByText("Continue")).toBeTruthy();
  });

  it("End before any message goes Home and writes nothing", async () => {
    withKey();
    await renderAppAt("/chat", fakeSession());

    await confirmEnd();

    expect(screen).toHavePathname("/");
    expect(fakeData.endSession).not.toHaveBeenCalled();
    expect(fakeData.createSession).not.toHaveBeenCalled();
  });

  it("draws an End failure and stays in the chat", async () => {
    withKey();
    fakeData.endSession.mockResolvedValue({ ok: false, failure: "network" });
    await renderAppAt("/chat", fakeSession());
    await sendMessage("Hello");

    await confirmEnd();

    expect(screen).toHavePathname("/chat");
    expect(screen.getByText(dataFailureMessage("network"))).toBeTruthy();
  });

  it("draws the month spend failure", async () => {
    withKey();
    fakeData.getMonthSpend.mockResolvedValue({ ok: false, failure: "unavailable" });
    await renderAppAt("/chat", fakeSession());
    expect(screen.getByText(dataFailureMessage("unavailable"))).toBeTruthy();
  });

  it("draws the key read failure and reads again on Try again", async () => {
    fakeKeys.hasApiKey.mockResolvedValueOnce({ ok: false, failure: "not_read" });
    await renderAppAt("/chat", fakeSession());
    expect(screen.getByText(keyReadFailureMessage)).toBeTruthy();
    withKey();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("Claude")).toBeTruthy();
    expect(fakeKeys.hasApiKey).toHaveBeenCalledTimes(2);
  });

  it("draws the profile failure when a key is saved and the server cannot be reached", async () => {
    fakeKeys.hasApiKey.mockResolvedValue({ ok: true, value: true });
    fakeData.getProfile.mockResolvedValue({ ok: false, failure: "network" });
    await renderAppAt("/chat", fakeSession());
    expect(screen.getByText(dataFailureMessage("network"))).toBeTruthy();
  });

  it("goes back from Back to Home", async () => {
    await renderAppAt("/chat", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Back to Home" }));
    expect(screen).toHavePathname("/");
  });

  it("shows the provider after a key is saved in the key step and it goes back", async () => {
    await renderAppAt("/chat", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Add API key" }));
    withKey("openai");
    fakeData.updateProfile.mockResolvedValue({ ok: true, value: completedProfile() });
    await fireEvent.changeText(screen.getByLabelText("API key"), generatedSecret("api-key"));
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    expect(screen).toHavePathname("/chat");
    expect(screen.getByText("OpenAI")).toBeTruthy();
  });

  it("lands on Login when signed out at Chat", async () => {
    await renderApp("/chat", null);
    expect(screen).toHavePathname("/sign-in");
    expect(screen.queryByText("Connect your AI to start")).toBeNull();
  });
});
