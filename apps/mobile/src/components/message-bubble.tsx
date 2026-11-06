import { View } from "react-native";

import { messageBubbleStyle, type MessageRole } from "@/components/message-bubble-style";
import { Text } from "@/components/text";

export function MessageBubble({ role, text }: { role: MessageRole; text: string }) {
  return (
    <View style={messageBubbleStyle(role).bubble}>
      <Text variant="message">{text}</Text>
    </View>
  );
}
