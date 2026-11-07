import type {
  GrammarTopicId,
  MistakePage,
  MonthSpend,
  PracticeFocus,
  PracticeRunWithItems,
  Profile,
  StudyNote,
  WordPage,
} from "@fluency-lab/shared";

import type { FailureCause } from "@/auth/auth-port";
import type { DataOutcome } from "@/data/data-port";
import type { KeyPresenceOutcome } from "@/keys/key-port";
import { noteDraft } from "@/utils/note";
import { chatNotice, type ChatNotice } from "@/utils/chat-state";
import { dataFailureMessage, keyReadFailureMessage } from "@/utils/data-message";
import type { PracticeOrigin } from "@/utils/practice-focus";
import { focusDataFrom } from "@/utils/practice-prompt";
import { startPractice, type PracticeRunState } from "@/utils/practice-run";

export type PracticeScreenView =
  | { kind: "loading" }
  | { kind: "no_key" }
  | { kind: "failed"; message: string; cause?: FailureCause }
  | { kind: "ready"; run: PracticeRunState };

export const practiceNotFoundMessage = "This practice could not be found.";
export const practiceNoteGoneMessage = "The note of this practice was deleted.";

const noMistakes: MistakePage = { items: [], nextOffset: null };
const noWords: WordPage = { items: [], nextOffset: null };

// INFO: a read that was not made (null) leaves the view loading. With no key nothing else is read,
// as in the chat. The focus data of a run comes from the mistakes or words read only when its focus
// needs it; a topic run needs neither. A note run reads its note: a note that is gone ends the run.
export function practiceRunView(input: {
  key: KeyPresenceOutcome;
  profile: DataOutcome<Profile>;
  spend: DataOutcome<MonthSpend> | null;
  origin: PracticeOrigin | null;
  opened: DataOutcome<PracticeRunWithItems> | null;
  mistakes: DataOutcome<MistakePage> | null;
  words: DataOutcome<WordPage> | null;
  note: DataOutcome<StudyNote> | null;
  language: string | null;
}): PracticeScreenView {
  const { key, profile, spend, origin, opened, mistakes, words, note } = input;
  if (!key.ok) return { kind: "failed", message: keyReadFailureMessage, cause: key.cause };
  if (!key.value) return { kind: "no_key" };
  if (!profile.ok) return { kind: "failed", message: dataFailureMessage(profile.failure) };
  if (origin === null) return { kind: "failed", message: practiceNotFoundMessage };
  if (spend !== null && !spend.ok) {
    return { kind: "failed", message: dataFailureMessage(spend.failure) };
  }
  if (opened !== null && !opened.ok) {
    return {
      kind: "failed",
      message:
        opened.failure === "not_found"
          ? practiceNotFoundMessage
          : dataFailureMessage(opened.failure),
    };
  }
  if (spend === null) return { kind: "loading" };
  if (origin.kind === "resume" && opened === null) return { kind: "loading" };
  const run = opened === null ? null : opened.value;
  const focus: PracticeFocus =
    origin.kind === "new" ? origin.input.focus : (run?.run.focus ?? "mistakes");
  const topicId: GrammarTopicId | null =
    origin.kind === "new"
      ? origin.input.focus === "topic"
        ? origin.input.topicId
        : null
      : (run?.run.topicId ?? null);
  const read =
    focus === "mistakes"
      ? mistakes
      : focus === "words"
        ? words
        : focus === "note"
          ? note
          : undefined;
  if (read === null) return { kind: "loading" };
  if (read !== undefined && !read.ok) {
    return {
      kind: "failed",
      message:
        focus === "note" && read.failure === "not_found"
          ? practiceNoteGoneMessage
          : dataFailureMessage(read.failure),
    };
  }
  const data = focusDataFrom(
    focus,
    topicId,
    mistakes?.ok ? mistakes.value : noMistakes,
    words?.ok ? words.value : noWords,
    profile.value.level,
    note?.ok ? noteDraft(note.value) : null,
  );
  return {
    kind: "ready",
    run: startPractice({
      origin,
      opened: run,
      profile: profile.value,
      spentUsd: spend.value.spentUsd,
      focus: data,
      language: input.language,
    }),
  };
}

export function practiceNotice(run: PracticeRunState): ChatNotice {
  return chatNotice(run);
}
