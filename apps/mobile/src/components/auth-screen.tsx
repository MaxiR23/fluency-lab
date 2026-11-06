import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { Logo } from "@/components/logo";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { TextLink } from "@/components/text-link";
import { spacing } from "@/constants/theme";
import { formKeyboardOffset } from "@/utils/form-keyboard";

type Footer = { prompt: string; linkLabel: string; onPress: () => void; disabled?: boolean };

// INFO: the design's 72 top and 40 bottom are measured from the screen edges
// and already clear the status bar and the home indicator, so the safe area
// must not add to them: only the sides stay.
export function AuthScreen({
  title,
  subtitle,
  footer,
  children,
  testID,
}: {
  title: string;
  subtitle: string;
  footer?: Footer;
  children?: ReactNode;
  testID?: string;
}) {
  return (
    <Screen edges={["left", "right"]}>
      {/* INFO: insets keep the page's layout while the keyboard is open, so the footer
          stays at the bottom under the keyboard instead of riding above it. */}
      <KeyboardAwareScrollView
        style={styles.fill}
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        mode="insets"
        bottomOffset={formKeyboardOffset}
        testID={testID}
      >
        <View style={styles.content}>
          <Logo />
          <View style={styles.titleBlock}>
            <Text variant="title">{title}</Text>
            <Text variant="subtitle">{subtitle}</Text>
          </View>
          {children}
        </View>
        {footer === undefined ? null : (
          <Text variant="footer" style={styles.footer}>
            {footer.prompt}{" "}
            <TextLink
              variant="footerLink"
              label={footer.linkLabel}
              onPress={footer.onPress}
              disabled={footer.disabled}
            />
          </Text>
        )}
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: {
    flexGrow: 1,
    justifyContent: "space-between",
    gap: spacing.xl,
    paddingTop: spacing.screenTop,
    paddingHorizontal: spacing.screenSide,
    paddingBottom: spacing.screenBottom,
  },
  content: { gap: spacing.xl },
  titleBlock: { gap: spacing.sm },
  footer: { textAlign: "center" },
});
