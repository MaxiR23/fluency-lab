import { Pressable, View } from "react-native";
import Animated, { type FadeInDown } from "react-native-reanimated";

import {
  askDividerStyle,
  askLabelStyle,
  askRowStyle,
  correctionsCardStyle,
  withdrawnRowStyle,
  withdrawnTextStyle,
} from "@/components/corrections-card-style";
import { Divider } from "@/components/divider";
import { Icon } from "@/components/icon";
import { Tag } from "@/components/tag";
import { Text } from "@/components/text";
import { colors, size, strokeWidth } from "@/constants/theme";
import {
  correctionRows,
  correctionsLabel,
  threadAskLabel,
  type StoredCorrection,
} from "@/utils/chat-items";

export function CorrectionsCard({
  corrections,
  explanation,
  entering,
  ask,
  pinned,
}: {
  corrections: StoredCorrection[];
  explanation: string | null;
  entering?: FadeInDown;
  // INFO: the row that opens the thread of this message; the chat gives it, the thread does not.
  ask?: { replies: string | null; onPress: () => void };
  // INFO: the card pinned at the top of a thread: the learner's sentence first, no count, and
  // the rule at the bottom instead of the explanation.
  pinned?: { sentence: string; rule: string | null };
}) {
  const label = correctionsLabel(corrections.length);
  if (label === null) return null;
  return (
    <Animated.View entering={entering} style={correctionsCardStyle({ ask: ask !== undefined })}>
      {pinned === undefined ? (
        <Text variant="tabActive">{label}</Text>
      ) : (
        <Text variant="explanation">{pinned.sentence}</Text>
      )}
      {correctionRows(corrections).map((row) =>
        row.withdrawn ? (
          <View key={row.key} style={withdrawnRowStyle()}>
            <Text variant="withdrawn" style={withdrawnTextStyle()}>
              {row.original} → {row.corrected}
            </Text>
            <Tag variant="withdrawn" label="Withdrawn" />
          </View>
        ) : (
          <Text key={row.key} variant="correction">
            <Text variant="struck">{row.original}</Text>
            {" → "}
            {row.corrected}
          </Text>
        ),
      )}
      {pinned === undefined ? (
        explanation === null ? null : (
          <Text variant="explanation">{explanation}</Text>
        )
      ) : pinned.rule === null ? null : (
        <Text variant="tabActive">{pinned.rule}</Text>
      )}
      {ask === undefined ? null : (
        <View style={askDividerStyle()}>
          <Divider />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={threadAskLabel(ask.replies)}
            onPress={ask.onPress}
            style={askRowStyle()}
          >
            <Icon
              name="ask"
              color={colors.accent}
              size={size.iconAction}
              strokeWidth={strokeWidth.action}
            />
            <Text variant="captionLinkStrong" style={askLabelStyle()}>
              Ask about this
            </Text>
            {ask.replies === null ? null : <Text variant="replyCount">{ask.replies}</Text>}
            <Icon
              name="chevron"
              color={colors.textMuted}
              size={size.iconCheck}
              strokeWidth={strokeWidth.action}
            />
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}
