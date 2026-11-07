import { router } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { ActionCard } from "@/components/action-card";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { FailureMessage } from "@/components/failure-message";
import { IconCard } from "@/components/icon-card";
import { Screen } from "@/components/screen";
import { SectionHeader } from "@/components/section-header";
import { TodayPracticeCard } from "@/components/today-practice-card";
import { Text } from "@/components/text";
import { WeekStrip } from "@/components/week-strip";
import { colors, spacing } from "@/constants/theme";
import { useHome } from "@/hooks/use-home";
import { usePracticeMotion } from "@/hooks/use-practice-motion";
import { useTabScreenPadding } from "@/hooks/use-tab-screen-padding";
import { dataFailureMessage } from "@/utils/data-message";
import { enterTransition } from "@/utils/chat-transitions";
import { avatarInitial, continueCard, greeting, seeAllLabel } from "@/utils/home";
import { riseMotion } from "@/utils/practice-motion";

function openChat(params: { session: string }) {
  router.push({ pathname: "/chat", params });
}

function openChats() {
  router.push("/chats");
}

export default function Home() {
  const { state, retry } = useHome();
  const padding = useTabScreenPadding();
  const { home } = usePracticeMotion();

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
  const rise = (index: number) => (home === null ? null : riseMotion(home.rise, index));
  const openToday = () => {
    if (state.today.open.kind === "run") {
      router.push({ pathname: "/practice-run", params: { run: state.today.open.runId } });
    } else {
      router.push("/practice");
    }
  };
  return (
    <Screen edges={["left", "right"]}>
      <ScrollView testID="home-content" contentContainerStyle={[styles.content, padding]}>
        <Animated.View entering={enterTransition(rise(0))} style={styles.header}>
          <View style={styles.headerTexts}>
            <Text variant="footer">{greeting(profile.displayName, new Date(state.loadedAt))}</Text>
            <Text variant="heading" accessibilityRole="header">
              Ready to practice?
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Profile"
            onPress={() => router.push("/profile")}
          >
            <Avatar initial={avatarInitial(profile.displayName)} />
          </Pressable>
        </Animated.View>
        <Animated.View entering={enterTransition(rise(1))}>
          <TodayPracticeCard card={state.today} onPress={openToday} motion={home} />
        </Animated.View>
        <Animated.View entering={enterTransition(rise(2))}>
          <WeekStrip week={state.week} pop={home === null ? null : home.pop} />
        </Animated.View>
        <Animated.View entering={enterTransition(rise(3))} style={styles.tiles}>
          <IconCard
            icon="ask"
            title="Free chat"
            text="Talk about anything"
            textVariant="tileText"
            accessibilityLabel="Free chat"
            onPress={() => router.push("/suggestions")}
            style={styles.tile}
          />
          <IconCard
            icon="pen"
            title="Pick a topic"
            text="Going to vs will, tenses…"
            textVariant="tileText"
            accessibilityLabel="Pick a topic"
            onPress={() => router.push("/practice")}
            style={styles.tile}
          />
        </Animated.View>
        {card === null || activeSession === null ? null : (
          <Animated.View entering={enterTransition(rise(4))} style={styles.section}>
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
          </Animated.View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  failure: { padding: spacing.screenSide, gap: spacing.lg },
  content: {
    paddingTop: spacing.screenTopShort,
    gap: spacing.hero,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.group,
    paddingHorizontal: spacing.screenSide,
  },
  headerTexts: { flexShrink: 1, gap: spacing.xs },
  tiles: { flexDirection: "row", gap: spacing.group, paddingHorizontal: spacing.screenSide },
  tile: { flex: 1 },
  section: { gap: spacing.cluster, paddingHorizontal: spacing.screenSide },
});
