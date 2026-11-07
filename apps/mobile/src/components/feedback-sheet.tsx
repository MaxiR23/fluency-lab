import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { Button } from "@/components/button";
import {
  feedbackSheetStyle,
  noteActionStyle,
  type FeedbackTone,
} from "@/components/feedback-sheet-style";
import { Icon } from "@/components/icon";
import { Text } from "@/components/text";
import { colors, size, spacing, strokeWidth } from "@/constants/theme";
import type { ExerciseMotion } from "@/utils/practice-motion";
import { sheetTransition } from "@/utils/practice-transitions";

// INFO: the verdict of an answer, at the bottom of the screen. It rises after the pick or the
// shake; with motion null it sits in place, which is also the reduce motion look.
export function FeedbackSheet({
  tone,
  title,
  answer,
  explanation,
  onContinue,
  busy,
  motion,
  note,
}: {
  tone: FeedbackTone;
  title: string;
  answer: string | null;
  explanation: string;
  onContinue: () => void;
  busy: boolean;
  motion: ExerciseMotion | null;
  // INFO: the study note action of a miss; without it the sheet draws no such button.
  note?: { onPress: () => void; busy: boolean; disabled: boolean };
}) {
  const style = feedbackSheetStyle(tone);
  return (
    <Animated.View
      testID="feedback-sheet"
      accessibilityLiveRegion="polite"
      entering={sheetTransition(motion === null ? null : motion.sheet, tone)}
      style={style.sheet}
    >
      <View style={styles.title}>
        <View style={style.badge}>
          <Icon
            name={style.iconName}
            color={colors.background}
            size={size.iconCheck}
            strokeWidth={strokeWidth.badge}
          />
        </View>
        <Text variant="sheetTitle">{title}</Text>
      </View>
      {answer === null ? null : (
        <Text variant="message">
          <Text variant="message" style={styles.muted}>
            Answer:
          </Text>{" "}
          {answer}
        </Text>
      )}
      <Text variant="intro">{explanation}</Text>
      {note === undefined ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Make me a study note"
          accessibilityState={{ busy: note.busy, disabled: note.disabled || note.busy }}
          disabled={note.disabled || note.busy}
          onPress={note.onPress}
          style={noteActionStyle()}
        >
          {note.busy ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Icon
              name="table"
              color={colors.accent}
              size={size.iconAction}
              strokeWidth={strokeWidth.icon}
            />
          )}
          <Text variant="footerLink">Make me a study note</Text>
        </Pressable>
      )}
      <Button label="Continue" variant={style.button} large loading={busy} onPress={onContinue} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  title: { flexDirection: "row", alignItems: "center", gap: spacing.cluster },
  muted: { color: colors.textMuted },
});
