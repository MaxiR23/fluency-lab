import { StyleSheet, View } from "react-native";

import type { FailureCause } from "@/auth/auth-port";
import { Text } from "@/components/text";
import { spacing } from "@/constants/theme";
import { failureCauseLine } from "@/utils/auth-message";

export function FailureMessage({ message, cause }: { message: string; cause?: FailureCause }) {
  const causeLine = failureCauseLine(cause, __DEV__);
  return (
    <View style={styles.block}>
      <Text variant="error" accessibilityRole="alert">
        {message}
      </Text>
      {causeLine !== null ? <Text variant="caption">{causeLine}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({ block: { gap: spacing.xs } });
