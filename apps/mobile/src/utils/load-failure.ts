import type { DataFailure } from "@/data/data-port";
import { dataFailureMessage } from "@/utils/data-message";

export const offlineScreenTitle = "Can't connect right now";
export const offlineScreenBody =
  "Check your internet and try again. Your chats and progress are safe.";
export const offlineCardBody = "Check your internet and try again.";
export const retryingLabel = "Trying again…";

// INFO: the <thing> in each screen's "Can't load <thing>" card title, in the words the user sees.
const cardThings = {
  chats: "your chats",
  note: "this note",
  suggestions: "your suggestions",
  practice: "your practice",
  profile: "your profile",
  "edit-profile": "your profile",
  summary: "this summary",
  home: "Home",
  progress: "your progress",
  settings: "your settings",
  chat: "this chat",
  thread: "this thread",
  "practice-run": "this practice",
} as const;

export type CardScreen = keyof typeof cardThings;
export type FailureScreen = "launch" | "onboarding" | CardScreen;

// INFO: covers the failed states that hold a DataFailure, the failed launch view and the message
// views that carry the network flag.
export type FailedLoad = { failure?: string; network?: true; retrying?: boolean };

export type MessageFailed = {
  kind: "failed";
  message: string;
  network?: true;
  retrying?: true;
};

// INFO: only an unreachable server counts; "unavailable" keeps the red text.
export function isNetworkFailure(failed: FailedLoad): boolean {
  return failed.failure === "network" || failed.network === true;
}

export type LoadFailureView =
  | { kind: "offline_screen"; retrying: boolean }
  | { kind: "offline_card"; title: string; retrying: boolean }
  | { kind: "message" };

export function loadFailureView(screen: FailureScreen, failed: FailedLoad): LoadFailureView {
  if (!isNetworkFailure(failed)) return { kind: "message" };
  const retrying = failed.retrying === true;
  if (screen === "launch" || screen === "onboarding") return { kind: "offline_screen", retrying };
  return { kind: "offline_card", title: `Can't load ${cardThings[screen]}`, retrying };
}

// INFO: the message views flag a read that failed on the network, so the screen can draw the
// can't-connect view; every other failure keeps the exact object it always had.
export function dataFailedView(failure: DataFailure): MessageFailed {
  const message = dataFailureMessage(failure);
  return failure === "network"
    ? { kind: "failed", message, network: true }
    : { kind: "failed", message };
}

function isFailedLoad(state: { kind: string }): state is { kind: "failed" } & FailedLoad {
  return state.kind === "failed";
}

// INFO: a network failure stays on screen while Try again runs, so the view can draw its retrying
// state; any other failure goes back to loading, as it always did.
export function retryStarted<S extends { kind: string }>(state: S, loading: S): S {
  if (isFailedLoad(state) && isNetworkFailure(state)) return { ...state, retrying: true };
  return loading;
}
