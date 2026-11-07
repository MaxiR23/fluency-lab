import type {
  HistoryItem,
  MistakeGroup,
  NewWordItem,
  NoteListItem,
  Session,
} from "@fluency-lab/shared";
import { localDate } from "./week";

export const PAGE_SIZE = 20;

// INFO: the store reads one row over the page size; a row beyond the page means a next page.
export function pageOf<T>(
  rows: readonly T[],
  offset: number,
): { items: T[]; nextOffset: number | null } {
  return {
    items: rows.slice(0, PAGE_SIZE),
    nextOffset: rows.length > PAGE_SIZE ? offset + PAGE_SIZE : null,
  };
}

export function historyItem(
  row: { session: Session; messageCount: number; correctionCount: number },
  timeZone: string,
): HistoryItem {
  return {
    session: row.session,
    day: localDate(new Date(row.session.createdAt), timeZone),
    messageCount: row.messageCount,
    correctionCount: row.correctionCount,
  };
}

export function wordItem(
  row: { word: string; sentence: string; createdAt: string },
  timeZone: string,
): NewWordItem {
  return {
    word: row.word,
    sentence: row.sentence,
    day: localDate(new Date(row.createdAt), timeZone),
  };
}

export function noteItem(
  row: { id: string; kind: NoteListItem["kind"]; title: string; topic: string; createdAt: string },
  timeZone: string,
): NoteListItem {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    topic: row.topic,
    day: localDate(new Date(row.createdAt), timeZone),
  };
}

export function mistakeGroup(row: {
  rule: string | null;
  times: number;
  original: string;
  corrected: string;
}): MistakeGroup {
  return {
    rule: row.rule,
    times: row.times,
    latest: { original: row.original, corrected: row.corrected },
  };
}
