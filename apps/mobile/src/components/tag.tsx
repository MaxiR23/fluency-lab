import { StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import { colors, radius, spacing } from "@/constants/theme";

export function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text variant="tag">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    backgroundColor: colors.accentTag,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.hair,
  },
});
