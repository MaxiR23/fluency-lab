import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import { borderWidth, colors, radius, spacing } from "@/constants/theme";

export function ListGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text variant="section" accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <View testID="list-group-rows" style={styles.rows}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  title: { paddingHorizontal: spacing.xs },
  rows: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.thin,
    borderRadius: radius.control,
    overflow: "hidden",
  },
});
