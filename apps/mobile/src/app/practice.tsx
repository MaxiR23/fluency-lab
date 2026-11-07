import { PRACTICE_TARGETS } from "@fluency-lab/shared";
import { router } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { ActionCard } from "@/components/action-card";
import { Button } from "@/components/button";
import { ChatHeader } from "@/components/chat-header";
import { Chip } from "@/components/chip";
import { FailureMessage } from "@/components/failure-message";
import { Screen } from "@/components/screen";
import { SectionHeader } from "@/components/section-header";
import { SegmentedControl } from "@/components/segmented-control";
import { Text } from "@/components/text";
import { colors, shadow, spacing } from "@/constants/theme";
import { usePracticeFocus } from "@/hooks/use-practice-focus";
import { usePracticeMotion } from "@/hooks/use-practice-motion";
import { enterTransition } from "@/utils/chat-transitions";
import { dataFailureMessage } from "@/utils/data-message";
import { practiceParams } from "@/utils/practice-focus";
import { riseMotion } from "@/utils/practice-motion";

const COUNT_OPTIONS = PRACTICE_TARGETS.map((target) => ({
  id: String(target),
  label: String(target),
}));

export default function Practice() {
  const { state, choice, target, select, setTarget, retry } = usePracticeFocus();
  const { focus } = usePracticeMotion();

  // INFO: edges left and right only: the header's own top padding clears the safe area.
  return (
    <Screen edges={["left", "right"]}>
      <ChatHeader title="Practice" onBack={() => router.back()} />
      {state.kind === "loading" ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} testID="practice-loading" />
        </View>
      ) : null}
      {state.kind === "failed" ? (
        <View style={styles.failure}>
          <FailureMessage message={dataFailureMessage(state.failure)} />
          <Button variant="deep" label="Try again" onPress={() => void retry()} />
        </View>
      ) : null}
      {state.kind === "ready" && choice !== null ? (
        <>
          <ScrollView contentContainerStyle={styles.body}>
            {state.model.mistakes !== null || state.model.words !== null ? (
              <Animated.View
                entering={enterTransition(focus === null ? null : riseMotion(focus.rise, 0))}
                style={styles.group}
              >
                <SectionHeader title="For you" />
                {state.model.mistakes === null ? null : (
                  <ActionCard
                    title="From your mistakes"
                    meta={state.model.mistakes.subtitle}
                    icon="review"
                    selected={choice.kind === "mistakes"}
                    onPress={() => select({ kind: "mistakes" })}
                  />
                )}
                {state.model.words === null ? null : (
                  <ActionCard
                    title="Your new words"
                    meta={state.model.words.subtitle}
                    icon="words"
                    selected={choice.kind === "words"}
                    onPress={() => select({ kind: "words" })}
                  />
                )}
              </Animated.View>
            ) : null}
            <Animated.View
              entering={enterTransition(focus === null ? null : riseMotion(focus.rise, 1))}
              style={styles.group}
            >
              <View style={styles.topicHeader}>
                <Text variant="section" accessibilityRole="header">
                  Or pick a topic
                </Text>
                {state.model.suggestedLabel === null ? null : (
                  <Text variant="tabActive">{state.model.suggestedLabel}</Text>
                )}
              </View>
              <View style={styles.topics}>
                {state.model.topics.map((topic) => (
                  <Chip
                    key={topic.id}
                    label={topic.label}
                    look="topic"
                    role="radio"
                    selected={choice.kind === "topic" && choice.topicId === topic.id}
                    onPress={() => select({ kind: "topic", topicId: topic.id })}
                  />
                ))}
              </View>
            </Animated.View>
            <Animated.View
              entering={enterTransition(focus === null ? null : riseMotion(focus.rise, 2))}
              style={styles.group}
            >
              <SectionHeader title="Exercises" />
              <SegmentedControl
                options={COUNT_OPTIONS}
                value={String(target)}
                onChange={(id) => {
                  const next = PRACTICE_TARGETS.find((entry) => String(entry) === id);
                  if (next !== undefined) setTarget(next);
                }}
                label="Number of exercises"
                look="count"
              />
              <Text variant="hint">Miss one and 5 more come in, up to 15.</Text>
            </Animated.View>
          </ScrollView>
          <Animated.View
            entering={enterTransition(focus === null ? null : riseMotion(focus.rise, 3))}
            style={styles.footer}
          >
            <View style={shadow.glow}>
              <View style={shadow.floating}>
                <Button
                  variant="strong"
                  large
                  label="Start practice"
                  onPress={() =>
                    router.push({
                      pathname: "/practice-run",
                      params: practiceParams(choice, target),
                    })
                  }
                />
              </View>
            </View>
          </Animated.View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  failure: { padding: spacing.screenSide, gap: spacing.md },
  body: { padding: spacing.screenSide, gap: spacing.section },
  group: { gap: spacing.cluster },
  topicHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  topics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  footer: {
    paddingTop: spacing.group,
    paddingHorizontal: spacing.screenSide,
    paddingBottom: spacing.composerBottom,
  },
});
