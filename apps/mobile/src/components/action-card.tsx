import { Pressable, StyleSheet, View } from "react-native";

import { Icon, type IconName } from "@/components/icon";
import { selectableStyle } from "@/components/selectable-style";
import { Tag } from "@/components/tag";
import { Text } from "@/components/text";
import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

export function ActionCard({
  title,
  description,
  meta,
  tags,
  icon,
  highlighted = false,
  onPress,
}: {
  title: string;
  description?: string;
  meta?: string;
  tags?: string[];
  icon?: IconName;
  highlighted?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [selectableStyle({ selected: highlighted, pressed }), styles.card]}
    >
      {icon === undefined ? null : (
        <View style={styles.iconBox}>
          <Icon name={icon} color={colors.accent} />
        </View>
      )}
      <View style={styles.texts}>
        <Text variant="body">{title}</Text>
        {description === undefined ? null : (
          <Text variant="muted" numberOfLines={1}>
            {description}
          </Text>
        )}
        {meta === undefined ? null : <Text variant="caption">{meta}</Text>}
        {tags === undefined || tags.length === 0 ? null : (
          <View style={styles.tags}>
            {tags.map((tag) => (
              <Tag key={tag} label={tag} />
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.md,
  },
  iconBox: {
    width: size.badge,
    height: size.badge,
    borderRadius: radius.badge,
    borderWidth: borderWidth.thin,
    borderColor: colors.accentLine,
    backgroundColor: colors.accentDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  texts: { flex: 1, gap: spacing.xs },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
});
