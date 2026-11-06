import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import { BackButton } from "@/components/back-button";
import { Button } from "@/components/button";
import { DoneBadge } from "@/components/done-badge";
import { FailureMessage } from "@/components/failure-message";
import { ReviewCard } from "@/components/review-card";
import { Screen } from "@/components/screen";
import { SectionHeader } from "@/components/section-header";
import { StatCard } from "@/components/stat-card";
import { Tag } from "@/components/tag";
import { Text } from "@/components/text";
import { TextLink } from "@/components/text-link";
import { colors, size, spacing } from "@/constants/theme";
import { useSummary } from "@/hooks/use-summary";
import { dataFailureMessage } from "@/utils/data-message";
import {
  noCorrectionsText,
  practiceAgainHref,
  summaryHeading,
  summaryParams,
  summaryStats,
  summarySubtitle,
} from "@/utils/summary";

export default function Summary() {
  const { sessionId, from } =
    summaryParams(
      useLocalSearchParams<{ session?: string | string[]; from?: string | string[] }>(),
    );
  const { state, retry } = useSummary(sessionId);

  if (state.kind === "loading") {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} testID="summary-loading" />
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

  const { summary, profile } = state;
  const fromHistory = from === "history";
  return (
    <Screen edges={["left", "right"]}>
      <ScrollView
        contentContainerStyle={[styles.content, fromHistory ? styles.contentWithBack : null]}
      >
        {fromHistory ? (
          <View style={styles.back}>
            <BackButton label="Back to Progress" onPress={() => router.back()} />
          </View>
        ) : null}
        <View style={styles.header}>
          <DoneBadge />
          <Text variant="heading" accessibilityRole="header" style={styles.centered}>
            {summaryHeading(profile.displayName)}
          </Text>
          <Text variant="footer" style={styles.centered}>
            {summarySubtitle(summary.session)}
          </Text>
        </View>
        <View style={styles.stats}>
          {summaryStats(summary).map((tile) => (
            <StatCard compact key={tile.label} value={tile.value} label={tile.label} />
          ))}
        </View>
        {summary.corrections.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="To review" />
            {summary.corrections.map((correction, index) => (
              <ReviewCard key={`${index}:${correction.original}`} correction={correction} />
            ))}
          </View>
        ) : (
          <Text variant="muted">{noCorrectionsText}</Text>
        )}
        {summary.newWords.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="New words" />
            <View style={styles.words}>
              {summary.newWords.map((word) => (
                <Tag key={word} variant="word" label={word} />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        {fromHistory ? (
          <Button
            variant="strong"
            label="Practice this topic again"
            onPress={() => router.replace(practiceAgainHref(summary.session))}
          />
        ) : (
          <Button variant="strong" label="Back to Home" onPress={() => router.dismissTo("/")} />
        )}
        <View style={styles.link}>
          <TextLink
            variant="footerLink"
            label="See it in Progress"
            onPress={() => router.dismissTo("/progress")}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  failure: { padding: spacing.screenSide, gap: spacing.lg },
  content: {
    paddingTop: spacing.screenTop,
    paddingHorizontal: spacing.screenSide,
    paddingBottom: spacing.screenSide,
    gap: spacing.pageGap,
  },
  contentWithBack: { paddingTop: spacing.screenTopHeader },
  back: { flexDirection: "row", marginHorizontal: -spacing.group },
  header: { alignItems: "center", gap: spacing.group },
  centered: { textAlign: "center" },
  stats: { flexDirection: "row", gap: spacing.sm },
  section: { gap: spacing.cluster },
  words: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  footer: {
    gap: spacing.xs,
    paddingTop: spacing.group,
    paddingHorizontal: spacing.screenSide,
    paddingBottom: spacing.composerBottom,
  },
  link: { minHeight: size.touch, alignItems: "center", justifyContent: "center" },
});
