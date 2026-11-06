import { Pressable } from "react-native";

import { messageQuoteStyle } from "@/components/message-quote-style";
import { Text } from "@/components/text";

export function MessageQuote({
  author,
  text,
  onPress,
}: {
  author: string;
  text: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go to the quoted message"
      onPress={onPress}
      style={messageQuoteStyle().quote}
    >
      <Text variant="tabActive">{author}</Text>
      <Text variant="explanation" numberOfLines={2}>
        {text}
      </Text>
    </Pressable>
  );
}
