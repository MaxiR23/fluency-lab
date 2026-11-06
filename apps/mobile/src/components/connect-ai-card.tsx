import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { Text } from "@/components/text";
import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

export function ConnectAiCard({ onAddKey }: { onAddKey: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.lockBox}>
        <Icon name="lock" color={colors.accent} size={size.iconBadgeLarge} />
      </View>
      <View style={styles.texts}>
        <Text variant="cardHeading">Connect your AI to start</Text>
        <Text variant="cardBody">Add your Claude or OpenAI key. It stays only on this device.</Text>
      </View>
      <Button variant="deep" compact label="Add API key" onPress={onAddKey} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.panel,
    paddingHorizontal: spacing.screenSide,
    borderRadius: radius.hero,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.thin,
  },
  lockBox: {
    width: size.badgeLarge,
    height: size.badgeLarge,
    borderRadius: radius.badgeLarge,
    backgroundColor: colors.accentDeep,
    borderColor: colors.accentLine,
    borderWidth: borderWidth.thin,
    alignItems: "center",
    justifyContent: "center",
  },
  texts: { gap: spacing.stack, alignItems: "center" },
});
