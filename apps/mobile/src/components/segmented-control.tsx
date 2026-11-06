import { Pressable, View } from "react-native";

import { segmentedStyle, type SegmentedLook } from "@/components/segmented-control-style";
import { Text } from "@/components/text";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  look = "choice",
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  look?: SegmentedLook;
}) {
  const style = segmentedStyle(look);
  return (
    <View accessibilityRole={style.groupRole} accessibilityLabel={label} style={style.group}>
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole={style.segmentRole}
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={selected ? undefined : () => onChange(option.id)}
            style={[style.segment, selected ? style.selected : null]}
          >
            <Text variant={style.label(selected)}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
