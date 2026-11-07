import type { ReactNode } from "react";
import { View } from "react-native";

import { messageBubbleStyle, type MessageRole } from "@/components/message-bubble-style";
import { MessageQuote } from "@/components/message-quote";
import { Text } from "@/components/text";

export function MessageBubble({
  role,
  text,
  quote,
  note,
}: {
  role: MessageRole;
  text: string;
  quote?: { author: string; text: string; onPress: () => void };
  // INFO: the study note card of a tutor bubble, below its text.
  note?: ReactNode;
}) {
  if (quote === undefined) {
    return (
      <View style={messageBubbleStyle(role, { note: note !== undefined }).bubble}>
        <Text variant="message">{text}</Text>
        {note}
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
