import { suggestTopics } from "@fluency-lab/shared";
import { router } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import { ActionCard } from "@/components/action-card";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { FailureMessage } from "@/components/failure-message";
import { HeroCard } from "@/components/hero-card";
import { Screen } from "@/components/screen";
import { SectionHeader } from "@/components/section-header";
import { SuggestionCard } from "@/components/suggestion-card";
import { Text } from "@/components/text";
import { WeekStrip } from "@/components/week-strip";
import { colors, spacing } from "@/constants/theme";
import { useHome } from "@/hooks/use-home";
import { dataFailureMessage } from "@/utils/data-message";
import { avatarInitial, continueCard, greeting } from "@/utils/home";

function openChat() {
  router.push("/chat");
}

function openAll() {
  router.push("/suggestions");
}

export default function Home() {
  const { state, retry } = useHome();

  if (state.kind === "loading") {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} testID="home-loading" />
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

  const { profile } = state;
  const card =
    state.activeSession === null ? null : continueCard(state.activeSession, state.loadedAt);
  return (
    <Screen edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerTexts}>
            <Text variant="footer">{greeting(profile.displayName, new Date(state.loadedAt))}</Text>
            <Text variant="heading" accessibilityRole="header">
              Ready to practice?
            </Text>
          </View>
          <Avatar initial={avatarInitial(profile.displayName)} />
        </View>
        <WeekStrip week={state.week} />
        <HeroCard onPress={openChat} />
        {card === null ? null : (
          <View style={styles.section}>
            <SectionHeader title="Continue" />
            <ActionCard
              title={card.title}
              meta={card.meta}
              icon={card.icon}
              action="Resume"
              onPress={openChat}
            />
          </View>
        )}
        <View style={styles.suggested}>
          <View style={styles.sidePadding}>
            <SectionHeader title="Suggested for you" actionLabel="See all" onAction={openAll} />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carousel}
          >
            {suggestTopics(profile).map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                layout="carousel"
                onPress={openChat}
              />
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  failure: { padding: spacing.screenSide, gap: spacing.lg },
  content: {
    paddingTop: spacing.screenTopShort,
    paddingBottom: spacing.md,
    gap: spacing.section,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.group,
    paddingHorizontal: spacing.screenSide,
  },
  headerTexts: { flexShrink: 1, gap: spacing.xs },
  section: { gap: spacing.cluster, paddingHorizontal: spacing.screenSide },
  suggested: { gap: spacing.cluster },
  sidePadding: { paddingHorizontal: spacing.screenSide },
  carousel: { gap: spacing.group, paddingHorizontal: spacing.screenSide },
});
