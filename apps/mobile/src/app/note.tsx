import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { ChatHeader } from "@/components/chat-header";
import { ComparisonTable } from "@/components/comparison-table";
import { FailureMessage } from "@/components/failure-message";
import { OfflineCard } from "@/components/offline-card";
import { Screen } from "@/components/screen";
import { Tag } from "@/components/tag";
import { Text } from "@/components/text";
import { borderWidth, colors, radius, shadow, spacing } from "@/constants/theme";
import { useNote } from "@/hooks/use-note";
import { useOfflineMotion } from "@/hooks/use-offline-motion";
import { useNoteMotion } from "@/hooks/use-note-motion";
import { dataFailureMessage } from "@/utils/data-message";
import { loadFailureView } from "@/utils/load-failure";
import { deleteNotePrompt, noteParams, noteTable, noteTag } from "@/utils/note";
import { rowMotion } from "@/utils/note-motion";
import { rowTransition } from "@/utils/note-transitions";
import { notePracticeParams } from "@/utils/practice-focus";

export default function Note() {
  const noteId = noteParams(useLocalSearchParams<{ id?: string | string[] }>());
  const { state, retry, remove } = useNote(noteId);
  const motion = useNoteMotion();
  const offlineMotion = useOfflineMotion();

  useEffect(() => {
    if (state.kind === "deleted") router.back();
  }, [state.kind]);

  if (state.kind === "loading" || state.kind === "deleted") {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} testID="note-loading" />
        </View>
      </Screen>
    );
  }
  if (state.kind === "failed") {
    // INFO: a note that could not be read on the network draws the can't-connect card under the header; any other failure keeps its red text.
    const offline = loadFailureView("note", state);
    if (offline.kind === "offline_card") {
      return (
        <Screen edges={["left", "right"]}>
          <ChatHeader title="Note" backLabel="Back" onBack={() => router.back()} />
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
        <View style={styles.failure}>
          <FailureMessage message={dataFailureMessage(state.failure)} />
          <Button variant="deep" label="Try again" onPress={() => void retry()} />
        </View>
      </Screen>
    );
  }

  const { note, deleteFailure, deleting } = state;
  const prompt = deleteNotePrompt(() => void remove());
  const table = noteTable(note);
  return (
    <Screen edges={["left", "right"]}>
      <ChatHeader
        title="Note"
        backLabel="Back"
        onBack={() => router.back()}
        action={{
          icon: "trashPlain",
          label: "Delete note",
          onPress: () => Alert.alert(prompt.title, prompt.message, prompt.buttons),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.title}>
          <View style={styles.tag}>
            <Tag variant="rule" label={noteTag(note)} />
          </View>
          <Text variant="resultTitle" accessibilityRole="header">
            {note.title}
          </Text>
        </View>
        <ComparisonTable
          columns={table.columns}
          rows={table.rows}
          row={(index) => rowTransition(rowMotion(motion, index))}
        />
        <View style={styles.remember}>
          <Text variant="eyebrow">Remember</Text>
          <Text variant="correction">{note.content.remember}</Text>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        {deleteFailure === null ? null : (
          <FailureMessage message={dataFailureMessage(deleteFailure)} />
        )}
        <View style={shadow.glow}>
          <View style={shadow.floating}>
            <Button
              variant="strong"
              large
              label="Practice this · 5 exercises"
              disabled={deleting}
              onPress={() =>
                router.push({ pathname: "/practice-run", params: notePracticeParams(note.id) })
              }
            />
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  failure: { padding: spacing.screenSide, gap: spacing.lg },
  content: { gap: spacing.hero, padding: spacing.screenSide },
  title: { gap: spacing.stack },
  tag: { alignSelf: "flex-start" },
  remember: {
    gap: spacing.sm,
    paddingVertical: spacing.card,
    paddingHorizontal: spacing.md,
    borderRadius: radius.badgeLarge,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.thin,
  },
  footer: {
    gap: spacing.cluster,
    paddingTop: spacing.group,
    paddingHorizontal: spacing.screenSide,
    paddingBottom: spacing.composerBottom,
  },
});
