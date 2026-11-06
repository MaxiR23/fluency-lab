import { router } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { FailureMessage } from "@/components/failure-message";
import { Screen } from "@/components/screen";
import { SuggestionCard } from "@/components/suggestion-card";
import { Text } from "@/components/text";
import { TextLink } from "@/components/text-link";
import { colors, spacing } from "@/constants/theme";
import { useAllSuggestions } from "@/hooks/use-all-suggestions";
import { dataFailureMessage } from "@/utils/data-message";

function openChat() {
  router.push("/chat");
}

export default function Suggestions() {
  const { view, retry } = useAllSuggestions();

  return (
    <Screen edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.back}>
          <TextLink variant="footerLink" label="Back" onPress={() => router.back()} />
        </View>
        <Text variant="heading" accessibilityRole="header">
          Suggested for you
        </Text>
        {view.kind === "loading" ? (
          <ActivityIndicator color={colors.accent} testID="suggestions-loading" />
        ) : null}
        {view.kind === "failed" ? (
          <>
            <FailureMessage message={dataFailureMessage(view.failure)} />
            <Button variant="deep" label="Try again" onPress={() => void retry()} />
          </>
        ) : null}
        {view.kind === "empty" ? (
          <Text variant="muted">No suggestions for your level yet.</Text>
        ) : null}
        {view.kind === "ready" ? (
          <View style={styles.list}>
            {view.suggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                layout="list"
                onPress={openChat}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: spacing.screenTopShort,
    paddingHorizontal: spacing.screenSide,
    paddingBottom: spacing.screenBottom,
    gap: spacing.section,
  },
  back: { alignItems: "flex-start" },
  list: { gap: spacing.group },
});
