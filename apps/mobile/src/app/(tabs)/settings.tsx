import { StyleSheet, View } from "react-native";

import { Screen } from "@/components/screen";
import { SignOutButton } from "@/components/sign-out-button";
import { Text } from "@/components/text";
import { spacing } from "@/constants/theme";

export default function Settings() {
  return (
    <Screen>
      <View style={styles.content}>
        <Text variant="title">Settings</Text>
        <SignOutButton />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.screenSide, gap: spacing.md },
});
