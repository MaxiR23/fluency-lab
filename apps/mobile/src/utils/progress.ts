import type {
  HistoryItem,
  HistoryPage,
  MistakeGroup,
  MistakePage,
  MonthProgress,
  NewWordItem,
  NoteListItem,
  NotePage,
  WordPage,
} from "@fluency-lab/shared";

import type { IconName } from "@/components/icon";
import type { DataFailure, DataOutcome } from "@/data/data-port";
import { shortDate } from "@/utils/calendar";
import { noteDate, noteIcon, noteSubtitle } from "@/utils/note";
import { sessionIcon } from "@/utils/topic-icon";

export type ProgressSection = "history" | "mistakes" | "words" | "notes";

export const progressSections = [
  { id: "history", label: "History" },
  { id: "mistakes", label: "Mistakes" },
  { id: "words", label: "Words" },
  { id: "notes", label: "Notes" },
] as const;

export type ProgressList<T> = {
  items: T[];
  nextOffset: number | null;
  loadingMore: boolean;
  moreFailure: DataFailure | null;
};

export type ProgressState =
  | { kind: "loading" }
  | { kind: "failed"; failure: DataFailure }
  | {
      kind: "ready";
      month: MonthProgress;
      history: ProgressList<HistoryItem>;
      mistakes: ProgressList<MistakeGroup>;
      words: ProgressList<NewWordItem>;
      // INFO: today is the day of the newest page, in the device's zone, as the API read it.
      notes: ProgressList<NoteListItem> & { today: string };
    };

type MoreLoaded =
  | { type: "more_loaded"; section: "history"; offset: number; outcome: DataOutcome<HistoryPage> }
  | { type: "more_loaded"; section: "mistakes"; offset: number; outcome: DataOutcome<MistakePage> }
  | { type: "more_loaded"; section: "words"; offset: number; outcome: DataOutcome<WordPage> }
  | { type: "more_loaded"; section: "notes"; offset: number; outcome: DataOutcome<NotePage> };

export type ProgressEvent =
  | { type: "load_started" }
  | {
      type: "loaded";
      month: DataOutcome<MonthProgress>;
      history: DataOutcome<HistoryPage>;
      mistakes: DataOutcome<MistakePage>;
      words: DataOutcome<WordPage>;
      notes: DataOutcome<NotePage>;
    }
  | { type: "more_started"; section: ProgressSection }
  | MoreLoaded;

export const initialProgress: ProgressState = { kind: "loading" };

function firstList<T>(page: { items: T[]; nextOffset: number | null }): ProgressList<T> {
  return { items: page.items, nextOffset: page.nextOffset, loadingMore: false, moreFailure: null };
}

export function progressFromReads(
  month: DataOutcome<MonthProgress>,
  history: DataOutcome<HistoryPage>,
  mistakes: DataOutcome<MistakePage>,
  words: DataOutcome<WordPage>,
  notes: DataOutcome<NotePage>,
): ProgressState {
  if (!month.ok) return { kind: "failed", failure: month.failure };
  if (!history.ok) return { kind: "failed", failure: history.failure };
  if (!mistakes.ok) return { kind: "failed", failure: mistakes.failure };
  if (!words.ok) return { kind: "failed", failure: words.failure };
  if (!notes.ok) return { kind: "failed", failure: notes.failure };
  return {
    kind: "ready",
    month: month.value,
    history: firstList(history.value),
    mistakes: firstList(mistakes.value),
    words: firstList(words.value),
    notes: { ...firstList(notes.value), today: notes.value.today },
  };
}

function startMore<L extends ProgressList<unknown>>(list: L): L {
  return { ...list, loadingMore: true, moreFailure: null };
}

// INFO: a page whose offset is not the list's next offset is stale (the list was reloaded
// after it was asked for) and is dropped. Offset pages can shift when a chat ends between two
// reads, so items already in the list are skipped by key.
function appendPage<T>(
  list: ProgressList<T>,
  offset: number,
  outcome: DataOutcome<{ items: T[]; nextOffset: number | null }>,
  keyOf: (item: T) => string | null,
): ProgressList<T> {
  if (offset !== list.nextOffset) return list;
  if (!outcome.ok) return { ...list, loadingMore: false, moreFailure: outcome.failure };
  const seen = new Set(list.items.map(keyOf));
  const added = outcome.value.items.filter((item) => !seen.has(keyOf(item)));
  return {
    items: [...list.items, ...added],
    nextOffset: outcome.value.nextOffset,
    loadingMore: false,
    moreFailure: null,
  };
}

const historyKey = (item: HistoryItem) => item.session.id;
const mistakeKey = (group: MistakeGroup) => group.rule?.toLowerCase() ?? null;
const wordKey = (item: NewWordItem) => item.word.toLowerCase();
const noteKey = (item: NoteListItem) => item.id;

function loadMore(state: ProgressState, event: MoreLoaded): ProgressState {
  if (state.kind !== "ready") return state;
  switch (event.section) {
    case "history":
      return {
        ...state,
        history: appendPage(state.history, event.offset, event.outcome, historyKey),
      };
    case "mistakes":
      return {
        ...state,
        mistakes: appendPage(state.mistakes, event.offset, event.outcome, mistakeKey),
      };
    case "words":
      return { ...state, words: appendPage(state.words, event.offset, event.outcome, wordKey) };
    case "notes": {
      const page = appendPage(state.notes, event.offset, event.outcome, noteKey);
      // INFO: a page that was read later knows a later today.
      const today =
        event.outcome.ok && event.offset === state.notes.nextOffset
          ? event.outcome.value.today
          : state.notes.today;
      return { ...state, notes: { ...page, today } };
    }
  }
}

export function progressReducer(state: ProgressState, event: ProgressEvent): ProgressState {
  switch (event.type) {
    case "load_started":
      return initialProgress;
    case "loaded":
      return progressFromReads(
        event.month,
        event.history,
        event.mistakes,
        event.words,
        event.notes,
      );
    case "more_started":
      if (state.kind !== "ready") return state;
      switch (event.section) {
        case "history":
          return { ...state, history: startMore(state.history) };
        case "mistakes":
          return { ...state, mistakes: startMore(state.mistakes) };
        case "words":
          return { ...state, words: startMore(state.words) };
        case "notes":
          return { ...state, notes: startMore(state.notes) };
      }
    case "more_loaded":
      return loadMore(state, event);
  }
}

// INFO: "auto" is the end of the list reached, which must not repeat a page that just failed;
// "retry" is the user pressing Try again.
export function nextPageOffset(
  state: ProgressState,
  section: ProgressSection,
  mode: "auto" | "retry",
): number | null {
  if (state.kind !== "ready") return null;
  const list = state[section];
  if (list.loadingMore) return null;
  if (list.moreFailure !== null && mode === "auto") return null;
  return list.nextOffset;
}

export function monthTiles(month: MonthProgress): { label: string; value: string }[] {
  return [
    { label: "Sessions", value: String(month.sessions) },
    { label: "Corrections", value: String(month.corrections) },
    { label: "New words", value: String(month.newWords) },
  ];
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function historyLine(messageCount: number, correctionCount: number): string {
  return `${plural(messageCount, "message", "messages")} · ${plural(correctionCount, "correction", "corrections")}`;
}

export function timesLabel(times: number): string {
  return plural(times, "time", "times");
}

const OTHER_RULE = "Other";

export type ProgressRow =
  | {
      kind: "history";
      key: string;
      id: string;
      title: string;
      date: string;
      line: string;
      icon: IconName;
    }
  | {
      kind: "mistake";
      key: string;
      rule: string;
      times: string;
      original: string;
      corrected: string;
    }
  | { kind: "word"; key: string; word: string; sentence: string; date: string }
  | {
      kind: "note";
      key: string;
      id: string;
      title: string;
      subtitle: string;
      date: string;
      icon: IconName;
    };

export function progressRows(state: ProgressState, section: ProgressSection): ProgressRow[] {
  if (state.kind !== "ready") return [];
  switch (section) {
    case "history":
      return state.history.items.map((item) => ({
        kind: "history",
        key: historyKey(item),
        id: item.session.id,
        title: item.session.title,
        date: shortDate(item.day),
        line: historyLine(item.messageCount, item.correctionCount),
        icon: sessionIcon(item.session.topicId),
      }));
    case "mistakes":
      return state.mistakes.items.map((group) => ({
        kind: "mistake",
        key: group.rule === null ? "other" : `rule:${mistakeKey(group)}`,
        rule: group.rule ?? OTHER_RULE,
        times: timesLabel(group.times),
        original: group.latest.original,
        corrected: group.latest.corrected,
      }));
    case "words":
      return state.words.items.map((item) => ({
        kind: "word",
        key: wordKey(item),
        word: item.word,
        sentence: `"${item.sentence.replace(/\s+/g, " ").trim()}"`,
        date: shortDate(item.day),
      }));
    case "notes":
      return state.notes.items.map((item) => ({
        kind: "note",
        key: noteKey(item),
        id: item.id,
        title: item.title,
        subtitle: noteSubtitle(item.kind, item.topic),
        date: noteDate(item.day, state.notes.today),
        icon: noteIcon(item.kind),
      }));
  }
}

const EMPTY_TEXTS: Record<ProgressSection, string> = {
  history: "No finished chats yet.",
  mistakes: "No mistakes yet.",
  words: "No new words yet.",
  notes: "No notes yet.",
};

export function emptyText(section: ProgressSection): string {
  return EMPTY_TEXTS[section];
}
