import type { Suggestion } from "@fluency-lab/shared";
import { Pressable, StyleSheet, View } from "react-native";

import { Icon } from "@/components/icon";
import { selectableStyle } from "@/components/selectable-style";
import { Tag } from "@/components/tag";
import { Text } from "@/components/text";
import { colors, radius, size, spacing, strokeWidth } from "@/constants/theme";
import { starterIcon } from "@/utils/topic-icon";

export function SuggestionCard({
  suggestion,
  layout,
  onPress,
}: {
  suggestion: Suggestion;
  layout: "carousel" | "list";
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={suggestion.title}
      onPress={onPress}
      style={({ pressed }) => [
        selectableStyle({ selected: false, pressed }),
        styles.card,
        layout === "carousel" ? styles.carousel : styles.list,
      ]}
    >
      <View style={styles.top}>
        <View style={styles.iconBox}>
          <Icon
            name={starterIcon(suggestion)}
            color={colors.accent}
            size={size.iconCard}
            strokeWidth={strokeWidth.icon}
          />
        </View>
        <Tag label={suggestion.tag} />
      </View>
      <Text variant="cardTitle">{suggestion.title}</Text>
      <Text variant="why">{suggestion.why}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.cluster, padding: spacing.card },
  carousel: { width: size.suggestionCard },
  list: { alignSelf: "stretch" },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  iconBox: {
    width: size.badgeSmall,
    height: size.badgeSmall,
    borderRadius: radius.badgeSmall,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
