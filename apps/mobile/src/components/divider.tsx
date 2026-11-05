import { StyleSheet, View } from "react-native";

import { hasText } from "@/components/has-text";
import { Text } from "@/components/text";
import { borderWidth, colors, spacing } from "@/constants/theme";

export function Divider({ label }: { label?: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      {hasText(label) ? (
        <>
          <Text variant="muted" style={styles.label}>
            {label}
          </Text>
          <View style={styles.line} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  line: {
    flex: 1,
    height: borderWidth.thin,
    backgroundColor: colors.border,
  },
  label: { marginHorizontal: spacing.md },
});
