import type { ReactNode } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from "react-native";

import { Screen } from "@/components/screen";
import { StepProgress } from "@/components/step-progress";
import { Text } from "@/components/text";
import { TextLink } from "@/components/text-link";
import { spacing } from "@/constants/theme";

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
  step: number;
  total: number;
  title: string;
  onBack?: () => void;
  backDisabled?: boolean;
  children?: ReactNode;
  footer: ReactNode;
}) {
  return (
    <Screen edges={["left", "right"]}>
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          {onBack === undefined ? null : (
            <View style={styles.back}>
              <TextLink
                variant="footerLink"
                label="Back"
                disabled={backDisabled}
                onPress={onBack}
              />
            </View>
          )}
          <StepProgress step={step} total={total} />
          <Text variant="title">{title}</Text>
          {children}
        </ScrollView>
        <View style={styles.footer}>{footer}</View>
      </KeyboardAvoidingView>
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
