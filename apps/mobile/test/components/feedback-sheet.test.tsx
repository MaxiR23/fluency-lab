// apps/mobile/test/components/feedback-sheet.test.tsx
//
// Tests for FeedbackSheet.
//
// Tested:
// - The right sheet shows Nice one! with the explanation
// - The miss sheet shows Not quite with the answer and the explanation
// - Continue calls onContinue and shows busy while saving
// - The sheet is a polite live region and sits in place with no motion
//
// What is covered:
// - Normal case, reduce motion, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/feedback-sheet.test.tsx
//
// SEE: apps/mobile/src/components/feedback-sheet.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { FeedbackSheet } from "@/components/feedback-sheet";
import { exerciseMotion } from "@/utils/practice-motion";

describe("FeedbackSheet", () => {
  it("shows Nice one with the explanation", async () => {
    await render(
      <FeedbackSheet
        tone="right"
        title="Nice one!"
        answer={null}
        explanation="Use going to when you can see it coming."
        onContinue={jest.fn()}
        busy={false}
        motion={null}
      />,
    );
    expect(screen.getByText("Nice one!")).toBeTruthy();
    expect(screen.getByText("Use going to when you can see it coming.")).toBeTruthy();
    expect(screen.queryByText(/Answer:/)).toBeNull();
    expect(screen.getByTestId("icon-check", { includeHiddenElements: true })).toBeTruthy();
  });

  it("shows Not quite with the answer", async () => {
    await render(
      <FeedbackSheet
        tone="miss"
        title="Not quite"
        answer="I've never been to Japan."
        explanation="Use the present perfect."
        onContinue={jest.fn()}
        busy={false}
        motion={null}
      />,
    );
    expect(screen.getByText("Not quite")).toBeTruthy();
    expect(screen.getByText(/Answer:/)).toBeTruthy();
    expect(screen.getByText(/I've never been to Japan\./)).toBeTruthy();
    expect(screen.getByText("Use the present perfect.")).toBeTruthy();
    expect(screen.getByTestId("icon-close", { includeHiddenElements: true })).toBeTruthy();
  });

  it("calls Continue", async () => {
    const onContinue = jest.fn();
    await render(
      <FeedbackSheet
        tone="right"
        title="Nice one!"
        answer={null}
        explanation="x"
        onContinue={onContinue}
        busy={false}
        motion={null}
      />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("shows Continue busy and does not call it", async () => {
    const onContinue = jest.fn();
    await render(
      <FeedbackSheet
        tone="miss"
        title="Not quite"
        answer="a"
        explanation="x"
        onContinue={onContinue}
        busy
        motion={null}
      />,
    );
    const button = screen.getByRole("button", { name: "Continue", busy: true });
    await fireEvent.press(button);
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("is a polite live region", async () => {
    await render(
      <FeedbackSheet
        tone="right"
        title="Nice one!"
        answer={null}
        explanation="x"
        onContinue={jest.fn()}
        busy={false}
        motion={null}
      />,
    );
    expect(screen.getByTestId("feedback-sheet").props.accessibilityLiveRegion).toBe("polite");
  });

  it("sits in place with no motion and rises with motion", async () => {
    const { rerender } = await render(
      <FeedbackSheet
        tone="right"
        title="Nice one!"
        answer={null}
        explanation="x"
        onContinue={jest.fn()}
        busy={false}
        motion={null}
      />,
    );
    expect(screen.getByTestId("feedback-sheet").props.entering).toBeUndefined();
    await rerender(
      <FeedbackSheet
        tone="right"
        title="Nice one!"
        answer={null}
        explanation="x"
        onContinue={jest.fn()}
        busy={false}
        motion={exerciseMotion(false)}
      />,
    );
    expect(screen.getByTestId("feedback-sheet").props.entering).toBeDefined();
  });

  const sheet = (note?: { onPress: () => void; busy: boolean; disabled: boolean }) => (
    <FeedbackSheet
      tone="miss"
      title="Not quite"
      answer="a"
      explanation="x"
      onContinue={jest.fn()}
      busy={false}
      motion={null}
      note={note}
    />
  );

  it("draws Make me a study note before Continue on a miss and calls it", async () => {
    const onPress = jest.fn();
    await render(sheet({ onPress, busy: false, disabled: false }));
    const button = screen.getByRole("button", { name: "Make me a study note" });
    const buttons = screen.getAllByRole("button");
    expect(buttons.indexOf(button)).toBeLessThan(
      buttons.indexOf(screen.getByRole("button", { name: "Continue" })),
    );
    expect(screen.getByTestId("icon-table", { includeHiddenElements: true })).toBeTruthy();
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("draws no study note button without a note prop", async () => {
    await render(sheet());
    expect(screen.queryByRole("button", { name: "Make me a study note" })).toBeNull();
    expect(screen.queryByText("Make me a study note")).toBeNull();
  });

  it("draws a spinner in place of the icon while busy and marks the button busy", async () => {
    const onPress = jest.fn();
    await render(sheet({ onPress, busy: true, disabled: false }));
    const button = screen.getByRole("button", { name: "Make me a study note", busy: true });
    expect(screen.queryByTestId("icon-table", { includeHiddenElements: true })).toBeNull();
    expect(JSON.stringify(screen.toJSON())).toContain('"type":"ActivityIndicator"');
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("does not call back while disabled", async () => {
    const onPress = jest.fn();
    await render(sheet({ onPress, busy: false, disabled: true }));
    const button = screen.getByRole("button", { name: "Make me a study note" });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
