import { Pressable, StyleSheet } from "react-native";

import { Icon } from "@/components/icon";
import { colors, size } from "@/constants/theme";

export function BackButton({
  onPress,
  label = "Back to Home",
}: {
  onPress: () => void;
  label?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.back}
    >
      <Icon name="back" color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: { width: size.touch, height: size.touch, alignItems: "center", justifyContent: "center" },
});
