import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { ChatComposer } from "@/components/chat-composer";
import { ChatHeader } from "@/components/chat-header";
import { ConnectAiCard } from "@/components/connect-ai-card";
import { FailureMessage } from "@/components/failure-message";
import { MessageList } from "@/components/message-list";
import { Screen } from "@/components/screen";
import { colors, spacing } from "@/constants/theme";
import { useChat } from "@/hooks/use-chat";
import { chatTitle, noKeyProviderLine, providerLine } from "@/utils/chat-state";

export default function Chat() {
  const { view, retry } = useChat();
  const params = useLocalSearchParams<{ topic?: string | string[] }>();
  const [draft, setDraft] = useState("");

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
  const ready = view.kind === "ready";
  // INFO: edges left and right only: the design's top and bottom already clear the safe area.
  return (
    <Screen edges={["left", "right"]}>
      <KeyboardAvoidingView behavior="padding" style={styles.fill} testID="chat-keyboard-view">
        <ChatHeader
          title={chatTitle(params.topic)}
          subtitle={ready ? providerLine(view.provider) : noKeyProviderLine}
          onBack={() => router.back()}
        />
        {ready ? (
          <MessageList items={[]} />
        ) : (
          <View style={styles.center}>
            <ConnectAiCard onAddKey={() => router.push("/api-key")} />
          </View>
        )}
        <ChatComposer
          value={draft}
          onChangeText={setDraft}
          // INFO: sending is issue 3; the draft stays until then.
          onSend={() => {}}
          placeholder={ready ? "Write in English…" : "Add a key to start chatting"}
          locked={!ready}
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
});
