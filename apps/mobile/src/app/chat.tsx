import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, KeyboardAvoidingView, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { ChatComposer } from "@/components/chat-composer";
import { ChatHeader } from "@/components/chat-header";
import { ConnectAiCard } from "@/components/connect-ai-card";
import { FailureMessage } from "@/components/failure-message";
import { MessageList } from "@/components/message-list";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { colors, spacing } from "@/constants/theme";
import { useChat } from "@/hooks/use-chat";
import { busy, sendState } from "@/utils/chat-conversation";
import { chatItems } from "@/utils/chat-items";
import { chatOrigin } from "@/utils/chat-opening";
import { chatNotice, noKeyProviderLine, originTitle, providerLine } from "@/utils/chat-state";

export default function Chat() {
  const params = useLocalSearchParams<{
    starter?: string | string[];
    session?: string | string[];
  }>();
  const origin = chatOrigin(params);
  const { view, setDraft, send, retry, end, updateKey } = useChat(origin);

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
  const waiting = conversation === null ? false : busy(conversation);
  // INFO: edges left and right only: the design's top and bottom already clear the safe area.
  return (
    <Screen edges={["left", "right"]}>
      <KeyboardAvoidingView behavior="padding" style={styles.fill} testID="chat-keyboard-view">
        <ChatHeader
          title={conversation === null ? originTitle(origin) : conversation.title}
          subtitle={conversation === null ? noKeyProviderLine : providerLine(conversation.provider)}
          onBack={() => router.back()}
          onEnd={conversation === null ? undefined : () => void end()}
          endDisabled={waiting}
        />
        {conversation === null ? (
          <View style={styles.center}>
            <ConnectAiCard onAddKey={() => router.push("/api-key")} />
          </View>
        ) : (
          <MessageList items={chatItems(conversation)} />
        )}
        {notice === null ? null : (
          <View style={styles.notices}>
            {notice.kind === "failure" ? (
              <>
                <FailureMessage message={notice.view.message} cause={notice.view.cause} />
                {notice.view.action === null ? null : (
                  <Button
                    variant="deep"
                    compact
                    label={notice.view.action === "update_key" ? "Update key" : "Try again"}
                    onPress={() =>
                      notice.view.action === "update_key" ? updateKey() : void retry()
                    }
                  />
                )}
              </>
            ) : null}
            {notice.kind === "unsupported" ? (
              <>
                <Text variant="muted">{notice.message}</Text>
                <Button variant="deep" compact label="Update key" onPress={updateKey} />
              </>
            ) : null}
            {notice.kind === "limit" ? (
              <FailureMessage message={notice.view.message} cause={notice.view.cause} />
            ) : null}
            {notice.kind === "warning" ? <Text variant="caption">{notice.message}</Text> : null}
          </View>
        )}
        <ChatComposer
          value={conversation === null ? "" : conversation.draft}
          onChangeText={setDraft}
          onSend={() => void send()}
          placeholder={conversation === null ? "Add a key to start chatting" : "Write in English…"}
          locked={locked}
          busy={waiting}
        />
      </KeyboardAvoidingView>
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
  notices: { gap: spacing.sm, paddingHorizontal: spacing.md },
});
