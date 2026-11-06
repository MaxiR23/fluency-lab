import { Pressable, StyleSheet, View } from "react-native";

import { CheckIcon } from "@/components/check-icon";
import { selectableStyle } from "@/components/selectable-style";
import { Text } from "@/components/text";
import { spacing } from "@/constants/theme";

export function OptionCard({
  label,
  description,
  selected,
  onPress,
  role,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  role: "radio" | "checkbox";
}) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={role === "radio" ? { selected } : { checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [selectableStyle({ selected, pressed }), styles.card]}
    >
      <View style={styles.texts}>
        <Text variant="body">{label}</Text>
        {description === undefined ? null : <Text variant="caption">{description}</Text>}
      </View>
      {selected ? <CheckIcon /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    gap: spacing.md,
  },
  texts: { flex: 1, gap: spacing.xs },
});
