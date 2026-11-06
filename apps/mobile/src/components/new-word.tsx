import { StyleSheet, View } from "react-native";

import { Tag } from "@/components/tag";
import { Text } from "@/components/text";
import { spacing } from "@/constants/theme";

export function NewWord({ word }: { word: string }) {
  return (
    <View style={styles.row}>
      <Tag variant="outline" label="New word" />
      <Text variant="caption">{word}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.stack,
    paddingHorizontal: spacing.tight,
  },
});
