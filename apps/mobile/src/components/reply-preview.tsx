import { Pressable, View } from "react-native";
import Animated, { type FadeInDown } from "react-native-reanimated";

import { Icon } from "@/components/icon";
import { replyPreviewStyle } from "@/components/reply-preview-style";
import { Text } from "@/components/text";
import { colors, size, strokeWidth } from "@/constants/theme";

export function ReplyPreview({
  label,
  text,
  onCancel,
  entering,
}: {
  label: string;
  text: string;
  onCancel: () => void;
  entering?: FadeInDown;
}) {
  const style = replyPreviewStyle();
  return (
    <Animated.View entering={entering} style={style.card}>
      <Icon
        name="reply"
        color={colors.accent}
        size={size.iconAction}
        strokeWidth={strokeWidth.action}
      />
      <View style={style.texts}>
        <Text variant="tabActive">{label}</Text>
        <Text variant="caption" numberOfLines={1} ellipsizeMode="tail">
          {text}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancel reply"
        onPress={onCancel}
        style={style.cancel}
      >
        <Icon
          name="close"
          color={colors.textMuted}
          size={size.iconAction}
          strokeWidth={strokeWidth.action}
        />
      </Pressable>
    </Animated.View>
  );
}
