import {
  STARTERS,
  allSuggestions,
  type Profile,
  type Starter,
  type Suggestion,
} from "@fluency-lab/shared";

import type { DataFailure, DataOutcome } from "@/data/data-port";

export type SuggestionListView =
  | { kind: "loading" }
  | { kind: "failed"; failure: DataFailure }
  | { kind: "empty" }
  | { kind: "ready"; suggestions: Suggestion[] };

export function suggestionListView(
  profile: DataOutcome<Profile>,
  catalog: readonly Starter[] = STARTERS,
): SuggestionListView {
  if (!profile.ok) return { kind: "failed", failure: profile.failure };
  const suggestions = allSuggestions(profile.value, catalog);
  return suggestions.length === 0 ? { kind: "empty" } : { kind: "ready", suggestions };
}
