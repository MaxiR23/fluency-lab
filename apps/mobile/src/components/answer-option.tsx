import { useEffect } from "react";
import { Pressable } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { answerOptionStyle, type AnswerOptionState } from "@/components/answer-option-style";
import { Icon } from "@/components/icon";
import { Text } from "@/components/text";
import { colors, motion as motionTokens, size, strokeWidth } from "@/constants/theme";
import { easing } from "@/utils/chat-transitions";
import type { ExerciseMotion } from "@/utils/practice-motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// INFO: the option turns its colors over the pick (right) or the wrong border (wrong) and its
// badge pops after a delay. With motion null it is drawn in its final state, which is also the
// reduce motion look.
export function AnswerOption({
  label,
  state,
  disabled = false,
  onPress,
  motion,
}: {
  label: string;
  state: AnswerOptionState;
  disabled?: boolean;
  onPress: () => void;
  motion: ExerciseMotion | null;
}) {
  const style = answerOptionStyle(state);
  const answered = state !== "idle";
  const progress = useSharedValue(motion === null && answered ? 1 : 0);
  const scale = useSharedValue(motion === null ? 1 : 0);

  useEffect(() => {
    if (motion === null || !answered) return;
    const curve = easing(motionTokens.easeOut);
    const duration = state === "right" ? motion.pick.duration : motion.wrong.duration;
    progress.set(withTiming(1, { duration, easing: curve }));
    scale.set(
      withDelay(
        motion.check.delay,
        withSequence(
          withTiming(motion.check.scale, { duration: motion.check.up, easing: curve }),
          withTiming(1, { duration: motion.check.settle, easing: curve }),
        ),
      ),
    );
  }, [motion, answered, state, progress, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.get(),
      [0, 1],
      [style.from.backgroundColor, style.to.backgroundColor],
    ),
    borderColor: interpolateColor(
      progress.get(),
      [0, 1],
      [style.from.borderColor, style.to.borderColor],
    ),
  }));
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={motion === null ? style.container : [style.container, animatedStyle]}
    >
      <Text variant="option">{label}</Text>
      {style.hasBadge ? (
        <Animated.View testID="answer-badge" style={[style.badge, badgeStyle]}>
          <Icon
            name={state === "right" ? "check" : "close"}
            color={colors.background}
            size={size.iconCheck}
            strokeWidth={strokeWidth.badge}
          />
        </Animated.View>
      ) : null}
    </AnimatedPressable>
  );
}
