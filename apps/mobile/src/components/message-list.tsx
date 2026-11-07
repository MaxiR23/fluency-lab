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
import { NoteCard } from "@/components/note-card";
import { ReplySwipe } from "@/components/reply-swipe";
import { TypingIndicator } from "@/components/typing-indicator";
import { spacing } from "@/constants/theme";
import type { ChatItem } from "@/utils/chat-items";
import { chatKeyboardLayout } from "@/utils/chat-keyboard";
import type { ChatMotion } from "@/utils/chat-motion";
import { quoteScrollY } from "@/utils/chat-reply";
import { enterTransition } from "@/utils/chat-transitions";
import { savedTransition } from "@/utils/note-transitions";

export function MessageList({
  items,
  motion,
  onReply,
  onArm,
  onAsk,
  onOpenNote,
  layout = "chat",
}: {
  items: ChatItem[];
  motion: ChatMotion;
  // INFO: without onReply no row can be swiped; with it, only the tutor's rows can.
  onReply?: (id: string) => void;
  onArm?: () => void;
  // INFO: without onAsk no learner row asks about its corrections.
  onAsk?: (messageId: string) => void;
  // INFO: without onOpenNote a note card is drawn but cannot be opened.
  onOpenNote?: (noteId: string) => void;
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
            const { note } = item;
            const noteId = note === null ? null : note.noteId;
            const bubble = (
              <MessageBubble
                role="tutor"
                text={item.text}
                note={
                  note === null ? undefined : (
                    <NoteCard
                      title={note.title}
                      topic={note.topic}
                      icon={note.icon}
                      preview={note.preview}
                      saved={note.noteId !== null}
                      onPress={
                        noteId === null || onOpenNote === undefined
                          ? undefined
                          : () => onOpenNote(noteId)
                      }
                      savedEntering={savedTransition(motion.saved)}
                    />
                  )
                }
              />
            );
            return (
              <Animated.View
                key={item.id}
                testID={`row-${item.id}`}
                style={
                  onReply === undefined
                    ? messageBubbleStyle("tutor", { note: note !== null }).row
                    : styles.swipeRow
                }
                entering={enterTransition(note === null ? motion.enter : motion.noteEnter)}
                onLayout={(event) => rows.current.set(item.id, event.nativeEvent.layout.y)}
              >
                {onReply === undefined ? (
                  bubble
                ) : (
                  <ReplySwipe
                    testID={`reply-swipe-${item.id}`}
                    onReply={() => onReply(item.id)}
                    onArm={onArm ?? noop}
                    back={motion.swipeBack}
                    note={note !== null}
                  >
                    {bubble}
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
