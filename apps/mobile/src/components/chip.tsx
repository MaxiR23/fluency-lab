import { Pressable } from "react-native";

import { CheckIcon } from "@/components/check-icon";
import { chipStyle, type ChipLook } from "@/components/chip-style";
import { Text } from "@/components/text";

export function Chip({
  label,
  selected,
  look = "choice",
  role = "checkbox",
  onPress,
}: {
  label: string;
  selected: boolean;
  look?: ChipLook;
  role?: "checkbox" | "radio";
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => chipStyle(look, { selected, pressed })}
    >
      <Text variant={look === "topic" ? "action" : "body"}>{label}</Text>
      {selected && look === "choice" ? <CheckIcon /> : null}
    </Pressable>
  );
}
