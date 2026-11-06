import { StyleSheet, View } from "react-native";

import { Screen } from "@/components/screen";
import { SignOutButton } from "@/components/sign-out-button";
import { Text } from "@/components/text";
import { spacing } from "@/constants/theme";
import { useTabScreenPadding } from "@/hooks/use-tab-screen-padding";

export default function Settings() {
  const padding = useTabScreenPadding();
  return (
    <Screen edges={["top", "left", "right"]}>
      <View testID="settings-content" style={[styles.content, padding]}>
        <Text variant="title">Settings</Text>
        <SignOutButton />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.screenSide, gap: spacing.md },
});
