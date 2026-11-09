import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { ChatComposer } from "@/components/chat-composer";
import { ChatFooter } from "@/components/chat-footer";
import { ChatHeader } from "@/components/chat-header";
import { ChatNotices } from "@/components/chat-notices";
import { ConnectAiCard } from "@/components/connect-ai-card";
import { FailureMessage } from "@/components/failure-message";
import { OfflineCard } from "@/components/offline-card";
import { MessageList } from "@/components/message-list";
import { RenameSheet } from "@/components/rename-sheet";
import { ReplyPreview } from "@/components/reply-preview";
import { Screen } from "@/components/screen";
import { colors, spacing } from "@/constants/theme";
import { useChat } from "@/hooks/use-chat";
import { useChatMotion } from "@/hooks/use-chat-motion";
import { useHaptics } from "@/hooks/use-haptics";
import { useOfflineMotion } from "@/hooks/use-offline-motion";
import { useRename } from "@/hooks/use-rename";
import { busy, sendState } from "@/utils/chat-conversation";
import { chatItems } from "@/utils/chat-items";
import { chatOrigin } from "@/utils/chat-opening";
import { replyPreview } from "@/utils/chat-reply";
import {
  chatNotice,
  chatSubtitle,
  chatTopicId,
  endPromptButtons,
  endPromptTitle,
  noKeyProviderLine,
  originTitle,
} from "@/utils/chat-state";
import { enterTransition } from "@/utils/chat-transitions";
import { loadFailureView } from "@/utils/load-failure";
import { renameSheetView } from "@/utils/rename-sheet";
import { threadHref } from "@/utils/thread-state";

export default function Chat() {
  const params = useLocalSearchParams<{
    starter?: string | string[];
    session?: string | string[];
    topic?: string | string[];
  }>();
  const origin = chatOrigin(params);
  const {
    view,
    setDraft,
    startReply,
    cancelReply,
    send,
    retry,
    end,
    openNote,
    renamed,
    updateKey,
  } = useChat(origin);
  const motion = useChatMotion();
  const rename = useRename(renamed);
  const sheet = renameSheetView(rename.sheet);
  const { play } = useHaptics();
  const offlineMotion = useOfflineMotion();

  if (view.kind === "loading") {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} testID="chat-loading" />
        </View>
      </Screen>
    );
  }
  if (view.kind === "failed") {
    // INFO: a chat that could not be read on the network draws the can't-connect card under the header; any other failure keeps its red text.
    const offline = loadFailureView("chat", view);
    if (offline.kind === "offline_card") {
      return (
        <Screen edges={["left", "right"]}>
          <ChatHeader title={originTitle(origin)} onBack={() => router.back()} />
          <OfflineCard
            title={offline.title}
            retrying={offline.retrying}
            onRetry={() => void retry()}
            motion={offlineMotion}
            placed
          />
        </Screen>
      );
    }
    return (
      <Screen>
        <View style={styles.content}>
          <FailureMessage message={view.message} cause={view.cause} />
          <Button variant="deep" label="Try again" onPress={() => void retry()} />
        </View>
      </Screen>
    );
  }
  const conversation = view.kind === "ready" ? view.conversation : null;
  const session = conversation === null ? null : conversation.session;
  const notice = conversation === null ? null : chatNotice(conversation);
  const locked = conversation === null ? true : sendState(conversation).locked;
  const waiting = conversation === null ? false : busy(conversation);
  const preview = conversation === null ? null : replyPreview(conversation);
  // INFO: edges left and right only: the design's top and bottom already clear the safe area.
  return (
    <Screen edges={["left", "right"]}>
      <View style={styles.fill}>
        <ChatHeader
          title={conversation === null ? originTitle(origin) : conversation.title}
          subtitle={
            conversation === null
              ? noKeyProviderLine
              : chatSubtitle(chatTopicId(conversation), conversation.provider)
          }
          onBack={() => router.back()}
          onEnd={
            conversation === null
              ? undefined
              : () =>
                  Alert.alert(
                    endPromptTitle,
                    undefined,
                    endPromptButtons(() => void end()),
                  )
          }
          endDisabled={waiting}
          onRename={
            conversation === null || session === null
              ? undefined
              : () => rename.open(session.id, conversation.title)
          }
          renameDisabled={waiting}
          titleSwap={motion.titleSwap}
        />
        {conversation === null ? (
          <View style={styles.center}>
            <ConnectAiCard onAddKey={() => router.push("/api-key")} />
          </View>
        ) : (
          <MessageList
            items={chatItems(conversation)}
            motion={motion}
            onReply={locked ? undefined : startReply}
            onArm={() => play("reply")}
            onAsk={(messageId) => router.push(threadHref(messageId))}
            onOpenNote={openNote}
          />
        )}
        <ChatFooter>
          <ChatNotices notice={notice} onRetry={() => void retry()} onUpdateKey={updateKey} />
          {preview === null ? null : (
            <ReplyPreview
              label={preview.label}
              text={preview.text}
              onCancel={cancelReply}
              entering={enterTransition(motion.preview)}
            />
          )}
          <ChatComposer
            value={conversation === null ? "" : conversation.draft}
            onChangeText={setDraft}
            onSend={() => {
              play("send");
              void send();
            }}
            placeholder={
              conversation === null ? "Add a key to start chatting" : "Write in English…"
            }
            locked={locked}
            busy={waiting}
            press={motion.press}
            replying={preview !== null}
          />
        </ChatFooter>
        {sheet === null ? null : (
          <RenameSheet
            view={sheet}
            onChangeText={rename.change}
            onCancel={rename.cancel}
            onSave={() => void rename.save()}
            motion={motion.sheet}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.screenSide, gap: spacing.md },
  fill: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.screenSide,
  },
});
