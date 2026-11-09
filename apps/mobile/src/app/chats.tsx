import { router } from "expo-router";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from "react-native";

import { BackButton } from "@/components/back-button";
import { Button } from "@/components/button";
import { FailureMessage } from "@/components/failure-message";
import { OfflineCard } from "@/components/offline-card";
import { OpenChatRow } from "@/components/open-chat-row";
import { RenameSheet } from "@/components/rename-sheet";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { colors, spacing } from "@/constants/theme";
import { useChatMotion } from "@/hooks/use-chat-motion";
import { useOfflineMotion } from "@/hooks/use-offline-motion";
import { useOpenChats } from "@/hooks/use-open-chats";
import { useRename } from "@/hooks/use-rename";
import { dataFailureMessage } from "@/utils/data-message";
import { loadFailureView } from "@/utils/load-failure";
import {
  deletePromptButtons,
  deletePromptMessage,
  deletePromptTitle,
  openChatRow,
} from "@/utils/open-chats";
import { renameSheetView } from "@/utils/rename-sheet";

export default function Chats() {
  const { state, retry, end, remove, titled } = useOpenChats();
  const motion = useChatMotion();
  const offlineMotion = useOfflineMotion();
  const rename = useRename(titled);
  const sheet = renameSheetView(rename.sheet);
  const failure = state.kind === "failed" ? loadFailureView("chats", state) : null;
  const offline = failure !== null && failure.kind === "offline_card" ? failure : null;

  return (
    <Screen edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
          <Text variant="screenTitle" accessibilityRole="header">
            Open chats
          </Text>
        </View>
        {offline === null ? (
          <View style={styles.intro}>
            <Text variant="intro">Pick up where you left off. Ended chats move to Progress.</Text>
          </View>
        ) : (
          <OfflineCard
            title={offline.title}
            retrying={offline.retrying}
            onRetry={() => void retry()}
            motion={offlineMotion}
            placed
          />
        )}
        <View style={styles.list}>
          {state.kind === "loading" ? (
            <ActivityIndicator color={colors.accent} testID="chats-loading" />
          ) : null}
          {state.kind === "failed" && offline === null ? (
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
                  onRename={() => rename.open(open.session.id, open.session.title)}
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
      {sheet === null ? null : (
        <RenameSheet
          view={sheet}
          onChangeText={rename.change}
          onCancel={rename.cancel}
          onSave={() => void rename.save()}
          motion={motion.sheet}
        />
      )}
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
