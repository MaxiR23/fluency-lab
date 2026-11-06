import { StyleSheet, TextInput, View } from "react-native";

import { Button } from "@/components/button";
import { textFieldStyle } from "@/components/text-field-style";
import { colors, spacing } from "@/constants/theme";

// INFO: no value and no send handler yet: the real chat is a later issue.
export function ChatComposer({
  placeholder,
  disabled,
}: {
  placeholder: string;
  disabled: boolean;
}) {
  return (
    <View style={styles.row}>
      <TextInput
        style={[textFieldStyle({ hasError: false }).input, styles.input]}
        placeholder={placeholder}
        placeholderTextColor={colors.textPlaceholder}
        editable={!disabled}
        accessibilityLabel={placeholder}
      />
      <Button variant="deep" label="Send" disabled={disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  input: { flex: 1 },
});
