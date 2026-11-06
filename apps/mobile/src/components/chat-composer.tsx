import { Pressable, StyleSheet, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { composerInputStyle, sendButtonStyle } from "@/components/chat-composer-style";
import { Icon } from "@/components/icon";
import { motion, size, spacing, strokeWidth } from "@/constants/theme";
import { pressedScale, type PressMotion } from "@/utils/chat-motion";
import { MAX_MESSAGE_LENGTH, canSend } from "@/utils/chat-state";
import { easing } from "@/utils/chat-transitions";

export function ChatComposer({
  value,
  onChangeText,
  onSend,
  placeholder,
  locked,
  busy,
  press,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  placeholder: string;
  locked: boolean;
  // INFO: busy disables Send while a reply is pending; the input keeps its open look.
  busy?: boolean;
  press: PressMotion | null;
}) {
  const input = composerInputStyle({ locked });
  const enabled = canSend(value, locked, busy);
  return (
    <View style={styles.row}>
      <TextInput
        style={input.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={input.placeholderColor}
        editable={!locked}
        maxLength={MAX_MESSAGE_LENGTH}
        accessibilityLabel="Message"
      />
      <SendButton enabled={enabled} onSend={onSend} press={press} />
    </View>
  );
}

function SendButton({
  enabled,
  onSend,
  press,
}: {
  enabled: boolean;
  onSend: () => void;
  press: PressMotion | null;
}) {
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const scaleTo = (pressed: boolean) => {
    const target = pressedScale(pressed, press);
    scale.set(
      press === null
        ? target
        : withTiming(target, { duration: press.duration, easing: easing(motion.easeOut) }),
    );
  };
  const glow = sendButtonStyle({ enabled, pressed: false }).glow;
  const button = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Send"
      disabled={!enabled}
      onPress={onSend}
      onPressIn={() => scaleTo(true)}
      onPressOut={() => scaleTo(false)}
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
  return (
    <Animated.View testID="send-scale" style={scaleStyle}>
      {glow === null ? (
        button
      ) : (
        <View testID="send-glow" style={glow}>
          {button}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.cluster,
    paddingTop: spacing.group,
    paddingHorizontal: spacing.md,
  },
});
