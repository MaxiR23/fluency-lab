import { View } from "react-native";
import Animated from "react-native-reanimated";

import { Button } from "@/components/button";
import { FailureMessage } from "@/components/failure-message";
import { OfflineBadge } from "@/components/offline-badge";
import { offlineScreenStyle } from "@/components/offline-screen-style";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { TextLink } from "@/components/text-link";
import { shadow } from "@/constants/theme";
import { enterTransition } from "@/utils/chat-transitions";
import type { FailureView } from "@/utils/auth-message";
import { offlineScreenBody, offlineScreenTitle, retryingLabel } from "@/utils/load-failure";
import type { OfflineMotion } from "@/utils/offline-motion";

// INFO: offline.html and offline-retrying.html, the full screen of launch and onboarding. The retrying
// look drops both shadows around Try again, as the retrying design draws none.
export function OfflineScreen({
  retrying,
  onRetry,
  onSignOut,
  signingOut,
  signOutFailure,
  motion,
}: {
  retrying: boolean;
  onRetry: () => void;
  onSignOut: () => void;
  signingOut: boolean;
  signOutFailure?: FailureView;
  motion: OfflineMotion | null;
}) {
  const style = offlineScreenStyle();
  return (
    <Screen edges={["left", "right"]}>
      <Animated.View
        testID="offline-body"
        entering={enterTransition(motion === null ? null : motion.rise)}
        style={style.body}
      >
        <OfflineBadge look="large" motion={motion} />
        <View style={style.texts}>
          <Text variant="offlineTitle" accessibilityRole="header">
            {offlineScreenTitle}
          </Text>
          <Text variant="subtitle" style={style.centered}>
            {offlineScreenBody}
          </Text>
        </View>
      </Animated.View>
      <View style={style.footer}>
        {signOutFailure === undefined ? null : (
          <FailureMessage message={signOutFailure.message} cause={signOutFailure.cause} />
        )}
        {retrying ? (
          <Button
            variant="strong"
            large
            label="Try again"
            busy={{ label: retryingLabel, spin: motion === null ? null : motion.spin }}
          />
        ) : (
          <View testID="offline-retry-glow" style={shadow.glow}>
            <View testID="offline-retry-floating" style={shadow.floating}>
              <Button variant="strong" large label="Try again" onPress={onRetry} />
            </View>
          </View>
        )}
        <View style={style.signOut}>
          <TextLink
            variant="actionMuted"
            label="Sign out"
            disabled={signingOut}
            onPress={onSignOut}
          />
        </View>
      </View>
    </Screen>
  );
}
