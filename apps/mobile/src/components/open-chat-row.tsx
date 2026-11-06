import { Pressable, StyleSheet, View } from "react-native";
import Swipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";

import { Icon } from "@/components/icon";
import { SessionCard } from "@/components/session-card";
import { Text } from "@/components/text";
import { borderWidth, colors, radius, size, spacing, strokeWidth } from "@/constants/theme";
import type { OpenChatRowView } from "@/utils/open-chats";

function Actions({
  row,
  methods,
  onEnd,
  onDelete,
}: {
  row: OpenChatRowView;
  methods: SwipeableMethods;
  onEnd: () => void;
  onDelete: (close: () => void) => void;
}) {
  return (
    <View style={styles.actions}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`End ${row.title}`}
        onPress={onEnd}
        style={[styles.action, styles.end]}
      >
        <Icon
          name="check"
          color={colors.text}
          size={size.iconCard}
          strokeWidth={strokeWidth.action}
        />
        <Text variant="swipeAction">End</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Delete ${row.title}`}
        onPress={() => onDelete(() => methods.close())}
        style={[styles.action, styles.remove]}
      >
        <Icon
          name="trash"
          color={colors.error}
          size={size.iconCard}
          strokeWidth={strokeWidth.action}
        />
        <Text variant="swipeActionDanger">Delete</Text>
      </Pressable>
    </View>
  );
}

export function OpenChatRow({
  row,
  onPress,
  onEnd,
  onDelete,
}: {
  row: OpenChatRowView;
  onPress: () => void;
  onEnd: () => void;
  // INFO: receives close, so a cancelled delete slides the row back.
  onDelete: (close: () => void) => void;
}) {
  return (
    <Swipeable
      containerStyle={styles.swipe}
      overshootRight={false}
      renderRightActions={(_progress, _translation, methods) => (
        <Actions row={row} methods={methods} onEnd={onEnd} onDelete={onDelete} />
      )}
    >
      <SessionCard
        title={row.title}
        time={row.time}
        detail={row.preview}
        icon={row.icon}
        onPress={onPress}
      />
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  swipe: { borderRadius: radius.control },
  actions: { flexDirection: "row", gap: spacing.sm, paddingLeft: spacing.sm },
  action: {
    width: size.swipeAction,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderWidth: borderWidth.thin,
    borderRadius: radius.control,
  },
  end: { backgroundColor: colors.accentLine, borderColor: colors.accentPressed },
  remove: { backgroundColor: colors.errorSoft, borderColor: colors.errorLine },
});
