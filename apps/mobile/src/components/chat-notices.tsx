import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { FailureMessage } from "@/components/failure-message";
import { Text } from "@/components/text";
import { spacing } from "@/constants/theme";
import type { ChatNotice } from "@/utils/chat-state";

// INFO: the notices above the composer, the chat's and the thread's: a failure with its action,
// the OpenAI notice, the limit and the warning.
export function ChatNotices({
  notice,
  onRetry,
  onUpdateKey,
}: {
  notice: ChatNotice;
  onRetry: () => void;
  onUpdateKey: () => void;
}) {
  if (notice === null) return null;
  return (
    <View style={styles.notices}>
      {notice.kind === "failure" ? (
        <>
          <FailureMessage message={notice.view.message} cause={notice.view.cause} />
          {notice.view.action === null ? null : (
            <Button
              variant="deep"
              compact
              label={notice.view.action === "update_key" ? "Update key" : "Try again"}
              onPress={notice.view.action === "update_key" ? onUpdateKey : onRetry}
            />
          )}
        </>
      ) : null}
      {notice.kind === "unsupported" ? (
        <>
          <Text variant="muted">{notice.message}</Text>
          <Button variant="deep" compact label="Update key" onPress={onUpdateKey} />
        </>
      ) : null}
      {notice.kind === "limit" ? (
        <FailureMessage message={notice.view.message} cause={notice.view.cause} />
      ) : null}
      {notice.kind === "warning" ? <Text variant="caption">{notice.message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notices: { gap: spacing.sm, paddingHorizontal: spacing.md },
});
