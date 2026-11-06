import { Pressable, StyleSheet, View } from "react-native";

import { Icon } from "@/components/icon";
import { Text } from "@/components/text";
import { borderWidth, colors, size, spacing } from "@/constants/theme";

export function ChatHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to Home"
        onPress={onBack}
        style={styles.back}
      >
        <Icon name="back" color={colors.text} />
      </Pressable>
      <View style={styles.texts}>
        <Text variant="chatTitle" accessibilityRole="header">
          {title}
        </Text>
        <Text variant="why">{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.screenTopShort,
    paddingRight: spacing.group,
    paddingBottom: spacing.group,
    paddingLeft: spacing.sm,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.border,
  },
  back: { width: size.touch, height: size.touch, alignItems: "center", justifyContent: "center" },
  texts: { flex: 1, gap: spacing.tight },
});
