import { StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import { borderWidth, colors, radius, spacing } from "@/constants/theme";
import { correctionsLabel, type Correction } from "@/utils/chat-items";

export function CorrectionsCard({
  corrections,
  explanation,
}: {
  corrections: Correction[];
  explanation: string | null;
}) {
  const label = correctionsLabel(corrections.length);
  if (label === null) return null;
  return (
    <View style={styles.card}>
      <Text variant="tabActive">{label}</Text>
      {corrections.map((correction, index) => (
        <Text key={`${index}:${correction.original}>${correction.corrected}`} variant="correction">
          <Text variant="struck">{correction.original}</Text>
          {" → "}
          {correction.corrected}
        </Text>
      ))}
      {explanation === null ? null : <Text variant="explanation">{explanation}</Text>}
    </View>
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
