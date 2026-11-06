import { router, useNavigation } from "expo-router";
import { useEffect, useReducer } from "react";

import { data } from "@/data";
import { dataFailureMessage } from "@/utils/data-message";
import {
  editErrors,
  editStateReducer,
  editUpdate,
  initialEditState,
  type EditDraftEvent,
  type EditField,
  type EditState,
} from "@/utils/profile-edit";

export function useProfileEdit(field: EditField): {
  state: EditState;
  change: (event: EditDraftEvent) => void;
  save: () => Promise<void>;
  retry: () => Promise<void>;
} {
  const [state, dispatch] = useReducer(editStateReducer, initialEditState);
  const navigation = useNavigation();

  useEffect(() => {
    let live = true;
    void data.getProfile().then((profile) => {
      // INFO: a read that ends after the screen unmounts is dropped.
      if (live) dispatch({ type: "loaded", profile });
    });
    return () => {
      live = false;
    };
  }, []);

  async function retry(): Promise<void> {
    dispatch({ type: "load_started" });
    dispatch({ type: "loaded", profile: await data.getProfile() });
  }

  function change(event: EditDraftEvent): void {
    dispatch({ type: "draft_changed", event });
  }

  async function save(): Promise<void> {
    if (state.kind !== "ready") return;
    const errors = editErrors(field, state.draft);
    const update = editUpdate(field, state.draft);
    if (Object.keys(errors).length > 0 || update === null) {
      dispatch({ type: "save_blocked", errors });
      return;
    }
    dispatch({ type: "save_started" });
    const outcome = await data.updateProfile(update);
    if (!outcome.ok) {
      dispatch({ type: "save_failed", message: dataFailureMessage(outcome.failure) });
      return;
    }
    dispatch({ type: "save_finished" });
    // INFO: if the user already left this screen during the save, back would pop another one.
    if (navigation.isFocused()) router.back();
  }

  return { state, change, save, retry };
}
