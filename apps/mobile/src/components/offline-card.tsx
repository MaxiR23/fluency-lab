import { View } from "react-native";
import Animated from "react-native-reanimated";

import { Button } from "@/components/button";
import { OfflineBadge } from "@/components/offline-badge";
import { offlineCardStyle } from "@/components/offline-card-style";
import { Text } from "@/components/text";
import { enterTransition } from "@/utils/chat-transitions";
import { offlineCardBody, retryingLabel } from "@/utils/load-failure";
import type { OfflineMotion } from "@/utils/offline-motion";

// INFO: offline-inline.html, the card under a screen's header. The design draws no retrying state, so
// the button takes offline-retrying.html's look at the inline size, and the badge has no rings.
export function OfflineCard({
  title,
  retrying,
  onRetry,
  motion,
  placed = false,
}: {
  title: string;
  retrying: boolean;
  onRetry: () => void;
  motion: OfflineMotion | null;
  placed?: boolean;
}) {
  const style = offlineCardStyle();
  const card = (
    <Animated.View
      testID="offline-card"
      entering={enterTransition(motion === null ? null : motion.rise)}
      style={style.card}
    >
      <OfflineBadge look="small" motion={null} />
      <View style={style.texts}>
        <Text variant="sheetTitle" accessibilityRole="header" style={style.centered}>
          {title}
        </Text>
        <Text variant="cardBody">{offlineCardBody}</Text>
      </View>
      <Button
        variant="strong"
        inline
        label="Try again"
        busy={
          retrying
            ? { label: retryingLabel, spin: motion === null ? null : motion.spin }
            : undefined
        }
        onPress={onRetry}
      />
    </Animated.View>
  );
  // INFO: placed is the slot under a screen's header; the others sit inside their own layout.
  return placed ? <View style={style.slot}>{card}</View> : card;
}
