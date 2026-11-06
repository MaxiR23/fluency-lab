import { Pressable, StyleSheet } from "react-native";

import { CheckIcon } from "@/components/check-icon";
import { selectableStyle } from "@/components/selectable-style";
import { Text } from "@/components/text";
import { spacing } from "@/constants/theme";

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [selectableStyle({ selected, pressed }), styles.chip]}
    >
      <Text variant="body">{label}</Text>
      {selected ? <CheckIcon /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
});
