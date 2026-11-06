import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { messageBubbleStyle } from "@/components/message-bubble-style";
import { colors, motion, radius, size, spacing } from "@/constants/theme";
import { dotDelay, type ChatMotion, type DotMotion } from "@/utils/chat-motion";
import { easing, fadeInTransition, fadeOutTransition } from "@/utils/chat-transitions";

const DOTS = [0, 1, 2] as const;

export function TypingIndicator({ motion: chatMotion }: { motion: ChatMotion }) {
  const style = messageBubbleStyle("tutor");
  return (
    <Animated.View
      testID="typing-indicator"
      accessible
      accessibilityLabel="Tutor is typing"
      style={style.row}
      entering={fadeInTransition(chatMotion.fade)}
      exiting={fadeOutTransition(chatMotion.fade)}
    >
      <View testID="typing-indicator-bubble" style={[style.bubble, styles.bubble]}>
        {DOTS.map((index) => (
          <TypingDot key={index} index={index} dots={chatMotion.dots} />
        ))}
      </View>
    </Animated.View>
  );
}

function TypingDot({ index, dots }: { index: number; dots: DotMotion | null }) {
  const opacity = useSharedValue(dots === null ? 1 : dots.restOpacity);
  const lift = useSharedValue(0);

  useEffect(() => {
    if (dots === null) return;
    const delay = dotDelay(index, dots.stagger);
    const curve = easing(motion.easeInOut);
    // INFO: the loop stops when the dot unmounts: withRepeat runs until it is torn down.
    opacity.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: dots.rise, easing: curve }),
            withTiming(dots.restOpacity, { duration: dots.fall, easing: curve }),
            withTiming(dots.restOpacity, { duration: dots.rest }),
          ),
          -1,
        ),
      ),
    );
    lift.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-dots.lift, { duration: dots.rise, easing: curve }),
            withTiming(0, { duration: dots.fall, easing: curve }),
            withTiming(0, { duration: dots.rest }),
          ),
          -1,
        ),
      ),
    );
  }, [dots, index, opacity, lift]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: lift.get() }],
  }));

  return <Animated.View testID={`typing-dot-${index}`} style={[styles.dot, animatedStyle]} />;
}

const styles = StyleSheet.create({
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.typingDot,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  dot: {
    width: size.typingDot,
    height: size.typingDot,
    borderRadius: radius.pill,
    backgroundColor: colors.textMuted,
  },
});
