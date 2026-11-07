import type { SessionWeek } from "@fluency-lab/shared";
import { useEffect, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { Flame } from "@/components/flame";
import { Icon } from "@/components/icon";
import { selectableStyle } from "@/components/selectable-style";
import { Text } from "@/components/text";
import { dayCircleStyle, dayLetterVariant } from "@/components/week-strip-style";
import { colors, motion, size, spacing, strokeWidth } from "@/constants/theme";
import { easing } from "@/utils/chat-transitions";
import { popSteps, type FlameMotion, type PopMotion } from "@/utils/practice-motion";
import { weekStrip, type DayCell } from "@/utils/week-strip";

// INFO: pop is today's check scaling 0 to 1.2 to 1 (home.html); null draws it still. flame is
// the perfect day's flick; null draws it still.
export function WeekStrip({
  week,
  pop = null,
  flame = null,
}: {
  week: SessionWeek;
  pop?: PopMotion | null;
  flame?: FlameMotion | null;
}) {
  const { days, countLabel } = weekStrip(week);
  return (
    <View style={[selectableStyle({ selected: false }), styles.card]}>
      <View style={styles.header}>
        <Text variant="label">This week</Text>
        <Text variant="labelStrong">{countLabel}</Text>
      </View>
      <View testID="week-row" style={styles.row}>
        {days.map((cell) => (
          <View key={cell.date} style={styles.day} accessible accessibilityLabel={cell.label}>
            {pop !== null && cell.practiced && cell.isToday ? (
              <Popping pop={pop}>
                <DayMark cell={cell} flame={flame} />
              </Popping>
            ) : (
              <DayMark cell={cell} flame={flame} />
            )}
            <Text variant={dayLetterVariant(cell)}>{cell.letter}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function DayMark({ cell, flame }: { cell: DayCell; flame: FlameMotion | null }) {
  return cell.perfect ? (
    <View style={styles.flameSlot}>
      <Flame flick={flame} />
    </View>
  ) : (
    <DayCircle cell={cell} />
  );
}

function DayCircle({ cell }: { cell: DayCell }) {
  return (
    <View style={dayCircleStyle(cell)}>
      {cell.practiced ? (
        <Icon
          name="check"
          color={colors.text}
          size={size.iconCheck}
          strokeWidth={strokeWidth.check}
        />
      ) : null}
    </View>
  );
}

function Popping({ pop, children }: { pop: PopMotion; children: ReactNode }) {
  const scale = useSharedValue(0);

  useEffect(() => {
    const curve = easing(motion.easeOut);
    const [up, settle] = popSteps(pop);
    scale.set(
      withDelay(
        pop.delay,
        withSequence(
          withTiming(up.to, { duration: up.duration, easing: curve }),
          withTiming(settle.to, { duration: settle.duration, easing: curve }),
        ),
      ),
    );
  }, [pop, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Animated.View testID="week-pop" style={animatedStyle}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.group,
    marginHorizontal: spacing.screenSide,
    paddingVertical: spacing.card,
    paddingHorizontal: spacing.md,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  flameSlot: {
    width: size.dayCircle,
    height: size.flameHeight,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  day: { alignItems: "center", gap: spacing.stack },
});
