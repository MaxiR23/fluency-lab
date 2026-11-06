import { type ComponentRef, useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { CorrectionsCard } from "@/components/corrections-card";
import { MessageBubble } from "@/components/message-bubble";
import { messageBubbleStyle } from "@/components/message-bubble-style";
import { NewWord } from "@/components/new-word";
import { TypingIndicator } from "@/components/typing-indicator";
import { spacing } from "@/constants/theme";
import type { ChatItem } from "@/utils/chat-items";

export function MessageList({ items }: { items: ChatItem[] }) {
  const list = useRef<ComponentRef<typeof ScrollView>>(null);
  // INFO: the newest message stays in view when the content grows and when the keyboard resizes the list.
  const scrollToNewest = () => list.current?.scrollToEnd({ animated: false });
  return (
    <ScrollView
      ref={list}
      testID="message-list"
      style={styles.list}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      onContentSizeChange={scrollToNewest}
      onLayout={scrollToNewest}
    >
      {items.map((item) => {
        if (item.kind === "typing") return <TypingIndicator key={item.id} />;
        if (item.kind === "new_word") return <NewWord key={item.id} word={item.word} />;
        if (item.kind === "tutor") {
          return (
            <View key={item.id} style={messageBubbleStyle("tutor").row}>
              <MessageBubble role="tutor" text={item.text} />
            </View>
          );
        }
        return (
          <View key={item.id} style={messageBubbleStyle("user").row}>
            <MessageBubble role="user" text={item.text} />
            <CorrectionsCard corrections={item.corrections} explanation={item.explanation} />
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: {
    gap: spacing.card,
    paddingVertical: spacing.screenSide,
    paddingHorizontal: spacing.md,
  },
});
