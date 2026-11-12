import { PRACTICE_AVOID_DAYS, PRACTICE_AVOID_LIMIT, type StudyNote } from "@fluency-lab/shared";
import { router, useIsFocused } from "expo-router";
import { useEffect, useRef, useState, type RefObject } from "react";

import { ai } from "@/ai";
import { data } from "@/data";
import { keys } from "@/keys";
import type { DataFailure, DataOutcome } from "@/data/data-port";
import { contextRefresh } from "@/utils/chat-state";
import { deviceLanguage } from "@/utils/device-language";
import type { PracticeOrigin } from "@/utils/practice-focus";
import {
  practiceReducer,
  practiceStep,
  type PracticeEvent,
  type PracticeRunState,
  type PracticeWrite,
  type WriteLane,
} from "@/utils/practice-run";
import {
  practiceNotFoundMessage,
  practiceRunView,
  type PracticeScreenView,
} from "@/utils/practice-run-state";
import { deviceTimeZone } from "@/utils/time-zone";
import { retryStarted } from "@/utils/load-failure";

async function readRun(origin: PracticeOrigin | null): Promise<PracticeScreenView> {
  const language = deviceLanguage();
  const [key, profile] = await Promise.all([keys.hasApiKey(), data.getProfile()]);
  const first = {
    key,
    profile,
    spend: null,
    origin,
    opened: null,
    mistakes: null,
    words: null,
    note: null,
    recent: null,
    language,
  };
  if (!key.ok || !key.value || !profile.ok || origin === null) return practiceRunView(first);
  const timeZone = deviceTimeZone();
  const [spend, opened, recent] = await Promise.all([
    data.getMonthSpend(timeZone),
    origin.kind === "resume" ? data.openPracticeRun(origin.runId) : Promise.resolve(null),
    data.listRecentPrompts(PRACTICE_AVOID_DAYS, PRACTICE_AVOID_LIMIT),
  ]);
  const focus =
    origin.kind === "new"
      ? origin.input.focus
      : opened !== null && opened.ok
        ? opened.value.run.focus
        : null;
  // INFO: the note of a resumed run is null once its note was deleted, which the view turns into a failure.
  const noteId =
    origin.kind === "new"
      ? origin.input.focus === "note"
        ? origin.input.noteId
        : null
      : opened !== null && opened.ok
        ? opened.value.run.noteId
        : null;
  const [mistakes, words, note] = await Promise.all([
    focus === "mistakes" ? data.listMistakes(0) : Promise.resolve(null),
    focus === "words" ? data.listWords(timeZone, 0) : Promise.resolve(null),
    focus !== "note"
      ? Promise.resolve(null)
      : noteId === null
        ? Promise.resolve<DataOutcome<StudyNote>>({ ok: false, failure: "not_found" })
        : data.getNote(noteId),
  ]);
  return practiceRunView({ ...first, spend, opened, mistakes, words, note, recent });
}

type Dispatch = (event: PracticeEvent) => void;

async function save(
  state: PracticeRunState,
  write: PracticeWrite,
  lane: WriteLane,
  dispatch: Dispatch,
): Promise<boolean> {
  const runId = state.run === null ? "" : state.run.id;
  const failed = (failure: DataFailure) => {
    dispatch({ type: "write_failed", failure: { source: "data", failure }, lane });
    return false;
  };
  if (write.kind === "create") {
    const saved = await data.createPracticeRun(write.input);
    if (!saved.ok) return failed(saved.failure);
    dispatch({ type: "write_done", lane, run: saved.value });
  } else if (write.kind === "items") {
    const saved = await data.addPracticeItems(runId, write.items);
    if (!saved.ok) return failed(saved.failure);
    dispatch({ type: "write_done", lane, items: saved.value });
  } else if (write.kind === "usage") {
    const saved = await data.addPracticeUsage(runId, write.usage);
    if (!saved.ok) return failed(saved.failure);
    dispatch({ type: "write_done", lane });
  } else if (write.kind === "note") {
    const saved = await data.createNote(write.input);
    if (!saved.ok) return failed(saved.failure);
    dispatch({ type: "write_done", lane, noteId: saved.value.id });
  } else if (write.kind === "answer") {
    const saved = await data.answerPracticeItem(write.itemId, write.answer);
    if (!saved.ok) return failed(saved.failure);
    dispatch({ type: "write_done", lane });
  } else if (write.kind === "target") {
    const saved = await data.setPracticeTarget(runId, write.target);
    if (!saved.ok) return failed(saved.failure);
    dispatch({ type: "write_done", lane, run: saved.value });
  } else {
    const saved = await data.finishPracticeRun(runId);
    if (!saved.ok) return failed(saved.failure);
    dispatch({ type: "write_done", lane, run: saved.value });
  }
  return true;
}

// INFO: one chain at a time (running): two chains would both take the first write. A caller that
// finds a chain in flight awaits it, and that chain takes the caller's step too, so a pick during
// a background call is saved by the same chain. A failed save stops the chain; an AI failure of
// the slot goes on, because the reducer decides whether another step is left (a held failure
// leaves none). A billed failure of the grader or the note goes on to save its usage.
function drive(
  current: RefObject<PracticeRunState | null>,
  running: RefObject<Promise<void> | null>,
  dispatch: Dispatch,
): Promise<void> {
  if (running.current !== null) return running.current;
  const chain = runChain(current, dispatch);
  running.current = chain;
  const clear = () => {
    if (running.current === chain) running.current = null;
  };
  void chain.then(clear, clear);
  return chain;
}

async function runChain(
  current: RefObject<PracticeRunState | null>,
  dispatch: Dispatch,
): Promise<void> {
  for (;;) {
    const state = current.current;
    if (state === null) return;
    const step = practiceStep(state);
    if (step.kind === "none") return;
    if (step.kind === "write") {
      if (!(await save(state, step.write, step.lane, dispatch))) return;
    } else if (step.kind === "checks") {
      const runId = state.run === null ? "" : state.run.id;
      const saved = await data.addPracticeChecks(runId, step.checks);
      dispatch(
        saved.ok ? { type: "checks_saved", count: step.checks.length } : { type: "checks_failed" },
      );
    } else if (step.kind === "exercise") {
      const answer = await ai.practiceExercise(step.request);
      dispatch(
        answer.ok
          ? { type: "exercise_written", draft: answer.value }
          : {
              type: "exercise_failed",
              failure: { source: "ai", failure: answer.failure, cause: answer.cause },
              usage: answer.usage,
            },
      );
    } else if (step.kind === "solve") {
      const answer = await ai.solveExercise(step.request);
      dispatch(
        answer.ok
          ? { type: "exercise_solved", solution: answer.value }
          : {
              type: "solve_failed",
              failure: { source: "ai", failure: answer.failure, cause: answer.cause },
              usage: answer.usage,
            },
      );
    } else if (step.kind === "review") {
      const answer = await ai.reviewExercise(step.request);
      dispatch(
        answer.ok
          ? { type: "exercise_reviewed", review: answer.value }
          : {
              type: "review_failed",
              failure: { source: "ai", failure: answer.failure, cause: answer.cause },
              usage: answer.usage,
            },
      );
    } else if (step.kind === "note") {
      const answer = await ai.studyNote(step.request);
      if (!answer.ok) {
        dispatch({
          type: "note_failed",
          failure: { source: "ai", failure: answer.failure, cause: answer.cause },
          usage: answer.usage,
        });
        if (answer.usage === undefined) return;
        continue;
      }
      dispatch({ type: "note_received", note: answer.value });
    } else {
      const answer = await ai.gradeAnswer(step.request);
      if (!answer.ok) {
        dispatch({
          type: "grade_failed",
          failure: { source: "ai", failure: answer.failure, cause: answer.cause },
          usage: answer.usage,
        });
        if (answer.usage === undefined) return;
        continue;
      }
      dispatch({ type: "grade_received", grade: answer.value });
    }
  }
}

export function usePracticeRun(origin: PracticeOrigin | null): {
  view: PracticeScreenView;
  setDraft: (text: string) => void;
  pick: (option: string) => Promise<void>;
  check: () => Promise<void>;
  next: () => Promise<void>;
  keepGoing: () => Promise<void>;
  finish: () => Promise<void>;
  makeNote: () => Promise<void>;
  stop: () => void;
  retry: () => Promise<void>;
  updateKey: () => void;
} {
  // INFO: the origin is fixed for the life of the screen: a new practice is a new screen.
  const [fixed] = useState(origin);
  const [view, setView] = useState<PracticeScreenView>(
    fixed === null ? { kind: "failed", message: practiceNotFoundMessage } : { kind: "loading" },
  );
  const focused = useIsFocused();
  // INFO: the run lives in this ref as well as in view, so a chain of steps always reads the latest
  // state. Leaving the screen (Stop practice or unmount) marks the run stopped: the call in flight
  // finishes and its writes complete, so the cost of a paid call is never lost, but the chain
  // schedules no new slot and starts no new AI call. A chain that ends after the screen unmounts
  // dispatches into a view nobody reads, which is harmless.
  const current = useRef<PracticeRunState | null>(null);
  const running = useRef<Promise<void> | null>(null);

  function show(next: PracticeScreenView): void {
    current.current = next.kind === "ready" ? next.run : null;
    setView(next);
  }

  function dispatch(event: PracticeEvent): void {
    if (current.current === null) return;
    const next = practiceReducer(current.current, event);
    current.current = next;
    setView({ kind: "ready", run: next });
  }

  // INFO: read on every focus. A ready run only re-reads its context, so the exercise and the
  // draft survive the key step; any other view reads everything again. A fixed key or a raised
  // limit lets a stalled ask go on.
  useEffect(() => {
    if (!focused) return;
    let live = true;
    if (current.current === null) {
      void (async () => {
        const next = await readRun(fixed);
        // INFO: a read that ends after the screen unmounts is dropped.
        if (!live) return;
        show(next);
        await drive(current, running, dispatch);
      })();
    } else {
      void (async () => {
        const [key, profile, spend] = await Promise.all([
          keys.hasApiKey(),
          data.getProfile(),
          data.getMonthSpend(deviceTimeZone()),
        ]);
        if (!live) return;
        const refresh = contextRefresh({ key, profile, spend });
        if (refresh.kind === "no_key") {
          show({ kind: "no_key" });
          return;
        }
        dispatch(refresh.event);
        await drive(current, running, dispatch);
      })();
    }
    return () => {
      live = false;
    };
  }, [focused, fixed]);

  const run = () => drive(current, running, dispatch);

  // INFO: the cleanup runs when the screen unmounts; no deps, so it never runs on a re-render.
  useEffect(() => {
    return () => dispatch({ type: "left" });
  }, []);

  async function pick(option: string): Promise<void> {
    dispatch({ type: "picked", option });
    await run();
  }

  async function check(): Promise<void> {
    dispatch({ type: "check_started" });
    await run();
  }

  async function next(): Promise<void> {
    dispatch({ type: "continue" });
    await run();
  }

  async function keepGoing(): Promise<void> {
    dispatch({ type: "keep_going" });
    await run();
  }

  async function finish(): Promise<void> {
    dispatch({ type: "finish_requested" });
    await run();
    // INFO: a finish that could not be saved keeps the learner here, with the failure and Try again.
    if (current.current !== null && current.current.failure !== null) return;
    router.dismissTo("/");
  }

  // INFO: the run screen stays mounted under the note, so going back shows the same miss sheet.
  // The note opens from the effect below, because the chain that saves it may be a background one.
  function openSavedNote(): void {
    const id = current.current?.openNote ?? null;
    if (id === null) return;
    dispatch({ type: "note_opened" });
    router.push({ pathname: "/note", params: { id } });
  }

  async function makeNote(): Promise<void> {
    dispatch({ type: "note_requested" });
    await run();
  }

  async function retry(): Promise<void> {
    const state = current.current;
    if (state === null) {
      setView((current) => retryStarted<PracticeScreenView>(current, { kind: "loading" }));
      show(await readRun(fixed));
      await run();
      return;
    }
    // INFO: the reducer puts the run back on the step to take: the call or the answer is sent again
    // after an AI failure, and the writes left resume after a failed save.
    dispatch({ type: "retry" });
    await run();
  }

  // INFO: a note that was just saved opens as soon as the screen is focused, a note that failed
  // and was asked again included.
  const openNote = view.kind === "ready" ? view.run.openNote : null;
  useEffect(() => {
    if (focused && openNote !== null) openSavedNote();
  }, [focused, openNote]);

  return {
    view,
    setDraft: (text) => dispatch({ type: "draft_changed", text }),
    pick,
    check,
    next,
    keepGoing,
    finish,
    makeNote,
    stop: () => {
      dispatch({ type: "left" });
      router.dismissTo("/");
    },
    retry,
    updateKey: () => router.push("/api-key"),
  };
}
