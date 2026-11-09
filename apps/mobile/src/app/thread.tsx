import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { ChatComposer } from "@/components/chat-composer";
import { ChatFooter } from "@/components/chat-footer";
import { ChatHeader } from "@/components/chat-header";
import { ChatNotices } from "@/components/chat-notices";
import { ConnectAiCard } from "@/components/connect-ai-card";
import { CorrectionsCard } from "@/components/corrections-card";
import { FailureMessage } from "@/components/failure-message";
import { OfflineCard } from "@/components/offline-card";
import { MessageList } from "@/components/message-list";
import { QuickAskChips } from "@/components/quick-ask-chips";
import { Screen } from "@/components/screen";
import { colors, spacing } from "@/constants/theme";
import { useChatMotion } from "@/hooks/use-chat-motion";
import { useHaptics } from "@/hooks/use-haptics";
import { useOfflineMotion } from "@/hooks/use-offline-motion";
import { useThread } from "@/hooks/use-thread";
import { sendState } from "@/utils/chat-conversation";
import { chatNotice, noKeyProviderLine } from "@/utils/chat-state";
import { loadFailureView } from "@/utils/load-failure";
import { pinnedCard, threadItems } from "@/utils/thread-conversation";
import {
  QUICK_ASKS,
  threadBackLabel,
  threadParams,
  threadPlaceholder,
  threadTitle,
} from "@/utils/thread-state";

export default function Thread() {
  const params = useLocalSearchParams<{ message?: string | string[] }>();
  const { view, setDraft, send, sendQuick, retry, updateKey } = useThread(threadParams(params));
  const motion = useChatMotion();
  const { play } = useHaptics();
  const offlineMotion = useOfflineMotion();

  if (view.kind === "loading") {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} testID="thread-loading" />
        </View>
      </Screen>
    );
  }
  if (view.kind === "failed") {
    // INFO: a thread that could not be read on the network draws the can't-connect card under the header; any other failure keeps its red text.
    const offline = loadFailureView("thread", view);
    if (offline.kind === "offline_card") {
      return (
        <Screen edges={["left", "right"]}>
          <ChatHeader
            title={threadTitle}
            backLabel={threadBackLabel}
            onBack={() => router.back()}
          />
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
  const notice = conversation === null ? null : chatNotice(conversation);
  const locked = conversation === null ? true : sendState(conversation).locked;
  const waiting = conversation === null ? false : conversation.phase !== "idle";
  // INFO: edges left and right only: the design's top and bottom already clear the safe area.
  return (
    <Screen edges={["left", "right"]}>
      <View style={styles.fill}>
        <ChatHeader
          title={threadTitle}
          subtitle={conversation === null ? noKeyProviderLine : conversation.session.title}
          backLabel={threadBackLabel}
          onBack={() => router.back()}
        />
        {conversation === null ? (
          <View style={styles.center}>
            <ConnectAiCard onAddKey={() => router.push("/api-key")} />
          </View>
        ) : (
          <>
            <View style={styles.pinned}>
              <CorrectionsCard
                corrections={pinnedCard(conversation).corrections}
                explanation={conversation.message.explanation}
                pinned={{
                  sentence: pinnedCard(conversation).sentence,
                  rule: pinnedCard(conversation).rule,
                }}
              />
            </View>
            <MessageList items={threadItems(conversation)} motion={motion} layout="thread" />
          </>
        )}
        <ChatFooter>
          <ChatNotices notice={notice} onRetry={() => void retry()} onUpdateKey={updateKey} />
          {conversation === null ? null : (
            <QuickAskChips
              asks={QUICK_ASKS}
              disabled={locked || waiting}
              onAsk={(text) => {
                play("send");
                void sendQuick(text);
              }}
            />
          )}
          <ChatComposer
            value={conversation === null ? "" : conversation.draft}
            onChangeText={setDraft}
            onSend={() => {
              play("send");
              void send();
            }}
            placeholder={conversation === null ? "Add a key to start chatting" : threadPlaceholder}
            label="Ask about this correction"
            locked={locked}
            busy={waiting}
            press={motion.press}
            belowChips={conversation !== null}
          />
        </ChatFooter>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.screenSide, gap: spacing.md },
  fill: { flex: 1 },
  pinned: { marginTop: spacing.md, marginHorizontal: spacing.md },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.screenSide,
  },
});
