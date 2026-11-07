import { router, useIsFocused } from "expo-router";
import { useEffect, useRef, useState, type RefObject } from "react";

import { ai } from "@/ai";
import { data } from "@/data";
import { keys } from "@/keys";
import type { DataFailure } from "@/data/data-port";
import { contextRefresh } from "@/utils/chat-state";
import { deviceLanguage } from "@/utils/device-language";
import type { PracticeOrigin } from "@/utils/practice-focus";
import {
  practiceReducer,
  practiceStep,
  type PracticeEvent,
  type PracticeRunState,
  type PracticeWrite,
} from "@/utils/practice-run";
import {
  practiceNotFoundMessage,
  practiceRunView,
  type PracticeScreenView,
} from "@/utils/practice-run-state";
import { deviceTimeZone } from "@/utils/time-zone";

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
    language,
  };
  if (!key.ok || !key.value || !profile.ok || origin === null) return practiceRunView(first);
  const timeZone = deviceTimeZone();
  const [spend, opened] = await Promise.all([
    data.getMonthSpend(timeZone),
    origin.kind === "resume" ? data.openPracticeRun(origin.runId) : Promise.resolve(null),
  ]);
  const focus =
    origin.kind === "new"
      ? origin.input.focus
      : opened !== null && opened.ok
        ? opened.value.run.focus
        : null;
  const [mistakes, words] = await Promise.all([
    focus === "mistakes" ? data.listMistakes(0) : Promise.resolve(null),
    focus === "words" ? data.listWords(timeZone, 0) : Promise.resolve(null),
  ]);
  return practiceRunView({ ...first, spend, opened, mistakes, words });
}

type Dispatch = (event: PracticeEvent) => void;

async function save(
  state: PracticeRunState,
  write: PracticeWrite,
  dispatch: Dispatch,
): Promise<boolean> {
  const runId = state.run === null ? "" : state.run.id;
  const failed = (failure: DataFailure) => {
    dispatch({ type: "write_failed", failure: { source: "data", failure } });
    return false;
  };
  if (write.kind === "create") {
    const saved = await data.createPracticeRun(write.input);
    if (!saved.ok) return failed(saved.failure);
    dispatch({ type: "write_done", run: saved.value });
  } else if (write.kind === "items") {
    const saved = await data.addPracticeItems(runId, write.items);
    if (!saved.ok) return failed(saved.failure);
    dispatch({ type: "write_done", items: saved.value });
  } else if (write.kind === "usage") {
    const saved = await data.addPracticeUsage(runId, write.usage);
    if (!saved.ok) return failed(saved.failure);
    dispatch({ type: "write_done" });
  } else if (write.kind === "answer") {
    const saved = await data.answerPracticeItem(write.itemId, write.answer);
    if (!saved.ok) return failed(saved.failure);
    dispatch({ type: "write_done" });
  } else if (write.kind === "target") {
    const saved = await data.setPracticeTarget(runId, write.target);
    if (!saved.ok) return failed(saved.failure);
    dispatch({ type: "write_done", run: saved.value });
  } else {
    const saved = await data.finishPracticeRun(runId);
    if (!saved.ok) return failed(saved.failure);
    dispatch({ type: "write_done", run: saved.value });
  }
  return true;
}

// INFO: one chain at a time (running): two chains would both take the first write. A billed AI
// failure goes on to save its usage; any other failure stops the chain.
async function drive(
  current: RefObject<PracticeRunState | null>,
  running: RefObject<boolean>,
  dispatch: Dispatch,
): Promise<void> {
  if (running.current) return;
  running.current = true;
  try {
    for (;;) {
      const state = current.current;
      if (state === null) return;
      const step = practiceStep(state);
      if (step.kind === "none") return;
      if (step.kind === "write") {
        if (!(await save(state, step.write, dispatch))) return;
      } else if (step.kind === "round") {
        const answer = await ai.practiceRound(step.request);
        if (!answer.ok) {
          dispatch({
            type: "round_failed",
            failure: { source: "ai", failure: answer.failure, cause: answer.cause },
            usage: answer.usage,
          });
          if (answer.usage === undefined) return;
          continue;
        }
        dispatch({ type: "round_received", round: answer.value });
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
  } finally {
    running.current = false;
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
  // state. A chain that ends after the screen unmounts dispatches into a view nobody reads, which
  // is harmless, and its writes still complete, so the cost of a paid call is never lost.
  const current = useRef<PracticeRunState | null>(null);
  const running = useRef(false);

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

  async function retry(): Promise<void> {
    const state = current.current;
    if (state === null) {
      setView({ kind: "loading" });
      show(await readRun(fixed));
      await run();
      return;
    }
    // INFO: the reducer puts the run back on the step to take: the round or the answer is sent again
    // after an AI failure, and the writes left resume after a failed save.
    dispatch({ type: "retry" });
    await run();
  }

  return {
    view,
    setDraft: (text) => dispatch({ type: "draft_changed", text }),
    pick,
    check,
    next,
    keepGoing,
    finish,
    stop: () => router.dismissTo("/"),
    retry,
    updateKey: () => router.push("/api-key"),
  };
}
