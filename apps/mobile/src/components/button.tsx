import { Pressable, type PressableProps } from "react-native";

import { buttonStyle, type ButtonVariant } from "@/components/button-style";
import { Text } from "@/components/text";

export function Button({
  label,
  variant,
  disabled,
  ...rest
}: Omit<PressableProps, "children" | "style" | "disabled"> & {
  label: string;
  variant?: ButtonVariant;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => buttonStyle(variant, { pressed, disabled }).container}
      {...rest}
    >
      {({ pressed }) => (
        <Text style={buttonStyle(variant, { pressed, disabled }).label}>{label}</Text>
      )}
    </Pressable>
  );
}
