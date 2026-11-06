import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Icon } from "@/components/icon";
import { Text } from "@/components/text";
import { borderWidth, colors, size, spacing, strokeWidth } from "@/constants/theme";

export function ListRow({
  title,
  value,
  chevron = false,
  trailing,
  tone = "default",
  last = false,
  busy = false,
  onPress,
}: {
  title: string;
  value?: string;
  chevron?: boolean;
  trailing?: ReactNode;
  tone?: "default" | "danger";
  last?: boolean;
  busy?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Text variant={tone === "danger" ? "bodyDanger" : "body"} style={styles.title}>
        {title}
      </Text>
      {value === undefined ? null : <Text variant="footer">{value}</Text>}
      {chevron ? (
        <Icon
          name="chevron"
          color={colors.textPlaceholder}
          size={size.iconCard}
          strokeWidth={strokeWidth.action}
        />
      ) : null}
      {trailing}
    </>
  );
  const style = [styles.row, last ? null : styles.divider];
  if (onPress === undefined) {
    return (
      <View testID="list-row" style={style}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID="list-row"
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: busy, busy }}
      disabled={busy}
      onPress={onPress}
      style={style}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.cluster,
    minHeight: size.listRow,
    paddingHorizontal: spacing.md,
  },
  divider: { borderBottomWidth: borderWidth.thin, borderBottomColor: colors.border },
  title: { flexGrow: 1 },
});
