import { TUTOR_MODEL } from "@fluency-lab/shared";
import { router } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { FailureMessage } from "@/components/failure-message";
import { OfflineCard } from "@/components/offline-card";
import { ListGroup } from "@/components/list-group";
import { ListRow } from "@/components/list-row";
import { Screen } from "@/components/screen";
import { SpendCard } from "@/components/spend-card";
import { Text } from "@/components/text";
import { ToggleSwitch } from "@/components/toggle-switch";
import { colors, spacing } from "@/constants/theme";
import { useHaptics } from "@/hooks/use-haptics";
import { useOfflineMotion } from "@/hooks/use-offline-motion";
import { useSettings } from "@/hooks/use-settings";
import { useTabScreenPadding } from "@/hooks/use-tab-screen-padding";
import { appVersion } from "@/utils/app-version";
import { hapticsFailureMessage, hapticsSwitchOn } from "@/utils/haptics-setting";
import { loadFailureView } from "@/utils/load-failure";
import {
  formatUsd,
  keyLabel,
  keyStepParams,
  limitLine,
  modelLabel,
  providerLabel,
  resetLine,
  spendFraction,
} from "@/utils/settings";

function editLimit() {
  router.push({ pathname: "/edit-profile", params: { field: "limit" } });
}

function editProvider() {
  router.push({ pathname: "/edit-profile", params: { field: "provider" } });
}

export default function Settings() {
  const { state, retry } = useSettings();
  const { setting, setEnabled } = useHaptics();
  const padding = useTabScreenPadding();
  const motion = useOfflineMotion();

  if (state.kind === "loading") {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} testID="settings-loading" />
        </View>
      </Screen>
    );
  }
  if (state.kind === "failed") {
    // INFO: settings that could not be read on the network draw the can't-connect card under the heading; any other failure keeps its red text.
    const offline = loadFailureView("settings", state);
    if (offline.kind === "offline_card") {
      return (
        <Screen edges={["left", "right"]}>
          <ScrollView contentContainerStyle={[styles.content, padding, styles.offline]}>
            <Text variant="heading" accessibilityRole="header">
              Settings
            </Text>
            <OfflineCard
              title={offline.title}
              retrying={offline.retrying}
              onRetry={() => void retry()}
              motion={motion}
            />
          </ScrollView>
        </Screen>
      );
    }
    return (
      <Screen>
        <View style={styles.failure}>
          <FailureMessage message={state.message} cause={state.cause} />
          <Button variant="deep" label="Try again" onPress={() => void retry()} />
        </View>
      </Screen>
    );
  }

  const { profile, spend, hasKey } = state;
  const hapticsFailure = hapticsFailureMessage(setting);
  return (
    <Screen edges={["left", "right"]}>
      <ScrollView testID="settings-content" contentContainerStyle={[styles.content, padding]}>
        <Text variant="heading" accessibilityRole="header">
          Settings
        </Text>
        <SpendCard
          spent={formatUsd(spend.spentUsd)}
          limitLine={limitLine(profile.monthlyLimitUsd)}
          fraction={spendFraction(spend.spentUsd, profile.monthlyLimitUsd)}
          resetLine={resetLine(spend.monthStart)}
          onEditLimit={editLimit}
        />
        <ListGroup title="Your AI">
          <ListRow
            title="Provider"
            value={providerLabel(profile.provider)}
            chevron
            onPress={editProvider}
          />
          <ListRow title="Model" value={modelLabel(TUTOR_MODEL)} />
          <ListRow
            title="API key"
            value={keyLabel(hasKey)}
            chevron
            last
            onPress={() =>
              router.push({ pathname: "/api-key", params: keyStepParams(profile, hasKey) })
            }
          />
        </ListGroup>
        <View style={styles.app}>
          <ListGroup title="App">
            <ListRow
              title="Haptics"
              trailing={
                <ToggleSwitch
                  label="Haptics"
                  value={hapticsSwitchOn(setting)}
                  onChange={(on) => void setEnabled(on)}
                />
              }
            />
            <ListRow title="Version" value={appVersion()} last />
          </ListGroup>
          {hapticsFailure === null ? null : <FailureMessage message={hapticsFailure} />}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  failure: { padding: spacing.screenSide, gap: spacing.lg },
  content: {
    paddingTop: spacing.screenTopShort,
    paddingHorizontal: spacing.screenSide,
    gap: spacing.pageGap,
  },
  app: { gap: spacing.sm },
  // INFO: offline-inline.html's card sits 8 under the heading.
  offline: { gap: spacing.sm },
});
