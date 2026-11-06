import { PROVIDERS, type Provider } from "@fluency-lab/shared";

import type { PromptButton } from "@/utils/chat-state";
import { parseMonthlyLimit } from "@/utils/onboarding-form";
import { DEFAULT_MONTHLY_LIMIT } from "@/utils/onboarding-options";

type Param = string | string[] | undefined;

function firstOf(param: Param): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}

// INFO: opened from Chat there are no params and the step starts on claude and the default
// limit. Opened from Settings it starts on the user's own provider and limit, so updating the
// key does not reset them. An unknown provider or a bad limit falls back to the defaults.
export function keyStepStart(params: { provider?: Param; limit?: Param; removable?: Param }): {
  provider: Provider;
  monthlyLimit: string;
  removable: boolean;
} {
  const provider = PROVIDERS.find((entry) => entry === firstOf(params.provider)) ?? "claude";
  const limit = firstOf(params.limit);
  return {
    provider,
    monthlyLimit:
      limit !== undefined && parseMonthlyLimit(limit) !== null ? limit : DEFAULT_MONTHLY_LIMIT,
    removable: firstOf(params.removable) === "1",
  };
}

export const removeKeyPrompt = {
  title: "Remove your API key?",
  message: "It is deleted from this device. Chat needs a key to reply.",
} as const;

export function removeKeyButtons(onRemove: () => void): PromptButton[] {
  return [
    { text: "Cancel", style: "cancel" },
    { text: "Remove", style: "destructive", onPress: onRemove },
  ];
}
