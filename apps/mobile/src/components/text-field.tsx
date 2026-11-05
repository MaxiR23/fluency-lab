import { StyleSheet, TextInput, View } from "react-native";

import { hasText } from "@/utils/has-text";
import { Text } from "@/components/text";
import { textFieldStyle } from "@/components/text-field-style";
import { spacing } from "@/constants/theme";

export function TextField({
  label,
  value,
  onChangeText,
  secure = false,
  error,
}: {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  secure?: boolean;
  error?: string;
}) {
  const style = textFieldStyle({ hasError: hasText(error) });
  return (
    <View style={styles.container}>
      <Text variant="muted">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        style={style.input}
      />
      {hasText(error) ? <Text style={style.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
});
