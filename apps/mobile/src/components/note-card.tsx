import { Pressable, View } from "react-native";
import Animated, { type ReanimatedKeyframe } from "react-native-reanimated";

import { Icon, type IconName } from "@/components/icon";
import { noteCardStyle } from "@/components/note-card-style";
import { Text } from "@/components/text";
import { colors, size, strokeWidth } from "@/constants/theme";
import type { NotePreviewLine } from "@/utils/note";

// INFO: the card of a study note inside the tutor's bubble, with Saved to Notes below it. The card
// can be pressed only once the note is saved, and Saved to Notes shows only then, so it never
// claims a save that has not happened. With savedEntering undefined (reduce motion) the line sits in place.
export function NoteCard({
  title,
  topic,
  icon,
  preview,
  saved,
  onPress,
  savedEntering,
}: {
  title: string;
  topic: string;
  icon: IconName;
  preview: readonly NotePreviewLine[];
  saved: boolean;
  onPress?: () => void;
  savedEntering?: ReanimatedKeyframe;
}) {
  const style = noteCardStyle();
  const pressable = saved && onPress !== undefined;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}, study note`}
        disabled={!pressable}
        onPress={onPress}
        style={style.card}
      >
        <View style={style.top}>
          <View style={style.tile}>
            <Icon
              name={icon}
              color={colors.accent}
              size={size.iconAction}
              strokeWidth={strokeWidth.icon}
            />
          </View>
          <View style={style.texts}>
            <Text variant="actionStrong">{title}</Text>
            <Text variant="why">{topic}</Text>
          </View>
          <Icon
            name="chevron"
            color={colors.textMuted}
            size={size.iconCheck}
            strokeWidth={strokeWidth.action}
          />
        </View>
        <View style={style.preview}>
          {preview.map((line, index) => (
            <Text key={`${index}:${line.text}`} variant="explanation">
              {line.lead === null ? null : <Text variant="noteLead">{line.lead}</Text>}
              {line.lead === null ? null : " "}
              {line.text}
            </Text>
          ))}
        </View>
      </Pressable>
      {saved ? (
        <Animated.View testID="note-saved" entering={savedEntering} style={style.saved}>
          <Icon
            name="check"
            color={colors.accent}
            size={size.iconCheck}
            strokeWidth={strokeWidth.check}
          />
          <Text variant="tabActive">Saved to Notes</Text>
        </Animated.View>
      ) : null}
    </>
  );
}
