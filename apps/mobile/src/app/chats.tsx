import { router } from "expo-router";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from "react-native";

import { BackButton } from "@/components/back-button";
import { Button } from "@/components/button";
import { FailureMessage } from "@/components/failure-message";
import { OpenChatRow } from "@/components/open-chat-row";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { colors, spacing } from "@/constants/theme";
import { useOpenChats } from "@/hooks/use-open-chats";
import { dataFailureMessage } from "@/utils/data-message";
import {
  deletePromptButtons,
  deletePromptMessage,
  deletePromptTitle,
  openChatRow,
} from "@/utils/open-chats";

export default function Chats() {
  const { state, retry, end, remove } = useOpenChats();

  return (
    <Screen edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
          <Text variant="screenTitle" accessibilityRole="header">
            Open chats
          </Text>
        </View>
        <View style={styles.intro}>
          <Text variant="intro">Pick up where you left off. Ended chats move to Progress.</Text>
        </View>
        <View style={styles.list}>
          {state.kind === "loading" ? (
            <ActivityIndicator color={colors.accent} testID="chats-loading" />
          ) : null}
          {state.kind === "failed" ? (
            <>
              <FailureMessage message={dataFailureMessage(state.failure)} />
              <Button variant="deep" label="Try again" onPress={() => void retry()} />
            </>
          ) : null}
          {state.kind === "empty" ? <Text variant="muted">No open chats.</Text> : null}
          {state.kind === "ready" ? (
            <>
              {state.actionFailure === null ? null : (
                <FailureMessage message={dataFailureMessage(state.actionFailure)} />
              )}
              {state.sessions.map((open) => (
                <OpenChatRow
                  key={open.session.id}
                  row={openChatRow(open, state.loadedAt)}
                  onPress={() =>
                    router.push({ pathname: "/chat", params: { session: open.session.id } })
                  }
                  onEnd={() => void end(open.session.id)}
                  onDelete={(close) =>
                    Alert.alert(
                      deletePromptTitle,
                      deletePromptMessage,
                      deletePromptButtons(() => void remove(open.session.id), close),
                    )
                  }
                />
              ))}
            </>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: spacing.screenBottom },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.screenTopShort,
    paddingRight: spacing.group,
    paddingBottom: spacing.group,
    paddingLeft: spacing.sm,
  },
  intro: {
    paddingHorizontal: spacing.screenSide,
    paddingBottom: spacing.md,
  },
  list: { gap: spacing.group, paddingHorizontal: spacing.screenSide },
});
