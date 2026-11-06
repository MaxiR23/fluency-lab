import { Pressable, StyleSheet, View } from "react-native";

import { Icon } from "@/components/icon";
import { Text } from "@/components/text";
import { borderWidth, colors, radius, shadow, size, spacing, strokeWidth } from "@/constants/theme";

export function HeroCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Free chat"
      onPress={onPress}
      style={({ pressed }) => [styles.card, shadow.raised, pressed ? styles.pressed : null]}
    >
      <View style={styles.top}>
        <View style={styles.texts}>
          <Text variant="heroTitle">Free chat</Text>
          <Text variant="heroText">Talk about anything. Get corrections as you go.</Text>
        </View>
        <View style={styles.art}>
          <View style={styles.bubbleLarge} />
          <View style={styles.bubbleSmall} />
        </View>
      </View>
      <View style={styles.pill}>
        <Text variant="action">Start chatting</Text>
        <Icon
          name="arrow"
          color={colors.text}
          size={size.iconAction}
          strokeWidth={strokeWidth.action}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.card,
    marginHorizontal: spacing.screenSide,
    padding: spacing.hero,
    borderRadius: radius.hero,
    backgroundColor: colors.accentDeep,
    borderColor: colors.accentLine,
    borderWidth: borderWidth.thin,
  },
  pressed: { borderColor: colors.accentPressed },
  top: { flexDirection: "row", alignItems: "flex-start", gap: spacing.group },
  texts: { flex: 1, gap: spacing.stack },
  art: { width: size.heroArtWidth, height: size.heroArtHeight },
  bubbleLarge: {
    position: "absolute",
    left: 0,
    top: 0,
    width: size.bubbleLargeWidth,
    height: size.bubbleLargeHeight,
    borderRadius: radius.bubble,
    borderBottomLeftRadius: radius.bubbleTail,
    backgroundColor: colors.accentBubble,
    borderColor: colors.accentBubbleLine,
    borderWidth: borderWidth.thin,
  },
  bubbleSmall: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: size.bubbleSmallWidth,
    height: size.bubbleSmallHeight,
    borderRadius: radius.bubble,
    borderBottomRightRadius: radius.bubbleTail,
    backgroundColor: colors.accentLine,
    borderColor: colors.accentPressed,
    borderWidth: borderWidth.thin,
  },
  pill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: size.pill,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.accentLine,
    borderColor: colors.accentPressed,
    borderWidth: borderWidth.thin,
  },
});
