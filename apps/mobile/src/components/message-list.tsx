import { useRef } from "react";
import { StyleSheet } from "react-native";
import {
  KeyboardChatScrollView,
  type KeyboardChatScrollViewRef,
} from "react-native-keyboard-controller";
import Animated, { LayoutAnimationConfig } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CorrectionsCard } from "@/components/corrections-card";
import { MessageBubble } from "@/components/message-bubble";
import { messageBubbleStyle } from "@/components/message-bubble-style";
import { NewWord } from "@/components/new-word";
import { TypingIndicator } from "@/components/typing-indicator";
import { spacing } from "@/constants/theme";
import type { ChatItem } from "@/utils/chat-items";
import { chatKeyboardLayout } from "@/utils/chat-keyboard";
import type { ChatMotion } from "@/utils/chat-motion";
import { enterTransition } from "@/utils/chat-transitions";

export function MessageList({ items, motion }: { items: ChatItem[]; motion: ChatMotion }) {
  const list = useRef<KeyboardChatScrollViewRef>(null);
  const { bottom } = useSafeAreaInsets();
  // INFO: the newest message stays in view when the content grows; the keyboard lift is the library's.
  const scrollToNewest = () => list.current?.scrollToEnd({ animated: false });
  return (
    <KeyboardChatScrollView
      ref={list}
      testID="message-list"
      style={styles.list}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      onContentSizeChange={scrollToNewest}
      onLayout={scrollToNewest}
      offset={chatKeyboardLayout(bottom).listOffset}
    >
      <LayoutAnimationConfig skipEntering>
        {items.map((item) => {
          if (item.kind === "typing") return <TypingIndicator key={item.id} motion={motion} />;
          if (item.kind === "new_word") return <NewWord key={item.id} word={item.word} />;
          if (item.kind === "tutor") {
            return (
              <Animated.View
                key={item.id}
                style={messageBubbleStyle("tutor").row}
                entering={enterTransition(motion.enter)}
              >
                <MessageBubble role="tutor" text={item.text} />
              </Animated.View>
            );
          }
          return (
            <Animated.View
              key={item.id}
              style={messageBubbleStyle("user").row}
              entering={enterTransition(motion.enter)}
            >
              <MessageBubble role="user" text={item.text} />
              <CorrectionsCard
                corrections={item.corrections}
                explanation={item.explanation}
                entering={enterTransition(motion.enter)}
              />
            </Animated.View>
          );
        })}
      </LayoutAnimationConfig>
    </KeyboardChatScrollView>
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
