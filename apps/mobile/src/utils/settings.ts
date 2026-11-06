import type { ModelId, MonthSpend, Profile, Provider } from "@fluency-lab/shared";

import type { FailureCause } from "@/auth/auth-port";
import type { DataOutcome } from "@/data/data-port";
import type { KeyPresenceOutcome } from "@/keys/key-port";
import { dataFailureMessage, keyReadFailureMessage } from "@/utils/data-message";
import { providerOptions } from "@/utils/onboarding-options";

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const NOT_SET = "Not set";

const MODEL_LABELS: Record<ModelId, string> = {
  "claude-haiku-5-5": "Claude Haiku 5.5",
};

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// INFO: monthStart is the first day of the month as YYYY-MM-DD; the spend resets on the first of the next one.
export function resetLine(monthStart: string): string {
  const month = Number(monthStart.slice(5, 7));
  return `Counted by Fluency Lab · resets on ${MONTH_SHORT[month % 12]} 1`;
}

// INFO: null without a limit, so no bar is drawn. Over the limit the bar stays full.
export function spendFraction(spent: number, limit: number | null): number | null {
  if (limit === null || limit <= 0) return null;
  return Math.min(spent / limit, 1);
}

// INFO: a percentage rounded to two decimals, so 0.42 / 10 is 4.2% and not 4.199999999999999%.
export function barWidth(fraction: number): `${number}%` {
  return `${Math.round(fraction * 10000) / 100}%`;
}

export function limitLine(limit: number | null): string {
  return limit === null ? "No limit set" : `of ${formatUsd(limit)}`;
}

export function providerLabel(provider: Provider | null): string {
  if (provider === null) return NOT_SET;
  return providerOptions.find((option) => option.id === provider)?.label ?? NOT_SET;
}

export function modelLabel(model: ModelId): string {
  return MODEL_LABELS[model];
}

export function keyLabel(hasKey: boolean): string {
  return hasKey ? "Saved on this device" : NOT_SET;
}

export type SettingsState =
  | { kind: "loading" }
  | { kind: "failed"; message: string; cause?: FailureCause }
  | { kind: "ready"; profile: Profile; spend: MonthSpend; hasKey: boolean };

export type SettingsEvent =
  | { type: "load_started" }
  | {
      type: "loaded";
      profile: DataOutcome<Profile>;
      spend: DataOutcome<MonthSpend>;
      key: KeyPresenceOutcome;
    };

export const initialSettings: SettingsState = { kind: "loading" };

export function settingsFromReads(
  profile: DataOutcome<Profile>,
  spend: DataOutcome<MonthSpend>,
  key: KeyPresenceOutcome,
): SettingsState {
  if (!profile.ok) return { kind: "failed", message: dataFailureMessage(profile.failure) };
  if (!spend.ok) return { kind: "failed", message: dataFailureMessage(spend.failure) };
  if (!key.ok) return { kind: "failed", message: keyReadFailureMessage, cause: key.cause };
  return { kind: "ready", profile: profile.value, spend: spend.value, hasKey: key.value };
}

export function settingsReducer(_state: SettingsState, event: SettingsEvent): SettingsState {
  switch (event.type) {
    case "load_started":
      return initialSettings;
    case "loaded":
      return settingsFromReads(event.profile, event.spend, event.key);
  }
}

// INFO: route params are strings. The key step starts on the user's provider and limit so
// updating the key does not reset them; removable is "1" only when a key is saved.
export function keyStepParams(
  profile: Profile,
  hasKey: boolean,
): { provider: string; limit?: string; removable: string } {
  const params = { provider: profile.provider ?? "claude", removable: hasKey ? "1" : "0" };
  return profile.monthlyLimitUsd === null
    ? params
    : { ...params, limit: String(profile.monthlyLimitUsd) };
}
