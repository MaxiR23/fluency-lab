import { router, useIsFocused } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { ChatComposer } from "@/components/chat-composer";
import { FailureMessage } from "@/components/failure-message";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { colors, spacing } from "@/constants/theme";
import { keys } from "@/keys";
import { chatKeyView, type ChatKeyView } from "@/utils/chat-state";
import { keyReadFailureMessage } from "@/utils/data-message";

export default function Chat() {
  const [view, setView] = useState<ChatKeyView>({ kind: "loading" });
  const focused = useIsFocused();

  // INFO: read on every focus, so the state updates when the key step goes back here.
  useEffect(() => {
    if (!focused) return;
    let live = true;
    void keys.hasApiKey().then((outcome) => {
      if (live) setView(chatKeyView(outcome));
    });
    return () => {
      live = false;
    };
  }, [focused]);

  async function retry() {
    setView({ kind: "loading" });
    setView(chatKeyView(await keys.hasApiKey()));
  }

  if (view.kind === "loading") {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} testID="chat-loading" />
        </View>
      </Screen>
    );
  }
  if (view.kind === "failed") {
    return (
      <Screen>
        <View style={styles.content}>
          <FailureMessage message={keyReadFailureMessage} cause={view.cause} />
          <Button variant="deep" label="Try again" onPress={() => void retry()} />
        </View>
      </Screen>
    );
  }
  if (view.kind === "ready") {
    return (
      <Screen>
        <View style={styles.content}>
          <Text variant="title">Chat</Text>
          <Text variant="muted">Chat is coming soon.</Text>
        </View>
      </Screen>
    );
  }
  return (
    <Screen>
      <View style={[styles.content, styles.fill]}>
        <View style={styles.centered}>
          <Text variant="title">Connect your AI to start</Text>
          <Text variant="subtitle">
            Add your Claude or OpenAI key. It stays only on this device.
          </Text>
          <Button variant="deep" label="Add API key" onPress={() => router.push("/api-key")} />
        </View>
        <ChatComposer placeholder="Add a key to start chatting" disabled />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.screenSide, gap: spacing.md },
  fill: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", gap: spacing.md },
});
