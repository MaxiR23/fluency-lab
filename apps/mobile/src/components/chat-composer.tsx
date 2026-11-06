import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { composerInputStyle, sendButtonStyle } from "@/components/chat-composer-style";
import { Icon } from "@/components/icon";
import { size, spacing, strokeWidth } from "@/constants/theme";
import { canSend } from "@/utils/chat-state";

export function ChatComposer({
  value,
  onChangeText,
  onSend,
  placeholder,
  locked,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  placeholder: string;
  locked: boolean;
}) {
  const input = composerInputStyle({ locked });
  const enabled = canSend(value, locked);
  return (
    <View style={styles.row}>
      <TextInput
        style={input.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={input.placeholderColor}
        editable={!locked}
        accessibilityLabel="Message"
      />
      <SendButton enabled={enabled} onSend={onSend} />
    </View>
  );
}

function SendButton({ enabled, onSend }: { enabled: boolean; onSend: () => void }) {
  const glow = sendButtonStyle({ enabled, pressed: false }).glow;
  const button = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Send"
      disabled={!enabled}
      onPress={onSend}
      style={({ pressed }) => sendButtonStyle({ enabled, pressed }).button}
    >
      {({ pressed }) => (
        <Icon
          name="send"
          size={size.iconBadge}
          strokeWidth={strokeWidth.send}
          color={sendButtonStyle({ enabled, pressed }).icon}
        />
      )}
    </Pressable>
  );
  return glow === null ? (
    button
  ) : (
    <View testID="send-glow" style={glow}>
      {button}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.cluster,
    paddingTop: spacing.group,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.composerBottom,
  },
});
