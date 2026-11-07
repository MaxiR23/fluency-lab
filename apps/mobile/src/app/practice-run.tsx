import { useLocalSearchParams } from "expo-router";
import { useEffect, useEffectEvent, type ReactNode } from "react";
import { ActivityIndicator, Keyboard, ScrollView, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { AnswerOption } from "@/components/answer-option";
import { Button } from "@/components/button";
import { ChatFooter } from "@/components/chat-footer";
import { ChatNotices } from "@/components/chat-notices";
import { ConnectAiCard } from "@/components/connect-ai-card";
import { FailureMessage } from "@/components/failure-message";
import { FeedbackSheet } from "@/components/feedback-sheet";
import { IconButton } from "@/components/icon-button";
import { ResultList } from "@/components/result-list";
import { Screen } from "@/components/screen";
import { ScoreRing } from "@/components/score-ring";
import { SegmentedProgress } from "@/components/segmented-progress";
import { selectableStyle } from "@/components/selectable-style";
import { Tag } from "@/components/tag";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { gapSlotStyle } from "@/components/text-style";
import { colors, motion as tokens, shadow, size, spacing, strokeWidth } from "@/constants/theme";
import { useHaptics } from "@/hooks/use-haptics";
import { usePracticeMotion } from "@/hooks/use-practice-motion";
import { usePracticeRun } from "@/hooks/use-practice-run";
import { sendState } from "@/utils/chat-conversation";
import { enterTransition, easing } from "@/utils/chat-transitions";
import { practiceOrigin } from "@/utils/practice-focus";
import {
  continueBusy,
  currentItem,
  exerciseView,
  fillIndex,
  gapFill,
  noteAction,
  optionState,
  progressPosition,
  runBody,
  runOutcome,
  runTarget,
  segments,
  type PracticeRunState,
} from "@/utils/practice-run";
import { practiceNotice, type PracticeScreenView } from "@/utils/practice-run-state";
import { riseMotion, type ExerciseMotion, type Step } from "@/utils/practice-motion";
import { resultCopy, resultRows, resultScore } from "@/utils/practice-result";

export default function PracticeRun() {
  const params = useLocalSearchParams<{
    run?: string | string[];
    focus?: string | string[];
    topic?: string | string[];
    note?: string | string[];
    target?: string | string[];
  }>();
  const actions = usePracticeRun(practiceOrigin(params));
  const { view } = actions;
  const motion = usePracticeMotion();
  const { play } = useHaptics();

  const feedback = view.kind === "ready" ? view.run.feedback : null;
  const verdictKey = feedback === null ? null : feedback.itemId;
  // INFO: one haptic per verdict: the effect is keyed on the answered item, and the event reads
  // the latest tone without being a dependency.
  const playVerdict = useEffectEvent(() => {
    if (feedback !== null) play(feedback.tone === "right" ? "right" : "miss");
  });
  useEffect(() => {
    if (verdictKey !== null) playVerdict();
  }, [verdictKey]);

  if (view.kind === "loading") {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} testID="practice-run-loading" />
        </View>
      </Screen>
    );
  }
  if (view.kind === "failed") {
    return (
      <Screen>
        <View style={styles.failure}>
          <FailureMessage message={view.message} />
          <Button variant="deep" label="Try again" onPress={() => void actions.retry()} />
        </View>
      </Screen>
    );
  }
  if (view.kind === "no_key") {
    return (
      <Screen edges={["left", "right"]}>
        <View style={styles.fill}>
          <ExerciseHeader onStop={actions.stop} progress={null} />
          <View style={styles.centerCard}>
            <ConnectAiCard onAddKey={actions.updateKey} />
          </View>
        </View>
      </Screen>
    );
  }
  const run = view.run;
  const body = runBody(run);
  const notice = practiceNotice(run);
  const locked = sendState(run).locked;
  const action = noteAction(run);
  const noticeNode = (
    <ChatNotices
      notice={notice}
      onRetry={() => void actions.retry()}
      onUpdateKey={actions.updateKey}
    />
  );

  if (body === "result") {
    return (
      <Screen edges={["left", "right"]}>
        <View style={styles.fill}>
          <View style={styles.resultHeader}>
            <CloseButton label="Close" onPress={() => void actions.finish()} />
          </View>
          <ResultBody run={run} motion={motion.result} />
          <Animated.View
            entering={enterTransition(
              motion.result === null ? null : riseMotion(motion.result.rise, 2, tokens.easeOut),
            )}
            style={styles.resultFooter}
          >
            {noticeNode}
            {runOutcome(run) === "offer" ? (
              <>
                <View style={shadow.glow}>
                  <View style={shadow.floating}>
                    <Button
                      variant="strong"
                      large
                      label="Keep going · 5 more"
                      disabled={locked || run.phase === "finishing"}
                      onPress={() => void actions.keepGoing()}
                    />
                  </View>
                </View>
                <Button
                  variant="secondary"
                  large
                  label="Finish for today"
                  loading={run.phase === "finishing"}
                  onPress={() => void actions.finish()}
                />
              </>
            ) : (
              <View style={shadow.glow}>
                <View style={shadow.floating}>
                  <Button
                    variant="strong"
                    large
                    label="Finish for today"
                    loading={run.phase === "finishing"}
                    onPress={() => void actions.finish()}
                  />
                </View>
              </View>
            )}
          </Animated.View>
        </View>
      </Screen>
    );
  }

  const item = currentItem(run);
  const exercising = body === "exercise";
  const target = runTarget(run);
  const position = progressPosition(run);
  const fillAt = fillIndex(run);
  return (
    <Screen edges={["left", "right"]}>
      <View style={styles.fill}>
        <ExerciseHeader
          onStop={actions.stop}
          progress={{
            segments: segments(run),
            label: `Exercise ${position} of ${target}`,
            count: `${position}/${target}`,
            fill:
              fillAt === null
                ? null
                : { index: fillAt, motion: motion.exercise === null ? null : motion.exercise.fill },
          }}
        />
        {exercising ? (
          <ExerciseBody
            run={run}
            motion={motion.exercise}
            locked={locked}
            onPick={(option) => void actions.pick(option)}
            onDraft={actions.setDraft}
            onCheck={() => {
              // INFO: the verdict replaces the footer with the sheet, which does not follow the
              // keyboard, so the keyboard closes as the answer is sent.
              Keyboard.dismiss();
              void actions.check();
            }}
          />
        ) : (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} testID="practice-run-generating" />
            <Text variant="caption">Getting your exercises ready…</Text>
          </View>
        )}
        {run.feedback !== null && exercising ? (
          <>
            <View style={styles.noticeRow}>{noticeNode}</View>
            <FeedbackSheet
              tone={run.feedback.tone}
              title={run.feedback.title}
              answer={run.feedback.answer}
              explanation={run.feedback.explanation}
              busy={continueBusy(run)}
              onContinue={() => void actions.next()}
              motion={motion.exercise}
              note={
                action === null ? undefined : { ...action, onPress: () => void actions.makeNote() }
              }
            />
          </>
        ) : (
          <ChatFooter>
            {noticeNode}
            {exercising && item !== null && item.kind !== "choose" ? (
              <View style={styles.check}>
                <Button
                  variant="strong"
                  large
                  label="Check"
                  disabled={run.draft.trim() === "" || locked || run.phase !== "answering"}
                  loading={run.phase === "grading"}
                  onPress={() => {
                    Keyboard.dismiss();
                    void actions.check();
                  }}
                />
              </View>
            ) : null}
          </ChatFooter>
        )}
      </View>
    </Screen>
  );
}

function CloseButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <IconButton
      icon="close"
      label={label}
      onPress={onPress}
      color={colors.textMuted}
      iconSize={size.iconBadge}
      strokeWidth={strokeWidth.action}
    />
  );
}

function ExerciseHeader({
  onStop,
  progress,
}: {
  onStop: () => void;
  progress: {
    segments: ReturnType<typeof segments>;
    label: string;
    count: string;
    fill: { index: number; motion: ExerciseMotion["fill"] | null } | null;
  } | null;
}) {
  return (
    <View style={styles.header}>
      <CloseButton label="Stop practice" onPress={onStop} />
      {progress === null ? null : (
        <>
          <SegmentedProgress
            segments={progress.segments}
            look="exercise"
            label={progress.label}
            fill={progress.fill}
          />
          <Text variant="label" numberOfLines={1} style={styles.count}>
            {progress.count}
          </Text>
        </>
      )}
    </View>
  );
}

function ExerciseBody({
  run,
  motion,
  locked,
  onPick,
  onDraft,
  onCheck,
}: {
  run: PracticeRunState;
  motion: ExerciseMotion | null;
  locked: boolean;
  onPick: (option: string) => void;
  onDraft: (text: string) => void;
  onCheck: () => void;
}) {
  const item = currentItem(run);
  if (item === null) return null;
  const view = exerciseView(item);
  const fill = gapFill(run);
  const answered = run.feedback !== null;
  const tone = run.feedback === null ? "idle" : run.feedback.tone;
  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <View style={styles.kindRow}>
        <Text variant="section">{view.kindLabel}</Text>
        <Tag label={view.rule} variant="rule" />
      </View>
      {view.card === null ? (
        <Text variant="prompt">
          {view.gap === null ? (
            view.prompt
          ) : (
            <>
              {view.gap.before}
              <GapSlot fill={fill} />
              {view.gap.after}
            </>
          )}
        </Text>
      ) : (
        <View style={[selectableStyle({ selected: false }), styles.source]}>
          {view.card.label === null ? null : <Text variant="sourceLabel">{view.card.label}</Text>}
          <Text variant="source">{view.card.text}</Text>
        </View>
      )}
      {item.kind === "choose" && item.options !== null ? (
        <View style={styles.options}>
          {item.options.map((option) => (
            <AnswerOption
              key={`${item.id}:${option}`}
              label={option}
              state={optionState(run, option)}
              disabled={locked || run.phase !== "answering"}
              onPress={() => onPick(option)}
              motion={motion}
            />
          ))}
        </View>
      ) : (
        <Shake steps={motion === null ? null : motion.shake} active={tone === "miss"}>
          <TextField
            label="Your answer"
            look="answer"
            tone={tone}
            borderDuration={motion === null ? null : motion.wrong.duration}
            value={answered ? (item.userAnswer ?? "") : run.draft}
            onChangeText={onDraft}
            editable={!answered && !locked && run.phase === "answering"}
            returnKeyType="done"
            submitBehavior="submit"
            onSubmitEditing={onCheck}
          />
        </Shake>
      )}
    </ScrollView>
  );
}

// INFO: the gap is a view of explicit size inside the prompt while empty (a nested view keeps only
// an explicit width and height); once answered it is a span of the prompt, so the answer wraps
// with the sentence (exercise-choose.html).
function GapSlot({ fill }: { fill: string | null }) {
  return fill === null ? (
    <View testID="gap-slot" style={gapSlotStyle()} />
  ) : (
    <Text variant="promptSlot">{fill}</Text>
  );
}

// INFO: the shake of a typed answer that missed (exercise-not-quite.html); a still view with
// reduce motion.
function Shake({
  steps,
  active,
  children,
}: {
  steps: Step[] | null;
  active: boolean;
  children: ReactNode;
}) {
  const x = useSharedValue(0);

  useEffect(() => {
    if (steps === null || !active) return;
    const curve = easing(tokens.easeInOut);
    const [first, ...rest] = steps;
    if (first === undefined) return;
    x.set(
      withSequence(
        withTiming(first.to, { duration: first.duration, easing: curve }),
        ...rest.map((step) => withTiming(step.to, { duration: step.duration, easing: curve })),
      ),
    );
  }, [steps, active, x]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

function ResultBody({
  run,
  motion,
}: {
  run: PracticeRunState;
  motion: ReturnType<typeof usePracticeMotion>["result"];
}) {
  const score = resultScore(run.items);
  const copy = resultCopy({ name: run.displayName, outcome: runOutcome(run), items: run.items });
  const rows = run.run === null ? [] : resultRows(run.run, run.items);
  const rise = (index: number) =>
    enterTransition(motion === null ? null : riseMotion(motion.rise, index, tokens.easeOut));
  return (
    <ScrollView contentContainerStyle={styles.resultBody}>
      <ScoreRing
        size="large"
        fraction={score.fraction}
        label={score.label}
        caption="right"
        motion={motion}
      />
      <Animated.View entering={rise(0)} style={styles.resultTitle}>
        <Text variant="resultTitle" accessibilityRole="header">
          {copy.title}
        </Text>
        <Text variant="subtitle" style={styles.centered}>
          {copy.body}
        </Text>
      </Animated.View>
      <Animated.View entering={rise(1)} style={styles.resultList}>
        <ResultList rows={rows} />
      </Animated.View>
    </ScrollView>
  );
}

export type { PracticeScreenView };

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  centerCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.screenSide,
  },
  failure: { padding: spacing.screenSide, gap: spacing.md },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.group,
    paddingTop: spacing.screenTopShort,
    paddingRight: spacing.screenSide,
    paddingBottom: spacing.group,
    paddingLeft: spacing.sm,
  },
  count: { flexShrink: 0 },
  body: {
    gap: spacing.section,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.screenSide,
  },
  kindRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  source: { gap: spacing.sm, paddingVertical: spacing.card, paddingHorizontal: spacing.md },
  options: { gap: spacing.cluster },
  noticeRow: { backgroundColor: colors.background },
  check: { paddingTop: spacing.group, paddingHorizontal: spacing.screenSide },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: spacing.screenTopShort,
    paddingHorizontal: spacing.sm,
  },
  resultBody: {
    alignItems: "center",
    gap: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.screenSide,
  },
  resultTitle: { alignItems: "center", gap: spacing.stack },
  centered: { textAlign: "center" },
  resultList: { alignSelf: "stretch" },
  resultFooter: {
    gap: spacing.cluster,
    paddingTop: spacing.group,
    paddingHorizontal: spacing.screenSide,
    paddingBottom: spacing.composerBottom,
  },
});
