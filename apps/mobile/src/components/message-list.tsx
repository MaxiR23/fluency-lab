import { useRef } from "react";
import { StyleSheet } from "react-native";
import {
  KeyboardChatScrollView,
  type KeyboardChatScrollViewRef,
} from "react-native-keyboard-controller";
import Animated, { LayoutAnimationConfig } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CorrectionsCard } from "@/components/corrections-card";
import { messageListContentStyle, type MessageListLayout } from "@/components/message-list-style";
import { MessageBubble } from "@/components/message-bubble";
import { messageBubbleStyle } from "@/components/message-bubble-style";
import { NewWord } from "@/components/new-word";
import { ReplySwipe } from "@/components/reply-swipe";
import { TypingIndicator } from "@/components/typing-indicator";
import { spacing } from "@/constants/theme";
import type { ChatItem } from "@/utils/chat-items";
import { chatKeyboardLayout } from "@/utils/chat-keyboard";
import type { ChatMotion } from "@/utils/chat-motion";
import { quoteScrollY } from "@/utils/chat-reply";
import { enterTransition } from "@/utils/chat-transitions";

export function MessageList({
  items,
  motion,
  onReply,
  onArm,
  onAsk,
  layout = "chat",
}: {
  items: ChatItem[];
  motion: ChatMotion;
  // INFO: without onReply no row can be swiped; with it, only the tutor's rows can.
  onReply?: (id: string) => void;
  onArm?: () => void;
  // INFO: without onAsk no learner row asks about its corrections.
  onAsk?: (messageId: string) => void;
  layout?: MessageListLayout;
}) {
  const list = useRef<KeyboardChatScrollViewRef>(null);
  // INFO: each message row's y inside the content, read from its layout, so a tapped quote can
  // scroll to the original.
  const rows = useRef(new Map<string, number>());
  const scrollToQuote = (id: string) => {
    const y = quoteScrollY(rows.current.get(id), spacing.screenSide);
    if (y !== null) list.current?.scrollTo({ y, animated: motion.enter !== null });
  };
  const { bottom } = useSafeAreaInsets();
  // INFO: the newest message stays in view when the content grows; the keyboard lift is the library's.
  const scrollToNewest = () => list.current?.scrollToEnd({ animated: false });
  return (
    <KeyboardChatScrollView
      ref={list}
      testID="message-list"
      style={styles.list}
      contentContainerStyle={messageListContentStyle(layout)}
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
                testID={`row-${item.id}`}
                style={onReply === undefined ? messageBubbleStyle("tutor").row : styles.swipeRow}
                entering={enterTransition(motion.enter)}
                onLayout={(event) => rows.current.set(item.id, event.nativeEvent.layout.y)}
              >
                {onReply === undefined ? (
                  <MessageBubble role="tutor" text={item.text} />
                ) : (
                  <ReplySwipe
                    testID={`reply-swipe-${item.id}`}
                    onReply={() => onReply(item.id)}
                    onArm={onArm ?? noop}
                    back={motion.swipeBack}
                  >
                    <MessageBubble role="tutor" text={item.text} />
                  </ReplySwipe>
                )}
              </Animated.View>
            );
          }
          const { quote, thread } = item;
          return (
            <Animated.View
              key={item.id}
              testID={`row-${item.id}`}
              style={messageBubbleStyle("user").row}
              entering={enterTransition(motion.enter)}
              onLayout={(event) => rows.current.set(item.id, event.nativeEvent.layout.y)}
            >
              <MessageBubble
                role="user"
                text={item.text}
                quote={
                  quote === null
                    ? undefined
                    : {
                        author: quote.author,
                        text: quote.text,
                        onPress: () => scrollToQuote(quote.targetId),
                      }
                }
              />
              <CorrectionsCard
                corrections={item.corrections}
                explanation={item.explanation}
                entering={enterTransition(motion.enter)}
                ask={
                  thread === null || onAsk === undefined
                    ? undefined
                    : { replies: thread.replies, onPress: () => onAsk(thread.messageId) }
                }
              />
            </Animated.View>
          );
        })}
      </LayoutAnimationConfig>
    </KeyboardChatScrollView>
  );
}

function noop(): void {}

const styles = StyleSheet.create({
  list: { flex: 1 },
  swipeRow: { alignSelf: "stretch" },
});
