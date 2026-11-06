import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import {
  composerInputStyle,
  composerLines,
  composerRowStyle,
  sendButtonStyle,
} from "@/components/chat-composer-style";
import { Icon } from "@/components/icon";
import { motion, size, strokeWidth } from "@/constants/theme";
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
  replying,
  label = "Message",
  belowChips,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  placeholder: string;
  locked: boolean;
  // INFO: busy disables Send while a reply is pending; the input keeps its open look.
  busy?: boolean;
  press: PressMotion | null;
  // INFO: a reply preview shows above the composer, which tightens the row's top padding.
  replying?: boolean;
  // INFO: the input's accessibility label; the thread names what it asks about.
  label?: string;
  // INFO: the quick-ask chips of a thread sit above the composer, which tightens its top padding.
  belowChips?: boolean;
}) {
  const [lines, setLines] = useState(1);
  const input = composerInputStyle({ locked, lines });
  const enabled = canSend(value, locked, busy);
  return (
    <View style={composerRowStyle(replying === true, belowChips === true)}>
      <TextInput
        style={input.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={input.placeholderColor}
        editable={!locked}
        maxLength={MAX_MESSAGE_LENGTH}
        accessibilityLabel={label}
        multiline
        submitBehavior="newline"
        // INFO: the height is the layout's and the count a pure function; the input grows by
        // itself up to its max height and scrolls inside after it.
        onLayout={(event) => setLines(composerLines(event.nativeEvent.layout.height))}
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
