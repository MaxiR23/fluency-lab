// apps/mobile/test/app/practice-run.test.tsx
//
// Tests for the practice run screen: the exercises and the result.
//
// Tested:
// - Loading, no key with Add API key, the failed state with Try again, and generating
// - A choose exercise: the kind, the rule, the prompt with its gap, three options, the progress
// - The header: the bar takes the leftover width, the count keeps one line and never shrinks
// - The gap: the empty 120 point slot, the filled answer underlined in the prompt slot font
// - Submitting a typed answer, by return or Check, closes the keyboard
// - A right pick raises Nice one and plays right, a wrong pick raises Not quite and plays miss, Continue goes on
// - A fix exercise: the source card, the answer field, Check disabled while empty
// - A typed match is graded with no tutor call; a typed miss asks the tutor and shows its explanation
// - The result: the offer at 5 with a miss, Keep going asking a round, Finish for today going Home, no offer at 15
// - The 100% limit locks answering, the 80% warning keeps going, an invalid key offers Update key
// - The study note: Make me a study note on a miss, opening the saved note, hidden on a right answer and in a words run, its failures
// - Stop goes Home
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/app/practice-run.test.tsx
//
// SEE: apps/mobile/src/app/practice-run.tsx

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen, within } from "@testing-library/react-native";
import { Keyboard, StyleSheet } from "react-native";

import { segmentedProgressBar } from "@/components/segmented-progress-style";
import { gapSlotStyle, textStyle } from "@/components/text-style";

import { dataFailureMessage } from "@/utils/data-message";
import { fakeSession, resetFakeAuth } from "../helpers/fake-auth";
import {
  answerGradeWith,
  exerciseWith,
  fakeAi,
  practiceRoundWith,
  resetFakeAi,
} from "../helpers/fake-ai";
import {
  fakeData,
  mistakeGroupWith,
  practiceItemWith,
  practiceRunWith,
  practiceTodayWith,
  profileWith,
  resetFakeData,
} from "../helpers/fake-data";
import { fakeHaptics } from "../helpers/fake-haptics";
import { fakeKeys, resetFakeKeys } from "../helpers/fake-keys";
import { renderAppAt } from "../helpers/render-app";

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
jest.mock("@/utils/device-language", () => ({ deviceLanguage: jest.fn(() => null) }));

const start = {
  pathname: "/practice-run",
  params: { focus: "mistakes", target: "5" },
} as const;
const resume = { pathname: "/practice-run", params: { run: "run-1" } } as const;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("Practice run", () => {
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

  function withKey(provider: "claude" | "openai" = "claude", limit: number | null = 10) {
    fakeKeys.hasApiKey.mockResolvedValue({ ok: true, value: true });
    fakeData.getProfile.mockResolvedValue({
      ok: true,
      value: profileWith({
        provider,
        displayName: "Ada",
        level: "intermediate",
        monthlyLimitUsd: limit,
        onboardingCompletedAt: "2026-11-05T10:00:00Z",
      }),
    });
    fakeData.listMistakes.mockResolvedValue({
      ok: true,
      value: { items: [mistakeGroupWith({ rule: "Present perfect" })], nextOffset: null },
    });
    fakeData.createPracticeRun.mockImplementation(async (input) => ({
      ok: true,
      value: practiceRunWith({ focus: input.focus, target: input.target }),
    }));
    fakeData.addPracticeItems.mockImplementation(async (runId, items) => ({
      ok: true,
      value: items.map((item) => practiceItemWith({ ...item, id: `item-${item.position}`, runId })),
    }));
    fakeData.addPracticeUsage.mockResolvedValue({ ok: true, value: practiceRunWith() });
    fakeData.answerPracticeItem.mockImplementation(async (itemId, answer) => ({
      ok: true,
      value: practiceItemWith({ id: itemId, ...answer }),
    }));
    fakeData.finishPracticeRun.mockResolvedValue({
      ok: true,
      value: practiceRunWith({ finishedAt: "2026-11-05T11:00:00Z" }),
    });
    fakeData.setPracticeTarget.mockImplementation(async (_id, target) => ({
      ok: true,
      value: practiceRunWith({ target }),
    }));
  }

  function withSpent(spentUsd: number) {
    fakeData.getMonthSpend.mockResolvedValue({
      ok: true,
      value: { monthStart: "2026-11-01", spentUsd },
    });
  }

  function withTypedRound() {
    fakeAi.practiceRound.mockResolvedValue({
      ok: true,
      value: practiceRoundWith({
        items: Array.from({ length: 5 }, () =>
          exerciseWith({
            kind: "fix",
            prompt: "I never been to Japan.",
            options: null,
            accepted: ["I've never been to Japan."],
            source: "I never been to Japan.",
          }),
        ),
      }),
    });
  }

  function opened(marks: (boolean | null)[], run: Parameters<typeof practiceRunWith>[0] = {}) {
    fakeData.openPracticeRun.mockResolvedValue({
      ok: true,
      value: practiceTodayWith(
        marks.map((correct, position) =>
          practiceItemWith({
            id: `item-${position}`,
            position,
            correct,
            userAnswer: correct === null ? null : "x",
            rule: position === 3 ? "Articles" : "Present perfect",
          }),
        ),
        run,
      ),
    });
  }

  it("draws the loading state while the key is read", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fakeKeys.hasApiKey>>>();
    fakeKeys.hasApiKey.mockReturnValue(pending.promise);
    await renderAppAt(start, fakeSession());
    expect(screen.getByTestId("practice-run-loading")).toBeTruthy();
    await act(async () => pending.resolve({ ok: true, value: false }));
    expect(screen.queryByTestId("practice-run-loading")).toBeNull();
  });

  it("draws the no-key state with Add API key", async () => {
    await renderAppAt(start, fakeSession());
    expect(screen.getByText("Connect your AI to start")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stop practice" })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Add API key" }));
    expect(screen).toHavePathname("/api-key");
  });

  it("draws the failure and reads again on Try again", async () => {
    withKey();
    fakeData.getMonthSpend.mockResolvedValueOnce({ ok: false, failure: "network" });
    await renderAppAt(start, fakeSession());
    expect(screen.getByText(dataFailureMessage("network"))).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(screen.queryByText(dataFailureMessage("network"))).toBeNull();
    expect(screen.getByText("Choose the answer")).toBeTruthy();
  });

  it("draws the failure for a practice that is not found", async () => {
    withKey();
    fakeData.openPracticeRun.mockResolvedValue({ ok: false, failure: "not_found" });
    await renderAppAt(resume, fakeSession());
    expect(screen.getByText("This practice could not be found.")).toBeTruthy();
  });

  it("draws the generating state while the first round is asked", async () => {
    withKey();
    const pending = deferred<Awaited<ReturnType<typeof fakeAi.practiceRound>>>();
    fakeAi.practiceRound.mockReturnValue(pending.promise);
    await renderAppAt(start, fakeSession());
    expect(screen.getByText("Getting your exercises ready…")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stop practice" })).toBeTruthy();
    expect(screen.getByRole("progressbar")).toBeTruthy();
    await act(async () => pending.resolve({ ok: true, value: practiceRoundWith() }));
    expect(screen.queryByText("Getting your exercises ready…")).toBeNull();
  });

  it("draws a choose exercise with its kind, rule, prompt, options and progress", async () => {
    withKey();
    await renderAppAt(start, fakeSession());
    expect(screen.getByText("Choose the answer")).toBeTruthy();
    expect(screen.getByText("Present perfect")).toBeTruthy();
    expect(screen.getByText(/I\s*to Japan 1 times\./)).toBeTruthy();
    expect(screen.getByRole("button", { name: "have been" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "was" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "am" })).toBeTruthy();
    expect(screen.getByText("1/5")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Exercise 1 of 5" })).toBeTruthy();
    expect(fakeAi.practiceRound).toHaveBeenCalledTimes(1);
  });

  it("raises Nice one on a right pick, plays right and calls no tutor", async () => {
    withKey();
    await renderAppAt(start, fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "have been" }));
    expect(screen.getByText("Nice one!")).toBeTruthy();
    expect(screen.getByText("Use the present perfect for an experience.")).toBeTruthy();
    expect(fakeHaptics.play).toHaveBeenCalledWith("right");
    expect(fakeHaptics.play).toHaveBeenCalledTimes(1);
    expect(fakeAi.gradeAnswer).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "was", disabled: true })).toBeTruthy();
  });

  it("fits the progress bar and keeps the count whole in the header", async () => {
    withKey();
    await renderAppAt(start, fakeSession());
    const bar = StyleSheet.flatten(screen.getByRole("progressbar").props.style);
    expect(bar).toMatchObject(segmentedProgressBar("exercise"));
    expect(bar).toMatchObject({ flex: 1, minWidth: 0 });
    expect(bar).not.toHaveProperty("flexGrow");
    const count = screen.getByText("1/5");
    expect(count.props.numberOfLines).toBe(1);
    expect(StyleSheet.flatten(count.props.style)).toMatchObject({ flexShrink: 0 });
  });

  it("draws the empty gap as a 120 point slot with its underline", async () => {
    withKey();
    await renderAppAt(start, fakeSession());
    expect(StyleSheet.flatten(screen.getByTestId("gap-slot").props.style)).toEqual(gapSlotStyle());
  });

  it("draws the filled gap as the underlined answer and drops the empty slot", async () => {
    withKey();
    await renderAppAt(start, fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "have been" }));
    const styles = screen
      .getAllByText("have been")
      .map((node) => StyleSheet.flatten(node.props.style));
    expect(styles).toContainEqual(textStyle("promptSlot"));
    expect(screen.queryByTestId("gap-slot")).toBeNull();
  });

  it("raises Not quite on a wrong pick with the answer and plays miss", async () => {
    withKey();
    await renderAppAt(start, fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "was" }));
    expect(screen.getByText("Not quite")).toBeTruthy();
    expect(screen.getByText(/Answer:/)).toBeTruthy();
    expect(within(screen.getByTestId("feedback-sheet")).getByText(/have been/)).toBeTruthy();
    expect(fakeHaptics.play).toHaveBeenCalledWith("miss");
    expect(fakeHaptics.play).toHaveBeenCalledTimes(1);
  });

  describe("the study note", () => {
    it("shows Make me a study note on a miss and opens the saved note", async () => {
      withKey();
      await renderAppAt(start, fakeSession());
      await fireEvent.press(screen.getByRole("button", { name: "was" }));
      await fireEvent.press(screen.getByRole("button", { name: "Make me a study note" }));

      expect(fakeAi.studyNote).toHaveBeenCalledTimes(1);
      expect(fakeData.createNote).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: null, kind: "table", title: "Future forms" }),
      );
      expect(fakeData.addPracticeUsage).toHaveBeenCalledTimes(2);
      expect(screen).toHavePathname("/note");
      expect(screen).toHaveSearchParams({ id: "note-1" });
      expect(await screen.findByRole("header", { name: "Future forms" })).toBeTruthy();
    });

    it("goes back to the same miss sheet from the note", async () => {
      withKey();
      await renderAppAt(start, fakeSession());
      await fireEvent.press(screen.getByRole("button", { name: "was" }));
      await fireEvent.press(screen.getByRole("button", { name: "Make me a study note" }));
      await screen.findByRole("header", { name: "Future forms" });
      await fireEvent.press(screen.getByRole("button", { name: "Back" }));

      expect(screen).toHavePathname("/practice-run");
      expect(screen.getByText("Not quite")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Make me a study note" })).toBeTruthy();
    });

    it("does not show it on a right answer", async () => {
      withKey();
      await renderAppAt(start, fakeSession());
      await fireEvent.press(screen.getByRole("button", { name: "have been" }));
      expect(screen.getByText("Nice one!")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Make me a study note" })).toBeNull();
    });

    it("does not show it in a words run", async () => {
      withKey();
      await renderAppAt({ pathname: "/practice-run", params: { focus: "words" } }, fakeSession());
      await fireEvent.press(screen.getByRole("button", { name: "was" }));
      expect(screen.getByText("Not quite")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Make me a study note" })).toBeNull();
    });

    it("shows the note failure with Try again and asks again", async () => {
      withKey();
      fakeAi.studyNote.mockResolvedValueOnce({ ok: false, failure: "rate_limited" });
      await renderAppAt(start, fakeSession());
      await fireEvent.press(screen.getByRole("button", { name: "was" }));
      await fireEvent.press(screen.getByRole("button", { name: "Make me a study note" }));

      expect(screen.getByText("Not quite")).toBeTruthy();
      expect(screen).toHavePathname("/practice-run");
      await fireEvent.press(screen.getByRole("button", { name: "Try again" }));

      expect(fakeAi.studyNote).toHaveBeenCalledTimes(2);
      expect(screen).toHavePathname("/note");
    });

    it("keeps the sheet and shows the failure when the note cannot be saved", async () => {
      withKey();
      fakeData.createNote.mockResolvedValue({ ok: false, failure: "network" });
      await renderAppAt(start, fakeSession());
      await fireEvent.press(screen.getByRole("button", { name: "was" }));
      await fireEvent.press(screen.getByRole("button", { name: "Make me a study note" }));

      expect(screen).toHavePathname("/practice-run");
      expect(screen.getByText("Not quite")).toBeTruthy();
      expect(screen.getByText(dataFailureMessage("network"))).toBeTruthy();
    });
  });

  it("goes on to the next exercise on Continue", async () => {
    withKey();
    await renderAppAt(start, fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "have been" }));
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    expect(screen.queryByText("Nice one!")).toBeNull();
    expect(screen.getByText("2/5")).toBeTruthy();
    expect(screen.getByText(/I\s*to Japan 2 times\./)).toBeTruthy();
  });

  it("draws a fix exercise with its source card and a disabled Check while empty", async () => {
    withKey();
    withTypedRound();
    await renderAppAt(start, fakeSession());
    expect(screen.getByText("Fix the sentence")).toBeTruthy();
    expect(screen.getByText("From your chat")).toBeTruthy();
    expect(screen.getByText("I never been to Japan.")).toBeTruthy();
    expect(screen.getByLabelText("Your answer")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check", disabled: true })).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Your answer"), "I've never been");
    expect(screen.getByRole("button", { name: "Check", disabled: false })).toBeTruthy();
  });

  it("grades a typed match with no tutor call", async () => {
    withKey();
    withTypedRound();
    await renderAppAt(start, fakeSession());
    await fireEvent.changeText(screen.getByLabelText("Your answer"), "i've never been to japan");
    await fireEvent.press(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByText("Nice one!")).toBeTruthy();
    expect(fakeAi.gradeAnswer).not.toHaveBeenCalled();
    expect(fakeHaptics.play).toHaveBeenCalledWith("right");
  });

  it("closes the keyboard when a typed answer is submitted by return", async () => {
    withKey();
    withTypedRound();
    const dismiss = jest.spyOn(Keyboard, "dismiss");
    await renderAppAt(start, fakeSession());
    await fireEvent.changeText(screen.getByLabelText("Your answer"), "i've never been to japan");
    await fireEvent(screen.getByLabelText("Your answer"), "submitEditing");
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Nice one!")).toBeTruthy();
  });

  it("closes the keyboard when Check is pressed", async () => {
    withKey();
    withTypedRound();
    const dismiss = jest.spyOn(Keyboard, "dismiss");
    await renderAppAt(start, fakeSession());
    await fireEvent.changeText(screen.getByLabelText("Your answer"), "i've never been to japan");
    await fireEvent.press(screen.getByRole("button", { name: "Check" }));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it("asks the tutor for a typed miss and shows its explanation and the answer", async () => {
    withKey();
    withTypedRound();
    fakeAi.gradeAnswer.mockResolvedValue({
      ok: true,
      value: answerGradeWith({ correct: false, explanation: "Never was is not natural." }),
    });
    await renderAppAt(start, fakeSession());
    await fireEvent.changeText(screen.getByLabelText("Your answer"), "I never was to Japan.");
    await fireEvent.press(screen.getByRole("button", { name: "Check" }));
    expect(fakeAi.gradeAnswer).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Not quite")).toBeTruthy();
    expect(screen.getByText("Never was is not natural.")).toBeTruthy();
    expect(screen.getByText(/I've never been to Japan\./)).toBeTruthy();
    expect(fakeHaptics.play).toHaveBeenCalledWith("miss");
  });

  it("shows the tutor's explanation on a flawed exercise and no answer line", async () => {
    withKey();
    withTypedRound();
    fakeAi.gradeAnswer.mockResolvedValue({
      ok: true,
      value: answerGradeWith({
        correct: false,
        flawed: true,
        explanation: "Two answers fit here.",
      }),
    });
    await renderAppAt(start, fakeSession());
    await fireEvent.changeText(screen.getByLabelText("Your answer"), "I never was to Japan.");
    await fireEvent.press(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByText("Nice one!")).toBeTruthy();
    expect(screen.getByText("Two answers fit here.")).toBeTruthy();
    expect(screen.queryByText(/Answer:/)).toBeNull();
    expect(fakeHaptics.play).toHaveBeenCalledWith("right");
  });

  it("shows Check loading while the tutor grades", async () => {
    withKey();
    withTypedRound();
    const pending = deferred<Awaited<ReturnType<typeof fakeAi.gradeAnswer>>>();
    fakeAi.gradeAnswer.mockReturnValue(pending.promise);
    await renderAppAt(start, fakeSession());
    await fireEvent.changeText(screen.getByLabelText("Your answer"), "I never was to Japan.");
    await fireEvent.press(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByRole("button", { name: "Check", busy: true })).toBeTruthy();
    await act(async () => pending.resolve({ ok: true, value: answerGradeWith() }));
    expect(screen.getByText("Not quite")).toBeTruthy();
  });

  it("keeps the answer and offers Try again after a failed grading", async () => {
    withKey();
    withTypedRound();
    fakeAi.gradeAnswer.mockResolvedValueOnce({ ok: false, failure: "network" });
    await renderAppAt(start, fakeSession());
    await fireEvent.changeText(screen.getByLabelText("Your answer"), "I never was to Japan.");
    await fireEvent.press(screen.getByRole("button", { name: "Check" }));
    expect(
      screen.getByText("Could not reach the AI. Check your connection and try again."),
    ).toBeTruthy();
    expect(screen.getByLabelText("Your answer").props.value).toBe("I never was to Japan.");
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(fakeAi.gradeAnswer).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Not quite")).toBeTruthy();
  });

  it("offers 5 more at 5 with a miss", async () => {
    withKey();
    opened([true, true, true, true, false]);
    await renderAppAt(resume, fakeSession());
    expect(screen.getByText("Almost there, Ada")).toBeTruthy();
    expect(screen.getByText("One slipped. 5 more on present perfect to lock it in.")).toBeTruthy();
    expect(screen.getByText("4/5")).toBeTruthy();
    expect(screen.getByText("Present perfect")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Keep going · 5 more" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Finish for today" })).toBeTruthy();
    expect(fakeData.finishPracticeRun).not.toHaveBeenCalled();
  });

  it("asks a new round on Keep going", async () => {
    withKey();
    opened([true, true, true, true, false]);
    await renderAppAt(resume, fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Keep going · 5 more" }));
    expect(fakeData.setPracticeTarget).toHaveBeenCalledWith("run-1", 10);
    expect(fakeAi.practiceRound).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Choose the answer")).toBeTruthy();
    expect(screen.getByText("6/10")).toBeTruthy();
  });

  it("finishes the run and goes Home on Finish for today", async () => {
    withKey();
    opened([true, true, true, true, false]);
    await renderAppAt(resume, fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Finish for today" }));
    expect(fakeData.finishPracticeRun).toHaveBeenCalledWith("run-1");
    expect(screen).toHavePathname("/");
  });

  it("finishes the run from the close button on the result", async () => {
    withKey();
    opened([true, true, true, true, false]);
    await renderAppAt(resume, fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    expect(fakeData.finishPracticeRun).toHaveBeenCalledWith("run-1");
    expect(screen).toHavePathname("/");
  });

  it("has no offer at 15 and finishes the run at once", async () => {
    withKey();
    opened(
      Array.from({ length: 15 }, (_, position) => position !== 12),
      { target: 15 },
    );
    await renderAppAt(resume, fakeSession());
    expect(screen.getByText("Good work, Ada")).toBeTruthy();
    expect(screen.getByText("14 of 15 right today.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Keep going · 5 more" })).toBeNull();
    expect(screen.getByRole("button", { name: "Finish for today" })).toBeTruthy();
    expect(fakeData.finishPracticeRun).toHaveBeenCalledWith("run-1");
  });

  it("writes Nice work when nothing was missed", async () => {
    withKey();
    opened([true, true, true, true, true], { finishedAt: "2026-11-05T11:00:00Z" });
    await renderAppAt(resume, fakeSession());
    expect(screen.getByText("Nice work, Ada")).toBeTruthy();
    expect(screen.getByText("All 5 right.")).toBeTruthy();
    expect(fakeData.finishPracticeRun).not.toHaveBeenCalled();
  });

  it("locks answering and shows the limit notice at 100%", async () => {
    withKey("claude", 1);
    withSpent(1);
    opened([null, null, null, null, null]);
    await renderAppAt(resume, fakeSession());
    expect(screen.getByText("You reached your monthly limit.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "have been", disabled: true })).toBeTruthy();
    expect(screen.getByText("Choose the answer")).toBeTruthy();
  });

  it("does not ask a round at 100%", async () => {
    withKey("claude", 1);
    withSpent(1);
    await renderAppAt(start, fakeSession());
    expect(fakeAi.practiceRound).not.toHaveBeenCalled();
    expect(screen.getByText("You reached your monthly limit.")).toBeTruthy();
  });

  it("warns at 80% and keeps going", async () => {
    withKey("claude", 10);
    withSpent(8);
    await renderAppAt(start, fakeSession());
    expect(screen.getByText("You're close to your monthly limit.")).toBeTruthy();
    expect(fakeAi.practiceRound).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "have been" })).toBeTruthy();
  });

  it("shows the OpenAI notice and does not ask", async () => {
    withKey("openai");
    await renderAppAt(start, fakeSession());
    expect(fakeAi.practiceRound).not.toHaveBeenCalled();
    expect(screen.getByText("OpenAI is coming soon. Use a Claude key for now.")).toBeTruthy();
  });

  it("offers Update key after an invalid key and opens the key screen", async () => {
    withKey();
    fakeAi.practiceRound.mockResolvedValue({ ok: false, failure: "invalid_key" });
    await renderAppAt(start, fakeSession());
    expect(
      screen.getByText("Your API key was not accepted. Update it to keep chatting."),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Update key" }));
    expect(screen).toHavePathname("/api-key");
  });

  it("goes Home on Stop practice keeping the run", async () => {
    withKey();
    await renderAppAt(start, fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Stop practice" }));
    expect(screen).toHavePathname("/");
    expect(fakeData.finishPracticeRun).not.toHaveBeenCalled();
  });

  it("opens a run to continue from its id", async () => {
    withKey();
    opened([true, null, null, null, null]);
    await renderAppAt(resume, fakeSession());
    expect(fakeData.openPracticeRun).toHaveBeenCalledWith("run-1");
    expect(screen.getByText("2/5")).toBeTruthy();
    expect(fakeData.createPracticeRun).not.toHaveBeenCalled();
  });
});
