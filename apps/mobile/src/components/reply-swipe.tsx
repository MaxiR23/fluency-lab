import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { Icon } from "@/components/icon";
import { messageBubbleStyle } from "@/components/message-bubble-style";
import { borderWidth, colors, motion, radius, size, spacing, strokeWidth } from "@/constants/theme";
import type { FadeMotion } from "@/utils/chat-motion";
import { easing } from "@/utils/chat-transitions";
import {
  armCrossed,
  hintLook,
  replyPanOffsets,
  swipeArmed,
  swipeOffset,
} from "@/utils/reply-swipe";

// INFO: pulls its child to the right up to the travel; releasing at the travel calls onReply, and
// crossing it calls onArm once per crossing. The bubble always goes back to 0. The inline config
// below must stay an object literal: the Babel plugin turns its callbacks into worklets.
export function ReplySwipe({
  children,
  onReply,
  onArm,
  back,
  testID,
}: {
  children: ReactNode;
  onReply: () => void;
  onArm: () => void;
  back: FadeMotion | null;
  testID?: string;
}) {
  const offset = useSharedValue(0);
  const armed = useSharedValue(false);
  const curve = easing(motion.easeInOut);
  const travel = motion.replySwipe;
  const offsets = replyPanOffsets(motion.swipeSlop);
  const pan = usePanGesture({
    testID,
    activeOffsetX: offsets.activeOffsetX,
    failOffsetY: offsets.failOffsetY,
    onUpdate: (event) => {
      offset.set(swipeOffset(event.translationX, travel));
      const now = swipeArmed(event.translationX, travel);
      if (armCrossed(armed.get(), now)) scheduleOnRN(onArm);
      armed.set(now);
    },
    onDeactivate: (event) => {
      if (armed.get() && !event.canceled) scheduleOnRN(onReply);
    },
    onFinalize: () => {
      armed.set(false);
      offset.set(back === null ? 0 : withTiming(0, { duration: back.duration, easing: curve }));
    },
  });
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));
  const hint = useAnimatedStyle(() => {
    const look = hintLook(offset.get(), travel, motion.replyHintScale);
    return { opacity: look.opacity, transform: [{ scale: look.scale }] };
  });
  return (
    <View style={styles.container}>
      <Animated.View testID="reply-hint" pointerEvents="none" style={[styles.hintSlot, hint]}>
        <View testID="reply-hint-circle" style={styles.hint}>
          <Icon
            name="reply"
            color={colors.accent}
            size={size.iconAction}
            strokeWidth={strokeWidth.action}
          />
        </View>
      </Animated.View>
      <GestureDetector gesture={pan} touchAction="pan-y">
        <Animated.View style={[messageBubbleStyle("tutor").row, slide]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: "stretch", justifyContent: "center" },
  hintSlot: {
    position: "absolute",
    left: spacing.xs,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  hint: {
    width: size.replyHint,
    height: size.replyHint,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.thin,
    alignItems: "center",
    justifyContent: "center",
  },
});
