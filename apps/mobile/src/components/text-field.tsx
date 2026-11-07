import { useEffect } from "react";
import { StyleSheet, TextInput, type TextInputProps, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { hasText } from "@/utils/has-text";
import { Text } from "@/components/text";
import {
  textFieldStyle,
  type TextFieldLook,
  type TextFieldTone,
} from "@/components/text-field-style";
import { colors, motion, spacing } from "@/constants/theme";
import { easing } from "@/utils/chat-transitions";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export function TextField({
  label,
  value,
  onChangeText,
  secure = false,
  error,
  look = "form",
  tone = "idle",
  borderDuration = null,
  ...rest
}: Omit<TextInputProps, "style" | "value" | "onChangeText" | "secureTextEntry"> & {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  secure?: boolean;
  error?: string;
  look?: TextFieldLook;
  tone?: TextFieldTone;
  // INFO: the answer look eases its border to the tone over this many ms; null (also reduce
  // motion) turns it at once.
  borderDuration?: number | null;
}) {
  const style = textFieldStyle({ hasError: hasText(error), look, tone });
  const eased = look === "answer" && borderDuration !== null;
  const progress = useSharedValue(0);
  useEffect(() => {
    if (!eased || borderDuration === null) return;
    progress.set(
      tone === "idle"
        ? 0
        : withTiming(1, { duration: borderDuration, easing: easing(motion.easeOut) }),
    );
  }, [eased, tone, borderDuration, progress]);
  const borderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      progress.get(),
      [0, 1],
      [colors.borderRaised, style.input.borderColor as string],
    ),
  }));
  return (
    <View style={styles.container}>
      {look === "form" ? <Text variant="label">{label}</Text> : null}
      <AnimatedTextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textPlaceholder}
        {...rest}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        multiline={look === "answer" ? true : rest.multiline}
        style={eased ? [style.input, borderStyle] : style.input}
      />
      {hasText(error) ? <Text style={style.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
});
