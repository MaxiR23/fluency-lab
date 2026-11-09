import { router, useIsFocused } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { ai } from "@/ai";
import { data } from "@/data";
import { keys } from "@/keys";
import { sendState } from "@/utils/chat-conversation";
import { contextRefresh } from "@/utils/chat-state";
import { hasText } from "@/utils/has-text";
import {
  threadNextStep,
  threadReducer,
  threadRetryKind,
  type ThreadConversation,
  type ThreadEvent,
} from "@/utils/thread-conversation";
import { threadNotFoundMessage, threadView, type ThreadScreenView } from "@/utils/thread-state";
import { deviceTimeZone } from "@/utils/time-zone";
import { retryStarted } from "@/utils/load-failure";

async function readThread(messageId: string): Promise<ThreadScreenView> {
  const [key, profile] = await Promise.all([keys.hasApiKey(), data.getProfile()]);
  if (!key.ok || !key.value || !profile.ok) {
    return threadView({ key, profile, spend: null, thread: null });
  }
  const [spend, thread] = await Promise.all([
    data.getMonthSpend(deviceTimeZone()),
    data.openThread(messageId),
  ]);
  return threadView({ key, profile, spend, thread });
}

export function useThread(messageId: string | null): {
  view: ThreadScreenView;
  setDraft: (text: string) => void;
  send: () => Promise<void>;
  sendQuick: (text: string) => Promise<void>;
  retry: () => Promise<void>;
  updateKey: () => void;
} {
  const [view, setView] = useState<ThreadScreenView>(
    messageId === null ? { kind: "failed", message: threadNotFoundMessage } : { kind: "loading" },
  );
  const focused = useIsFocused();
  // INFO: the thread lives in this ref as well as in view, so a chain of steps always reads the
  // latest state, draft included. A chain that ends after the screen unmounts dispatches into a
  // view nobody reads, which is harmless, and its writes still complete, so the cost of a paid
  // reply is never lost.
  const current = useRef<ThreadConversation | null>(null);

  function show(next: ThreadScreenView): void {
    current.current = next.kind === "ready" ? next.conversation : null;
    setView(next);
  }

  function dispatch(event: ThreadEvent): void {
    if (current.current === null) return;
    const next = threadReducer(current.current, event);
    current.current = next;
    setView({ kind: "ready", conversation: next });
  }

  // INFO: read on every focus. A ready thread only re-reads its context, so the draft and the
  // messages survive the key step; any other view reads everything again.
  useEffect(() => {
    if (!focused || messageId === null) return;
    let live = true;
    if (current.current === null) {
      void readThread(messageId).then((next) => {
        // INFO: a read that ends after the screen unmounts is dropped.
        if (live) show(next);
      });
    } else {
      void (async () => {
        const [key, profile, spend] = await Promise.all([
          keys.hasApiKey(),
          data.getProfile(),
          data.getMonthSpend(deviceTimeZone()),
        ]);
        if (!live) return;
        const refresh = contextRefresh({ key, profile, spend });
        if (refresh.kind === "no_key") show({ kind: "no_key" });
        else dispatch(refresh.event);
      })();
    }
    return () => {
      live = false;
    };
  }, [focused, messageId]);

  async function run(): Promise<void> {
    for (;;) {
      const thread = current.current;
      if (thread === null) return;
      const step = threadNextStep(thread);
      if (step.kind === "none") return;
      if (step.kind === "write") {
        const { write } = step;
        if (write.kind === "message") {
          const saved = await data.addThreadMessage(thread.message.id, write.input);
          if (!saved.ok) {
            dispatch({ type: "write_failed", failure: { source: "data", failure: saved.failure } });
            return;
          }
          dispatch({ type: "write_done", savedId: saved.value.id });
        } else if (write.kind === "withdraw") {
          const saved = await data.withdrawCorrections(thread.message.id, write.items);
          if (!saved.ok) {
            dispatch({ type: "write_failed", failure: { source: "data", failure: saved.failure } });
            return;
          }
          dispatch({ type: "write_done", corrections: saved.value.corrections?.items ?? [] });
        } else {
          const saved = await data.addUsage(thread.session.id, write.usage);
          if (!saved.ok) {
            dispatch({ type: "write_failed", failure: { source: "data", failure: saved.failure } });
            return;
          }
          dispatch({ type: "write_done" });
        }
      } else {
        const answer = await ai.replyInThread(step.request);
        if (!answer.ok) {
          dispatch({
            type: "reply_failed",
            failure: { source: "ai", failure: answer.failure, cause: answer.cause },
            usage: answer.usage,
          });
          // INFO: a billed failure goes on to save its usage; any other stops here.
          if (answer.usage === undefined) return;
          continue;
        }
        dispatch({ type: "reply_received", reply: answer.value });
      }
    }
  }

  async function ask(text: string | undefined): Promise<void> {
    const thread = current.current;
    if (thread === null || thread.phase !== "idle" || sendState(thread).locked) return;
    if (text === undefined && !hasText(thread.draft)) return;
    dispatch({ type: "send_started", text });
    await run();
  }

  async function retry(): Promise<void> {
    const thread = current.current;
    if (thread === null) {
      if (messageId === null) return;
      setView((current) => retryStarted<ThreadScreenView>(current, { kind: "loading" }));
      show(await readThread(messageId));
      return;
    }
    if (thread.phase !== "idle") return;
    const kind = threadRetryKind(thread);
    dispatch({ type: "retry" });
    if (kind === "resend") {
      if (hasText(thread.draft)) await ask(undefined);
    } else await run();
  }

  return {
    view,
    setDraft: (text) => dispatch({ type: "draft_changed", text }),
    send: () => ask(undefined),
    sendQuick: (text) => ask(text),
    retry,
    updateKey: () => router.push("/api-key"),
  };
}
