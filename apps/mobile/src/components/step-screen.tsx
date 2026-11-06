import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { Screen } from "@/components/screen";
import { StepProgress } from "@/components/step-progress";
import { Text } from "@/components/text";
import { TextLink } from "@/components/text-link";
import { spacing } from "@/constants/theme";
import { formKeyboardOffset } from "@/utils/form-keyboard";

// INFO: like AuthScreen, the design's top and bottom already clear the safe
// area, so only the sides stay.
export function StepScreen({
  step,
  total,
  title,
  onBack,
  backDisabled = false,
  children,
  footer,
}: {
  step?: number;
  total?: number;
  title: string;
  onBack?: () => void;
  backDisabled?: boolean;
  children?: ReactNode;
  footer: ReactNode;
}) {
  return (
    <Screen edges={["left", "right"]}>
      {/* INFO: the footer sits below the scroll view and nothing lifts it, so the keyboard
          covers the buttons in place; the focused field is scrolled into view. */}
      <KeyboardAwareScrollView
        style={styles.fill}
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        mode="insets"
        bottomOffset={formKeyboardOffset}
        testID="step-screen-page"
      >
        {onBack === undefined ? null : (
          <View style={styles.back}>
            <TextLink variant="footerLink" label="Back" disabled={backDisabled} onPress={onBack} />
          </View>
        )}
        {step === undefined || total === undefined ? null : (
          <StepProgress step={step} total={total} />
        )}
        <Text variant="title">{title}</Text>
        {children}
      </KeyboardAwareScrollView>
      <View style={styles.footer}>{footer}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: {
    paddingTop: spacing.screenTop,
    paddingHorizontal: spacing.screenSide,
    gap: spacing.xl,
  },
  back: { alignItems: "flex-start" },
  footer: {
    paddingHorizontal: spacing.screenSide,
    paddingBottom: spacing.screenBottom,
    gap: spacing.md,
  },
});
