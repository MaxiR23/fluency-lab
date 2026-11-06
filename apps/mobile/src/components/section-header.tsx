import { StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import { TextLink } from "@/components/text-link";

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.row}>
      <Text variant="section" accessibilityRole="header">
        {title}
      </Text>
      {actionLabel === undefined ? null : <TextLink label={actionLabel} onPress={onAction} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
});
