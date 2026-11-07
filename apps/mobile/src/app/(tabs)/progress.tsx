import { router } from "expo-router";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { FailureMessage } from "@/components/failure-message";
import { MistakeCard } from "@/components/mistake-card";
import { Screen } from "@/components/screen";
import { SegmentedControl } from "@/components/segmented-control";
import { SessionCard } from "@/components/session-card";
import { StatCard } from "@/components/stat-card";
import { Text } from "@/components/text";
import { WordCard } from "@/components/word-card";
import { colors, size, spacing } from "@/constants/theme";
import { useProgress } from "@/hooks/use-progress";
import { useTabScreenPadding } from "@/hooks/use-tab-screen-padding";
import { dataFailureMessage } from "@/utils/data-message";
import {
  emptyText,
  monthTiles,
  progressRows,
  progressSections,
  type ProgressRow,
} from "@/utils/progress";

function openSummary(sessionId: string) {
  router.push({ pathname: "/summary", params: { session: sessionId, from: "history" } });
}

function Row({ row }: { row: ProgressRow }) {
  switch (row.kind) {
    case "history":
      return (
        <SessionCard
          title={row.title}
          time={row.date}
          detail={row.line}
          icon={row.icon}
          chevron
          titleAlign="start"
          onPress={() => openSummary(row.id)}
        />
      );
    case "mistake":
      return (
        <MistakeCard
          rule={row.rule}
          times={row.times}
          original={row.original}
          corrected={row.corrected}
        />
      );
    case "word":
      return <WordCard word={row.word} sentence={row.sentence} date={row.date} />;
    case "note":
      return (
        <SessionCard
          title={row.title}
          time={row.date}
          detail={row.subtitle}
          icon={row.icon}
          iconSize={size.iconCard}
          timePlacement="end"
          onPress={() => router.push({ pathname: "/note", params: { id: row.id } })}
        />
      );
  }
}

function Separator() {
  return <View style={styles.separator} />;
}

export default function Progress() {
  const { state, section, select, retry, loadMore, retryMore } = useProgress();
  const padding = useTabScreenPadding();

  if (state.kind === "loading") {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} testID="progress-loading" />
        </View>
      </Screen>
    );
  }
  if (state.kind === "failed") {
    return (
      <Screen>
        <View style={styles.failure}>
          <FailureMessage message={dataFailureMessage(state.failure)} />
          <Button variant="deep" label="Try again" onPress={() => void retry()} />
        </View>
      </Screen>
    );
  }

  const list = state[section];
  return (
    <Screen edges={["left", "right"]}>
      <FlatList
        testID="progress-content"
        data={progressRows(state, section)}
        keyExtractor={(row) => row.key}
        renderItem={({ item }) => <Row row={item} />}
        contentContainerStyle={[styles.content, padding]}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titles}>
              <Text variant="heading" accessibilityRole="header">
                Progress
              </Text>
              <Text variant="footer">This month</Text>
            </View>
            <View style={styles.tiles}>
              {monthTiles(state.month).map((tile) => (
                <StatCard key={tile.label} value={tile.value} label={tile.label} />
              ))}
            </View>
            <SegmentedControl
              look="tabs"
              label="Progress sections"
              options={progressSections}
              value={section}
              onChange={select}
            />
          </View>
        }
        ListEmptyComponent={<Text variant="muted">{emptyText(section)}</Text>}
        ListFooterComponent={
          list.loadingMore ? (
            <View style={styles.more}>
              <ActivityIndicator color={colors.accent} testID="progress-loading-more" />
            </View>
          ) : list.moreFailure !== null ? (
            <View style={styles.moreFailure}>
              <FailureMessage message={dataFailureMessage(list.moreFailure)} />
              <Button variant="deep" label="Try again" onPress={() => void retryMore()} />
            </View>
          ) : undefined
        }
        onEndReached={() => void loadMore()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  failure: { padding: spacing.screenSide, gap: spacing.lg },
  content: { paddingTop: spacing.screenTopShort, paddingHorizontal: spacing.screenSide },
  header: { gap: spacing.hero, paddingBottom: spacing.hero },
  titles: { gap: spacing.xs },
  tiles: { flexDirection: "row", gap: spacing.cluster },
  separator: { height: spacing.cluster },
  more: { paddingTop: spacing.cluster },
  moreFailure: { gap: spacing.sm, paddingTop: spacing.cluster },
});
