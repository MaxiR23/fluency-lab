import { Pressable, StyleSheet, View } from "react-native";

import { BackButton } from "@/components/back-button";
import { Icon, type IconName } from "@/components/icon";
import { IconButton } from "@/components/icon-button";
import { Text } from "@/components/text";
import { borderWidth, colors, radius, size, spacing, strokeWidth } from "@/constants/theme";

export function ChatHeader({
  title,
  subtitle,
  onBack,
  onEnd,
  endDisabled,
  backLabel,
  action,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  onEnd?: () => void;
  endDisabled?: boolean;
  // INFO: the thread goes back to the chat, not to Home.
  backLabel?: string;
  // INFO: a trailing icon button, like the note screen's delete.
  action?: { icon: IconName; label: string; onPress: () => void };
}) {
  return (
    <View style={styles.row}>
      <BackButton onPress={onBack} label={backLabel} />
      <View style={styles.texts}>
        <Text variant="chatTitle" accessibilityRole="header">
          {title}
        </Text>
        {subtitle === undefined ? null : <Text variant="why">{subtitle}</Text>}
      </View>
      {onEnd === undefined ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="End session"
          disabled={endDisabled}
          hitSlop={spacing.tight}
          onPress={onEnd}
          style={({ pressed }) => endStyle({ pressed, disabled: endDisabled === true })}
        >
          <Icon
            name="close"
            color={endDisabled === true ? colors.textMuted : colors.text}
            size={size.iconCard}
            strokeWidth={strokeWidth.action}
          />
        </Pressable>
      )}
      {action === undefined ? null : (
        <IconButton
          icon={action.icon}
          label={action.label}
          onPress={action.onPress}
          color={colors.textMuted}
          iconSize={size.iconCard}
          strokeWidth={strokeWidth.icon}
        />
      )}
    </View>
  );
}

// INFO: the same look the secondary Button drew: dimmed when disabled, accent border pressed.
function endStyle(state: { pressed: boolean; disabled: boolean }) {
  if (state.disabled) return [styles.end, { backgroundColor: colors.background }];
  if (state.pressed) return [styles.end, { borderColor: colors.accentPressed }];
  return styles.end;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.screenTopShort,
    paddingRight: spacing.group,
    paddingBottom: spacing.group,
    paddingLeft: spacing.sm,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.border,
  },
  end: {
    width: size.badge,
    height: size.badge,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.thin,
    alignItems: "center",
    justifyContent: "center",
  },
  texts: { flex: 1, gap: spacing.tight },
});
