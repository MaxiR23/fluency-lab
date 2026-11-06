import { Pressable, StyleSheet, View } from "react-native";

import { selectableStyle } from "@/components/selectable-style";
import { Text } from "@/components/text";
import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.group}>
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={selected ? undefined : () => onChange(option.id)}
            style={[styles.segment, selected ? selectableStyle({ selected: true }) : null]}
          >
            <Text variant="body">{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.thin,
    borderRadius: radius.control,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    minHeight: size.control,
    // INFO: the same size border as the selected one, in the container color, so selecting does not shift the layout.
    borderWidth: borderWidth.thin,
    borderColor: colors.surface,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
  },
});
