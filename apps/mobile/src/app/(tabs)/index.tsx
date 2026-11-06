import { suggestTopics } from "@fluency-lab/shared";
import { router } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import { ActionCard } from "@/components/action-card";
import { Button } from "@/components/button";
import { FailureMessage } from "@/components/failure-message";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { colors, spacing } from "@/constants/theme";
import { useHome } from "@/hooks/use-home";
import { dataFailureMessage } from "@/utils/data-message";
import { continueCard, greeting } from "@/utils/home";

function openChat() {
  router.push("/chat");
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
        <View style={styles.content}>
          <FailureMessage message={dataFailureMessage(state.failure)} />
          <Button variant="deep" label="Try again" onPress={() => void retry()} />
        </View>
      </Screen>
    );
  }

  const card =
    state.activeSession === null ? null : continueCard(state.activeSession, state.loadedAt);
  return (
    <Screen edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="title">{greeting(state.profile.displayName)}</Text>
        <Text variant="subtitle">What do you want to practice today?</Text>
        <ActionCard highlighted icon="chat" title="Free chat" onPress={openChat} />
        {card === null ? null : (
          <>
            <Text variant="label">Continue</Text>
            <ActionCard
              title={card.title}
              description={card.preview}
              meta={card.time ?? undefined}
              onPress={openChat}
            />
          </>
        )}
        <Text variant="label">Suggested for you</Text>
        {suggestTopics(state.profile).map((suggestion) => (
          <ActionCard
            key={suggestion.id}
            title={suggestion.title}
            tags={suggestion.tags}
            onPress={openChat}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.screenSide, gap: spacing.lg },
});
