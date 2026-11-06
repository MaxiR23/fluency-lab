import { StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import { borderWidth, colors, radius, spacing } from "@/constants/theme";

export function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text variant="captionLink">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    borderColor: colors.accentLine,
    borderWidth: borderWidth.thin,
    borderRadius: radius.badge,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
