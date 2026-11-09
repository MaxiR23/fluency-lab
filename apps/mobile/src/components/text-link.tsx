import type { StyleProp, TextStyle } from "react-native";

import { Text } from "@/components/text";

export function TextLink({
  label,
  variant = "captionLink",
  disabled,
  onPress,
  style,
}: {
  label: string;
  variant?: "captionLink" | "captionLinkStrong" | "footerLink" | "actionMuted";
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      variant={variant}
      accessibilityRole="link"
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={style}
    >
      {label}
    </Text>
  );
}
