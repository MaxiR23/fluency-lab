import { StyleSheet } from "react-native";
import Animated, { type FadeInDown } from "react-native-reanimated";

import { Text } from "@/components/text";
import { borderWidth, colors, radius, spacing } from "@/constants/theme";
import { correctionsLabel, type Correction } from "@/utils/chat-items";

export function CorrectionsCard({
  corrections,
  explanation,
  entering,
}: {
  corrections: Correction[];
  explanation: string | null;
  entering?: FadeInDown;
}) {
  const label = correctionsLabel(corrections.length);
  if (label === null) return null;
  return (
    <Animated.View entering={entering} style={styles.card}>
      <Text variant="tabActive">{label}</Text>
      {corrections.map((correction, index) => (
        <Text key={`${index}:${correction.original}>${correction.corrected}`} variant="correction">
          <Text variant="struck">{correction.original}</Text>
          {" → "}
          {correction.corrected}
        </Text>
      ))}
      {explanation === null ? null : <Text variant="explanation">{explanation}</Text>}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.stack,
    paddingVertical: spacing.group,
    paddingHorizontal: spacing.card,
    borderRadius: radius.note,
    backgroundColor: colors.surfaceSunken,
    borderColor: colors.border,
    borderWidth: borderWidth.thin,
  },
});
