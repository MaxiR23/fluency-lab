import type { Provider } from "@fluency-lab/shared";
import { StyleSheet, View } from "react-native";

import { SegmentedControl } from "@/components/segmented-control";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { spacing } from "@/constants/theme";
import type { AiStepErrors } from "@/utils/onboarding-form";
import { apiKeyNote, monthlyLimitNote, providerOptions } from "@/utils/onboarding-options";

export function AiStepFields({
  provider,
  apiKey,
  monthlyLimit,
  errors,
  onProviderChange,
  onApiKeyChange,
  onMonthlyLimitChange,
}: {
  provider: Provider;
  apiKey: string;
  monthlyLimit: string;
  errors: AiStepErrors;
  onProviderChange: (provider: Provider) => void;
  onApiKeyChange: (apiKey: string) => void;
  onMonthlyLimitChange: (monthlyLimit: string) => void;
}) {
  return (
    <View style={styles.list}>
      <SegmentedControl
        label="Provider"
        options={providerOptions}
        value={provider}
        onChange={onProviderChange}
      />
      <View style={styles.field}>
        <TextField
          label="API key"
          value={apiKey}
          onChangeText={onApiKeyChange}
          error={errors.apiKey}
          secure
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          textContentType="none"
        />
        <Text variant="caption">{apiKeyNote}</Text>
      </View>
      <View style={styles.field}>
        <TextField
          label="Monthly limit (USD)"
          value={monthlyLimit}
          onChangeText={onMonthlyLimitChange}
          error={errors.monthlyLimit}
          keyboardType="decimal-pad"
        />
        <Text variant="caption">{monthlyLimitNote}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.group },
  field: { gap: spacing.sm },
});
