import { SESSION_TITLE_MAX } from "@fluency-lab/shared";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/button";
import { FailureMessage } from "@/components/failure-message";
import { renameSheetStyle } from "@/components/rename-sheet-style";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { chatKeyboardLayout } from "@/utils/chat-keyboard";
import type { SheetMotion } from "@/utils/chat-motion";
import { renameSheetTransition } from "@/utils/chat-transitions";
import type { RenameSheetView } from "@/utils/rename-sheet";

// INFO: an overlay inside the screen, as the artboard draws it, not a Modal. The scrim shows at
// once and the sheet closes with no exit animation: chat-rename.html draws neither.
export function RenameSheet({
  view,
  onChangeText,
  onCancel,
  onSave,
  motion,
}: {
  view: RenameSheetView;
  onChangeText: (text: string) => void;
  onCancel: () => void;
  onSave: () => void;
  motion: SheetMotion | null;
}) {
  const { bottom } = useSafeAreaInsets();
  const style = renameSheetStyle(bottom);
  return (
    <View testID="rename-overlay" accessibilityViewIsModal style={style.overlay}>
      <Pressable
        testID="rename-scrim"
        accessible={false}
        importantForAccessibility="no"
        onPress={view.saving ? undefined : onCancel}
        style={style.scrim}
      />
      <KeyboardStickyView
        offset={{ opened: chatKeyboardLayout(bottom).stickyOffset }}
        style={style.dock}
      >
        <Animated.View
          testID="rename-sheet"
          accessibilityLabel="Rename chat"
          entering={renameSheetTransition(motion)}
          style={style.sheet}
        >
          <View style={style.grabberRow}>
            <View style={style.grabber} />
          </View>
          <Text variant="screenTitle" accessibilityRole="header">
            Rename chat
          </Text>
          <View style={style.field}>
            <TextField
              look="sheet"
              label="Title"
              value={view.value}
              onChangeText={onChangeText}
              autoFocus
              maxLength={SESSION_TITLE_MAX}
              returnKeyType="done"
              onSubmitEditing={view.canSave ? onSave : undefined}
            />
            <Text variant="why" style={style.count}>
              {view.count}
            </Text>
          </View>
          {view.failure === null ? null : <FailureMessage message={view.failure} />}
          <View style={style.buttons}>
            <View style={style.button}>
              <Button
                variant="secondary"
                large
                label="Cancel"
                disabled={view.saving}
                onPress={onCancel}
              />
            </View>
            <View style={style.button}>
              <Button
                variant="strong"
                large
                label="Save"
                disabled={!view.canSave}
                loading={view.saving}
                onPress={onSave}
              />
            </View>
          </View>
        </Animated.View>
      </KeyboardStickyView>
    </View>
  );
}
