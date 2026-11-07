import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { buttonStyle } from "@/components/button-style";
import { Icon } from "@/components/icon";
import { ScoreRing } from "@/components/score-ring";
import { Tag } from "@/components/tag";
import { Text } from "@/components/text";
import {
  borderWidth,
  colors,
  motion as tokens,
  radius,
  shadow,
  size,
  spacing,
  strokeWidth,
} from "@/constants/theme";
import { easing } from "@/utils/chat-transitions";
import type { HomeMotion } from "@/utils/practice-motion";
import type { TodayCard } from "@/utils/today-practice";

// INFO: Home's card of today's practice. With motion null the glow and the arrow nudge do not
// run and the ring is drawn final: that is also the reduce motion look.
export function TodayPracticeCard({
  card,
  onPress,
  motion,
}: {
  card: TodayCard;
  onPress: () => void;
  motion: HomeMotion | null;
}) {
  const glow = useSharedValue(0);
  const nudge = useSharedValue(0);

  useEffect(() => {
    if (motion === null) return;
    const curve = easing(tokens.easeInOut);
    glow.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: motion.glowCycle / 2, easing: curve }),
          withTiming(0, { duration: motion.glowCycle / 2, easing: curve }),
        ),
        -1,
      ),
    );
    nudge.set(
      withRepeat(
        withSequence(
          withTiming(motion.nudge.offset, { duration: motion.nudge.cycle / 2, easing: curve }),
          withTiming(0, { duration: motion.nudge.cycle / 2, easing: curve }),
        ),
        -1,
      ),
    );
  }, [motion, glow, nudge]);

  const glowStyle = useAnimatedStyle(() => ({ shadowOpacity: glow.get() }));
  const nudgeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: nudge.get() }] }));

  return (
    <Animated.View
      testID="today-glow"
      style={[styles.outer, shadow.cardGlow, motion === null ? styles.still : glowStyle]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Today's practice, ${card.title}, ${card.meta}`}
        onPress={onPress}
        style={[styles.card, shadow.raised]}
      >
        <View style={styles.top}>
          <ScoreRing
            size="small"
            fraction={card.fraction}
            label={card.ringLabel}
            motion={motion === null ? null : { ring: motion.ring }}
          />
          <View style={styles.texts}>
            <Text variant="eyebrow">Today&apos;s practice</Text>
            <Text variant="heroTitle">{card.title}</Text>
            <Text variant="caption">{card.meta}</Text>
          </View>
        </View>
        {card.chips.length === 0 ? null : (
          <View testID="today-chips" style={styles.chips}>
            {card.chips.map((chip) => (
              <Tag key={chip} label={chip} variant="rule" />
            ))}
          </View>
        )}
        <View style={[buttonStyle("strong", {}, { compact: true }).container, styles.pill]}>
          <Text style={buttonStyle("strong", {}, { compact: true }).label}>{card.action}</Text>
          <Animated.View style={motion === null ? undefined : nudgeStyle}>
            <Icon
              name="arrow"
              color={colors.text}
              size={size.iconAction}
              strokeWidth={strokeWidth.action}
            />
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: { marginHorizontal: spacing.screenSide, borderRadius: radius.hero },
  still: { shadowOpacity: 0 },
  card: {
    gap: spacing.md,
    padding: spacing.hero,
    borderRadius: radius.hero,
    backgroundColor: colors.accentDeep,
    borderWidth: borderWidth.thin,
    borderColor: colors.accentLine,
  },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  texts: { flexShrink: 1, gap: spacing.xs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.stack },
  pill: { flexDirection: "row", gap: spacing.sm, alignSelf: "stretch" },
});
