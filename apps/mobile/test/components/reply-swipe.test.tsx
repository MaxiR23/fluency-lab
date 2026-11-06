// apps/mobile/test/components/reply-swipe.test.tsx
//
// Tests for ReplySwipe.
//
// Tested:
// - A swipe that reaches the threshold plays the arm once and starts the reply on release
// - A swipe that stops short, goes back before release or is cancelled starts no reply
// - The hint's starting style and its drawing
//
// What is covered:
// - Normal case, empty case, edges. The finger-follow and the snap back are Reanimated styles,
//   which do not advance under jest; only the starting style is asserted.
//
// Run with: pnpm exec jest apps/mobile/test/components/reply-swipe.test.tsx
//
// SEE: apps/mobile/src/components/reply-swipe.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { act, render, screen } from "@testing-library/react-native";
import { StyleSheet, Text, processColor } from "react-native";
import { GestureHandlerRootView, State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";

import { ReplySwipe } from "@/components/reply-swipe";
import { borderWidth, colors, motion, radius, size } from "@/constants/theme";
import { chatMotion } from "@/utils/chat-motion";

function swipe(props: Partial<React.ComponentProps<typeof ReplySwipe>> = {}) {
  return (
    <GestureHandlerRootView>
      <ReplySwipe
        testID="swipe"
        onReply={() => {}}
        onArm={() => {}}
        back={chatMotion(false).swipeBack}
        {...props}
      >
        <Text>Where did you go?</Text>
      </ReplySwipe>
    </GestureHandlerRootView>
  );
}

// Drives the pan through the given horizontal moves, then ends it as the library would.
async function drag(moves: number[], end: State = State.END) {
  const last = moves.at(-1) ?? 0;
  await act(async () => {
    fireGestureHandler(getByGestureTestId("swipe"), [
      { state: State.BEGAN },
      ...moves.map((translationX) => ({ state: State.ACTIVE, translationX })),
      { state: end, translationX: last },
    ]);
  });
}

describe("ReplySwipe", () => {
  it("a swipe that reaches the threshold plays the arm once and starts the reply on release", async () => {
    const onReply = jest.fn();
    const onArm = jest.fn();
    await render(swipe({ onReply, onArm }));

    await drag([0, 30, motion.replySwipe, motion.replySwipe + 20]);

    expect(onArm).toHaveBeenCalledTimes(1);
    expect(onReply).toHaveBeenCalledTimes(1);
  });

  it("a swipe that stops short starts no reply and plays nothing", async () => {
    const onReply = jest.fn();
    const onArm = jest.fn();
    await render(swipe({ onReply, onArm }));

    await drag([0, 20, motion.replySwipe - 1]);

    expect(onArm).not.toHaveBeenCalled();
    expect(onReply).not.toHaveBeenCalled();
  });

  it("a swipe that goes past the threshold and back before release starts no reply", async () => {
    const onReply = jest.fn();
    const onArm = jest.fn();
    await render(swipe({ onReply, onArm }));

    await drag([0, motion.replySwipe, 10]);

    expect(onArm).toHaveBeenCalledTimes(1);
    expect(onReply).not.toHaveBeenCalled();
  });

  it("a cancelled swipe starts no reply", async () => {
    const onReply = jest.fn();
    await render(swipe({ onReply }));

    await drag([0, motion.replySwipe], State.FAILED);

    expect(onReply).not.toHaveBeenCalled();
  });

  it("a swipe with reduce motion still starts the reply", async () => {
    const onReply = jest.fn();
    await render(swipe({ onReply, back: chatMotion(true).swipeBack }));

    await drag([0, motion.replySwipe]);

    expect(onReply).toHaveBeenCalledTimes(1);
  });

  it("the hint starts hidden at its smaller scale", async () => {
    await render(swipe());

    const hint = screen.getByTestId("reply-hint");
    const style = StyleSheet.flatten(hint.props.style);
    expect(style.opacity).toBe(0);
    expect(style.transform).toEqual([{ scale: motion.replyHintScale }]);
  });

  it("draws the hint circle with the design's size, surface and accent icon", async () => {
    await render(swipe());

    const circle = screen.getByTestId("reply-hint-circle");
    expect(StyleSheet.flatten(circle.props.style)).toMatchObject({
      width: size.replyHint,
      height: size.replyHint,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: borderWidth.thin,
    });
    // INFO: the svg host holds the stroke as a processed color number, not the hex string.
    const stroke = `"stroke":{"type":0,"payload":${String(processColor(colors.accent))}}`;
    expect(screen.getByTestId("icon-reply", { includeHiddenElements: true })).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).toContain(stroke);
  });

  it("draws its child", async () => {
    await render(swipe());
    expect(screen.getByText("Where did you go?")).toBeTruthy();
  });
});
