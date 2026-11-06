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
import { avatarInitial, continueCard, greeting, seeAllLabel } from "@/utils/home";

function openChat(params?: { starter: string } | { session: string }) {
  router.push(params === undefined ? "/chat" : { pathname: "/chat", params });
}

function openAll() {
  router.push("/suggestions");
}

function openChats() {
  router.push("/chats");
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
  const { activeSession } = state;
  const card = activeSession === null ? null : continueCard(activeSession, state.loadedAt);
  const seeAll = seeAllLabel(state.openCount);
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
        <HeroCard onPress={() => openChat()} />
        {card === null || activeSession === null ? null : (
          <View style={styles.section}>
            <SectionHeader
              title="Continue"
              actionLabel={seeAll ?? undefined}
              onAction={openChats}
            />
            <ActionCard
              title={card.title}
              meta={card.meta}
              icon={card.icon}
              action="Resume"
              onPress={() => openChat({ session: activeSession.session.id })}
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
                onPress={() => openChat({ starter: suggestion.id })}
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
