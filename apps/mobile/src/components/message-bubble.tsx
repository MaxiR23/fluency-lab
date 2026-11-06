import { View } from "react-native";

import { messageBubbleStyle, type MessageRole } from "@/components/message-bubble-style";
import { MessageQuote } from "@/components/message-quote";
import { Text } from "@/components/text";

export function MessageBubble({
  role,
  text,
  quote,
}: {
  role: MessageRole;
  text: string;
  quote?: { author: string; text: string; onPress: () => void };
}) {
  if (quote === undefined) {
    return (
      <View style={messageBubbleStyle(role).bubble}>
        <Text variant="message">{text}</Text>
      </View>
    );
  }
  const style = messageBubbleStyle(role, { quoted: true });
  return (
    <View style={style.bubble}>
      <MessageQuote author={quote.author} text={quote.text} onPress={quote.onPress} />
      <View style={style.body}>
        <Text variant="message">{text}</Text>
      </View>
    </View>
  );
}
