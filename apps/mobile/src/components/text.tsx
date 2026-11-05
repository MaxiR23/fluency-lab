import { Text as RNText, type TextProps as RNTextProps } from "react-native";

import { textStyle, type TextVariant } from "@/components/text-style";

export function Text({ variant, style, ...rest }: RNTextProps & { variant?: TextVariant }) {
  return <RNText style={[textStyle(variant), style]} {...rest} />;
}
