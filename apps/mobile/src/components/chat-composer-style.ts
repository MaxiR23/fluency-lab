import type { TextStyle, ViewStyle } from "react-native";

import {
  borderWidth,
  colors,
  fontFamily,
  fontSize,
  radius,
  shadow,
  size,
  spacing,
} from "@/constants/theme";

export function composerInputStyle({ locked }: { locked: boolean }): {
  input: TextStyle;
  placeholderColor: string;
} {
  const common: TextStyle = {
    flex: 1,
    minHeight: size.control,
    paddingVertical: 0,
    paddingHorizontal: spacing.screenSide,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
  };
  if (locked) {
    return {
      input: {
        ...common,
        backgroundColor: colors.surfaceDisabled,
        borderColor: colors.borderDisabled,
        color: colors.textDisabled,
      },
      placeholderColor: colors.textDisabled,
    };
  }
  return {
    input: {
      ...common,
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.borderRaised,
      color: colors.text,
      ...shadow.floating,
    },
    placeholderColor: colors.textPlaceholder,
  };
}

export function sendButtonStyle({ enabled, pressed }: { enabled: boolean; pressed: boolean }): {
  button: ViewStyle;
  glow: ViewStyle | null;
  icon: string;
} {
  const common: ViewStyle = {
    width: size.control,
    height: size.control,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
    alignItems: "center",
    justifyContent: "center",
  };
  if (!enabled) {
    return {
      button: {
        ...common,
        backgroundColor: colors.surfaceDisabled,
        borderColor: colors.borderDisabled,
      },
      glow: null,
      icon: colors.textDisabled,
    };
  }
  return {
    button: {
      ...common,
      backgroundColor: pressed ? colors.accentPressed : colors.accentLine,
      borderColor: colors.accentPressed,
      ...shadow.floating,
    },
    glow: shadow.glow,
    icon: colors.text,
  };
}
