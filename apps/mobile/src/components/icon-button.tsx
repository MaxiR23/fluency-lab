import { Pressable } from "react-native";

import { Icon, type IconName } from "@/components/icon";
import { iconButtonStyle } from "@/components/icon-button-style";
import { colors } from "@/constants/theme";

// INFO: an icon-only button on the touch square; BackButton and the close X of the practice run
// are this with their own icon.
export function IconButton({
  icon,
  label,
  onPress,
  color = colors.text,
  iconSize,
  strokeWidth,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  iconSize?: number;
  strokeWidth?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={iconButtonStyle()}
    >
      <Icon name={icon} color={color} size={iconSize} strokeWidth={strokeWidth} />
    </Pressable>
  );
}
