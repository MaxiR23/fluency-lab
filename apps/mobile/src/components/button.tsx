import { ActivityIndicator, Pressable, type PressableProps } from "react-native";

import { buttonStyle, type ButtonVariant } from "@/components/button-style";
import { Text } from "@/components/text";

export function Button({
  label,
  variant,
  disabled,
  loading,
  compact,
  small,
  ...rest
}: Omit<PressableProps, "children" | "style" | "disabled"> & {
  label: string;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  small?: boolean;
}) {
  const inactive = disabled === true || loading === true;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={loading ? label : undefined}
      accessibilityState={loading ? { busy: true } : undefined}
      disabled={inactive}
      style={({ pressed }) =>
        buttonStyle(variant, { pressed, disabled: disabled === true }, { compact, small }).container
      }
      {...rest}
    >
      {({ pressed }) => {
        const style = buttonStyle(
          variant,
          { pressed, disabled: disabled === true },
          { compact, small },
        );
        return loading ? (
          <ActivityIndicator color={style.label.color} />
        ) : (
          <Text style={style.label}>{label}</Text>
        );
      }}
    </Pressable>
  );
}
