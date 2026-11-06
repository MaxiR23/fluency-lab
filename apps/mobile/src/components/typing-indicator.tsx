import { ActivityIndicator, View } from "react-native";

import { messageBubbleStyle } from "@/components/message-bubble-style";
import { colors } from "@/constants/theme";

export function TypingIndicator() {
  const style = messageBubbleStyle("tutor");
  return (
    <View testID="typing-indicator" accessibilityLabel="Tutor is typing" style={style.row}>
      <View testID="typing-indicator-bubble" style={style.bubble}>
        <ActivityIndicator color={colors.textMuted} />
      </View>
    </View>
  );
}
