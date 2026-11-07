import { useEffect, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { scoreRingStyle, type ScoreRingSize } from "@/components/score-ring-style";
import { Text } from "@/components/text";
import { motion as tokens, radius, shadow } from "@/constants/theme";
import { easing } from "@/utils/chat-transitions";
import { ringGeometry, type RingMotion, type SparkMotion } from "@/utils/practice-motion";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type ScoreRingMotion = {
  ring: RingMotion;
  halo?: { cycle: number };
  sparks?: SparkMotion[];
};

// INFO: the progress circle is a dashed circle whose offset goes from empty to the score after
// the ring delay. With motion null the offset is final, and the halo and the sparks are absent:
// that is also the reduce motion look.
export function ScoreRing({
  size,
  fraction,
  label,
  caption,
  motion,
}: {
  size: ScoreRingSize;
  fraction: number;
  label: string;
  caption?: string;
  motion: ScoreRingMotion | null;
}) {
  const style = scoreRingStyle(size);
  const { circumference, offset } = ringGeometry(style.radius, fraction);
  const empty = circumference;
  const dashOffset = useSharedValue(empty);

  useEffect(() => {
    if (motion === null) return;
    dashOffset.set(
      withDelay(
        motion.ring.delay,
        withTiming(offset, { duration: motion.ring.duration, easing: easing(motion.ring.curve) }),
      ),
    );
  }, [motion, offset, dashOffset]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: dashOffset.get() }));
  const center = style.diameter / 2;
  const sparks = motion?.sparks ?? [];

  const ring = (
    <View
      accessible
      accessibilityLabel={caption === undefined ? label : `${label} ${caption}`}
      style={style.box}
    >
      <Svg width={style.diameter} height={style.diameter} style={styles.rotated}>
        <Circle
          cx={center}
          cy={center}
          r={style.radius}
          fill="none"
          stroke={style.track}
          strokeWidth={style.strokeWidth}
        />
        {motion === null ? (
          <Circle
            testID="score-ring-progress"
            cx={center}
            cy={center}
            r={style.radius}
            fill="none"
            stroke={style.progress}
            strokeWidth={style.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        ) : (
          <AnimatedCircle
            testID="score-ring-progress"
            cx={center}
            cy={center}
            r={style.radius}
            fill="none"
            stroke={style.progress}
            strokeWidth={style.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            animatedProps={animatedProps}
          />
        )}
      </Svg>
      <View style={styles.center}>
        <Text variant={style.count}>{label}</Text>
        {caption === undefined ? null : <Text variant="why">{caption}</Text>}
      </View>
      {sparks.map((spark, index) => (
        <Spark key={index} index={index} spark={spark} style={style.sparks[index]} />
      ))}
    </View>
  );

  if (size === "small" || motion === null || motion.halo === undefined) return ring;
  return <Halo cycle={motion.halo.cycle}>{ring}</Halo>;
}

function Halo({ cycle, children }: { cycle: number; children: ReactNode }) {
  const glow = useSharedValue(0);

  useEffect(() => {
    const curve = easing(tokens.easeInOut);
    glow.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: cycle / 2, easing: curve }),
          withTiming(0, { duration: cycle / 2, easing: curve }),
        ),
        -1,
      ),
    );
  }, [cycle, glow]);

  const animatedStyle = useAnimatedStyle(() => ({ shadowOpacity: glow.get() }));

  return (
    <Animated.View testID="score-ring-halo" style={[styles.halo, shadow.halo, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

function Spark({
  index,
  spark,
  style,
}: {
  index: number;
  spark: SparkMotion;
  style: object | undefined;
}) {
  const opacity = useSharedValue(0);
  const travel = useSharedValue(0);

  useEffect(() => {
    const curve = easing(tokens.easeOut);
    opacity.set(
      withDelay(
        spark.delay,
        withSequence(
          withTiming(1, { duration: spark.in, easing: curve }),
          withTiming(0, { duration: spark.out, easing: curve }),
        ),
      ),
    );
    travel.set(
      withDelay(spark.delay, withTiming(1, { duration: spark.in + spark.out, easing: curve })),
    );
  }, [spark, opacity, travel]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [
      { translateY: -spark.lift * travel.get() },
      { scale: spark.scale + (1 - spark.scale) * travel.get() },
    ],
  }));

  return <Animated.View testID={`score-ring-spark-${index}`} style={[style, animatedStyle]} />;
}

const styles = StyleSheet.create({
  rotated: { transform: [{ rotate: "-90deg" }] },
  center: { position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" },
  halo: { borderRadius: radius.pill },
});
