import { StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import { borderWidth, colors, radius, spacing } from "@/constants/theme";

export function WordCard({
  word,
  sentence,
  date,
}: {
  word: string;
  sentence: string;
  date: string;
}) {
  return (
    <View testID="word-card" style={styles.card}>
      <View style={styles.header}>
        <Text variant="word" style={styles.word}>
          {word}
        </Text>
        <Text variant="why">{date}</Text>
      </View>
      <Text variant="quote">{sentence}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
    paddingVertical: spacing.card,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.thin,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: spacing.sm,
  },
  word: { flexShrink: 1 },
});
