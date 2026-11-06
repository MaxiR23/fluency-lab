import { router } from "expo-router";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/avatar";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/button";
import { FailureMessage } from "@/components/failure-message";
import { ListGroup } from "@/components/list-group";
import { ListRow } from "@/components/list-row";
import { Screen } from "@/components/screen";
import { StatCard } from "@/components/stat-card";
import { Text } from "@/components/text";
import { colors, spacing } from "@/constants/theme";
import { useProfile } from "@/hooks/use-profile";
import { useSignOut } from "@/hooks/use-sign-out";
import { dataFailureMessage } from "@/utils/data-message";
import {
  deleteAccountButtons,
  deleteAccountPrompt,
  learningValues,
  profileHeader,
  statTiles,
} from "@/utils/profile";
import type { EditField } from "@/utils/profile-edit";

function edit(field: EditField) {
  router.push({ pathname: "/edit-profile", params: { field } });
}

export default function Profile() {
  const { state, email, retry, deletion, deleteAccount } = useProfile();
  const signOut = useSignOut();

  if (state.kind === "loading") {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} testID="profile-loading" />
        </View>
      </Screen>
    );
  }
  if (state.kind === "failed") {
    return (
      <Screen>
        <View style={styles.failure}>
          <FailureMessage message={dataFailureMessage(state.failure)} />
          <Button variant="deep" label="Try again" onPress={() => void retry()} />
        </View>
      </Screen>
    );
  }

  const header = profileHeader(state.profile, email);
  const learning = learningValues(state.profile);
  const failure = signOut.failure ?? deletion.failure ?? undefined;
  return (
    <Screen edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.title}>
          <BackButton onPress={() => router.back()} />
          <Text variant="screenTitle" accessibilityRole="header">
            Profile
          </Text>
        </View>
        <View testID="profile-header" style={styles.identity}>
          <Avatar initial={header.initial} size="large" />
          <Text variant="profileName">{header.name}</Text>
          {header.email === null ? null : <Text variant="footer">{header.email}</Text>}
          <Button variant="secondary" small label="Edit name" onPress={() => edit("name")} />
        </View>
        <View style={styles.stats}>
          {statTiles(state.stats).map((tile) => (
            <StatCard key={tile.label} value={tile.value} label={tile.label} />
          ))}
        </View>
        <ListGroup title="Learning">
          <ListRow title="Level" value={learning.level} chevron onPress={() => edit("level")} />
          <ListRow title="Goals" value={learning.goals} chevron onPress={() => edit("goals")} />
          <ListRow
            title="Topics"
            value={learning.topics}
            chevron
            last
            onPress={() => edit("topics")}
          />
        </ListGroup>
        <View style={styles.account}>
          <ListGroup title="Account">
            <ListRow
              title="Sign out"
              busy={signOut.running || deletion.running}
              onPress={() => void signOut.signOut()}
            />
            <ListRow
              title="Delete account"
              tone="danger"
              last
              busy={signOut.running || deletion.running}
              onPress={() =>
                Alert.alert(
                  deleteAccountPrompt.title,
                  deleteAccountPrompt.message,
                  deleteAccountButtons(() => void deleteAccount()),
                )
              }
            />
          </ListGroup>
          {failure === undefined ? null : (
            <FailureMessage message={failure.message} cause={failure.cause} />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  failure: { padding: spacing.screenSide, gap: spacing.lg },
  content: {
    paddingTop: spacing.screenTopHeader,
    paddingHorizontal: spacing.screenSide,
    paddingBottom: spacing.xl,
    gap: spacing.pageGap,
  },
  title: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: -spacing.group,
  },
  identity: {
    alignItems: "center",
    gap: spacing.cluster,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  stats: { flexDirection: "row", gap: spacing.cluster },
  account: { gap: spacing.sm },
});
