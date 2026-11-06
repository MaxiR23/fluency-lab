import type { Profile, ProfileUpdate } from "@fluency-lab/shared";
import { createContext, type ReactNode, use, useEffect, useReducer } from "react";

import { data } from "@/data";
import type { DataOutcome } from "@/data/data-port";
import { useSession } from "@/hooks/use-session";
import { gateReducer, initialGate, type OnboardingGate } from "@/utils/onboarding-gate";

type OnboardingValue = {
  gate: OnboardingGate;
  userId: string | null;
  retry: () => Promise<void>;
  finish: (update: ProfileUpdate) => Promise<DataOutcome<Profile>>;
};

const OnboardingContext = createContext<OnboardingValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { state, signedIn } = useSession();
  const userId = signedIn && state.session !== null ? state.session.user.id : null;
  const [gate, dispatch] = useReducer(gateReducer, initialGate);

  // INFO: a read that ends after the user changed is dropped by the reducer, which
  // compares the user id of the event with the one in the gate.
  useEffect(() => {
    dispatch({ type: "user_changed", userId });
    if (userId === null) return;
    void data.getProfile().then((outcome) => dispatch({ type: "profile_read", userId, outcome }));
  }, [userId]);

  async function retry(): Promise<void> {
    if (userId === null) return;
    dispatch({ type: "check_started", userId });
    dispatch({ type: "profile_read", userId, outcome: await data.getProfile() });
  }

  async function finish(update: ProfileUpdate): Promise<DataOutcome<Profile>> {
    const outcome = await data.updateProfile(update);
    if (outcome.ok && userId !== null) {
      dispatch({ type: "profile_read", userId, outcome });
    }
    return outcome;
  }

  return <OnboardingContext value={{ gate, userId, retry, finish }}>{children}</OnboardingContext>;
}

// INFO: using the hook outside the provider is a programming error, not an outcome.
export function useOnboarding(): OnboardingValue {
  const value = use(OnboardingContext);
  if (value === null) {
    throw new Error("useOnboarding must be used inside OnboardingProvider");
  }
  return value;
}
