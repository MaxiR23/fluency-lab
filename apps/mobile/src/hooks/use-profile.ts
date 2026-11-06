import { useIsFocused } from "expo-router";
import { useEffect, useReducer } from "react";

import { auth } from "@/auth";
import { data } from "@/data";
import { useSession } from "@/hooks/use-session";
import { keys } from "@/keys";
import { authFailureView } from "@/utils/auth-message";
import { dataFailureMessage, keyDeleteFailureMessage } from "@/utils/data-message";
import {
  deletionReducer,
  initialDeletion,
  initialProfile,
  profileReducer,
  type Deletion,
  type DeletionStep,
  type ProfileState,
} from "@/utils/profile";
import { deviceTimeZone } from "@/utils/time-zone";

function readProfile() {
  return Promise.all([data.getProfile(), data.getProfileStats(deviceTimeZone())]);
}

export function useProfile(): {
  state: ProfileState;
  email: string | null;
  retry: () => Promise<void>;
  deletion: Deletion;
  deleteAccount: () => Promise<void>;
} {
  const [state, dispatch] = useReducer(profileReducer, initialProfile);
  const [deletion, dispatchDeletion] = useReducer(deletionReducer, initialDeletion);
  const { state: session } = useSession();
  const focused = useIsFocused();

  // INFO: read on every focus, so a name saved on the edit screen shows when it goes back here.
  useEffect(() => {
    if (!focused) return;
    let live = true;
    void readProfile().then(([profile, stats]) => {
      // INFO: a read that ends after Profile unmounts is dropped.
      if (live) dispatch({ type: "loaded", profile, stats });
    });
    return () => {
      live = false;
    };
  }, [focused]);

  async function retry(): Promise<void> {
    dispatch({ type: "load_started" });
    const [profile, stats] = await readProfile();
    dispatch({ type: "loaded", profile, stats });
  }

  // INFO: three steps in order: the account on the server, the key in secure storage, the
  // session. A failure keeps its step, so a retry resumes there and never deletes the
  // account twice. No navigation here: once the session goes away the guard in the root layout
  // sends the user to sign-in.
  async function deleteAccount(): Promise<void> {
    if (deletion.running) return;
    let step: DeletionStep = deletion.step === "idle" ? "account" : deletion.step;
    dispatchDeletion({ type: "started" });
    if (step === "account") {
      const deleted = await data.deleteAccount();
      if (!deleted.ok) {
        dispatchDeletion({
          type: "failed",
          step,
          message: dataFailureMessage(deleted.failure),
        });
        return;
      }
      dispatchDeletion({ type: "account_deleted" });
      step = "key";
    }
    if (step === "key") {
      const removed = await keys.deleteApiKey();
      if (!removed.ok) {
        dispatchDeletion({
          type: "failed",
          step,
          message: keyDeleteFailureMessage,
          cause: removed.cause,
        });
        return;
      }
      dispatchDeletion({ type: "key_cleared" });
      step = "session";
    }
    const signedOut = await auth.signOut();
    if (!signedOut.ok) {
      const view = authFailureView(signedOut);
      dispatchDeletion({ type: "failed", step, message: view.message, cause: view.cause });
    }
  }

  return {
    state,
    email: session.session?.user.email ?? null,
    retry,
    deletion,
    deleteAccount,
  };
}
