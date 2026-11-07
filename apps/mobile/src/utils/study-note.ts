import type { StudyNoteDraft, StudyNotePayload } from "@fluency-lab/shared";

import { cap } from "@/utils/tutor-reply";

const MAX_TITLE = 80;
const MAX_TOPIC = 80;
const MAX_LABEL = 40;
const MAX_CELL = 120;
const MAX_POINT = 200;
const MAX_REMEMBER = 300;
const MAX_ROWS = 8;
const MAX_POINTS = 8;
const COLUMNS = 3;

function filled(cells: readonly string[], max: number): string[] | null {
  const capped = cells.map((cell) => cap(cell, max));
  return capped.every((cell) => cell !== "") ? capped : null;
}

function tableOf(
  payload: StudyNotePayload,
): { columns: [string, string, string]; rows: [string, string, string][] } | null {
  const columns = filled(payload.columns, MAX_LABEL);
  if (columns === null) return null;
  const [first, second, third, ...extra] = columns;
  if (first === undefined || second === undefined || third === undefined || extra.length > 0) {
    return null;
  }
  const rows: [string, string, string][] = [];
  for (const raw of payload.rows) {
    const cells = filled(raw, MAX_CELL);
    if (cells === null || cells.length !== COLUMNS) continue;
    const [a, b, c] = cells;
    if (a === undefined || b === undefined || c === undefined) continue;
    rows.push([a, b, c]);
  }
  return rows.length === 0
    ? null
    : { columns: [first, second, third], rows: rows.slice(0, MAX_ROWS) };
}

// INFO: what the tutor returns is shaped here so it always passes
// studyNoteCreateSchema on save: a note that was paid for is never lost to a 400.
// Null means the note cannot be used.
export function toStudyNote(payload: StudyNotePayload): StudyNoteDraft | null {
  const kind = payload.kind.trim().toLowerCase();
  const title = cap(payload.title, MAX_TITLE);
  const topic = cap(payload.topic, MAX_TOPIC);
  const remember = cap(payload.remember, MAX_REMEMBER);
  if (title === "" || topic === "" || remember === "") return null;
  if (kind === "table") {
    const table = tableOf(payload);
    return table === null ? null : { kind, title, topic, content: { ...table, remember } };
  }
  if (kind === "summary") {
    const points = payload.points
      .map((point) => cap(point, MAX_POINT))
      .filter((point) => point !== "")
      .slice(0, MAX_POINTS);
    return points.length === 0 ? null : { kind, title, topic, content: { points, remember } };
  }
  return null;
}
