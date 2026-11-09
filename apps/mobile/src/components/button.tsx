import { ActivityIndicator, Pressable, type PressableProps } from "react-native";

import { ArcSpinner } from "@/components/arc-spinner";
import { buttonStyle, type ButtonVariant } from "@/components/button-style";
import { Text } from "@/components/text";
import { colors } from "@/constants/theme";

export function Button({
  label,
  variant,
  disabled,
  loading,
  busy,
  compact,
  small,
  large,
  inline,
  ...rest
}: Omit<PressableProps, "children" | "style" | "disabled"> & {
  label: string;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  // INFO: the busy look of offline-retrying.html: the spinner arc beside its own label.
  busy?: { label: string; spin: number | null };
  compact?: boolean;
  small?: boolean;
  large?: boolean;
  inline?: boolean;
}) {
  const inactive = disabled === true || loading === true || busy !== undefined;
  const reportsBusy = loading === true || busy !== undefined;
  const isBusy = busy !== undefined;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={reportsBusy ? label : undefined}
      accessibilityState={reportsBusy ? { busy: true } : undefined}
      disabled={inactive}
      style={({ pressed }) =>
        buttonStyle(
          variant,
          { pressed, disabled: disabled === true, busy: isBusy },
          { compact, small, large, inline },
        ).container
      }
      {...rest}
    >
      {({ pressed }) => {
        const style = buttonStyle(
          variant,
          { pressed, disabled: disabled === true, busy: isBusy },
          { compact, small, large, inline },
        );
        if (busy !== undefined) {
          return (
            <>
              <ArcSpinner spin={busy.spin} color={colors.accent} />
              <Text style={style.label}>{busy.label}</Text>
            </>
          );
        }
        return loading ? (
          <ActivityIndicator color={style.label.color} />
        ) : (
          <Text style={style.label}>{label}</Text>
        );
      }}
    </Pressable>
  );
}
