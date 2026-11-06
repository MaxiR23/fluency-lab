import { router, useIsFocused } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { ai } from "@/ai";
import { data } from "@/data";
import { keys } from "@/keys";
import {
  busy,
  conversationReducer,
  nextStep,
  retryKind,
  sendState,
  type Conversation,
  type ConversationEvent,
} from "@/utils/chat-conversation";
import type { ChatOrigin } from "@/utils/chat-opening";
import { chatView, contextRefresh, type ChatView } from "@/utils/chat-state";
import { hasText } from "@/utils/has-text";
import { deviceTimeZone } from "@/utils/time-zone";

async function readChat(origin: ChatOrigin): Promise<ChatView> {
  const [key, profile] = await Promise.all([keys.hasApiKey(), data.getProfile()]);
  if (!key.ok || !key.value || !profile.ok) {
    return chatView({ key, profile, spend: null, origin, opened: null });
  }
  const [spend, opened] = await Promise.all([
    data.getMonthSpend(deviceTimeZone()),
    origin.kind === "resume" ? data.openSession(origin.sessionId) : null,
  ]);
  return chatView({ key, profile, spend, origin, opened });
}

export function useChat(chatOrigin: ChatOrigin): {
  view: ChatView;
  setDraft: (text: string) => void;
  send: () => Promise<void>;
  retry: () => Promise<void>;
  end: () => Promise<void>;
  updateKey: () => void;
} {
  const [view, setView] = useState<ChatView>({ kind: "loading" });
  // INFO: the origin is fixed for the life of the screen: a new chat is a new screen.
  const [origin] = useState(chatOrigin);
  const focused = useIsFocused();
  // INFO: the conversation lives in this ref as well as in view, so a chain of
  // steps always reads the latest state, draft included. A chain that ends after
  // Chat unmounts dispatches into a view nobody reads, which is harmless, and its
  // writes still complete, so the cost and messages of a paid reply are never lost.
  const current = useRef<Conversation | null>(null);

  function show(next: ChatView): void {
    current.current = next.kind === "ready" ? next.conversation : null;
    setView(next);
  }

  function dispatch(event: ConversationEvent): void {
    if (current.current === null) return;
    const next = conversationReducer(current.current, event);
    current.current = next;
    setView({ kind: "ready", conversation: next });
  }

  // INFO: read on every focus. A ready chat only re-reads its context, so the draft and the
  // messages survive the key step; any other view reads everything again.
  useEffect(() => {
    if (!focused) return;
    let live = true;
    if (current.current === null) {
      void readChat(origin).then((next) => {
        // INFO: a read that ends after Chat unmounts is dropped.
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
  }, [focused, origin]);

  async function run(): Promise<void> {
    for (;;) {
      const conversation = current.current;
      if (conversation === null) return;
      const step = nextStep(conversation);
      if (step.kind === "none") return;
      if (step.kind === "create") {
        const created = await data.createSession(step.body);
        if (!created.ok) {
          dispatch({
            type: "create_failed",
            failure: { source: "data", failure: created.failure },
          });
          return;
        }
        dispatch({ type: "session_created", session: created.value });
      } else if (step.kind === "write") {
        const session = conversation.session;
        if (session === null) return;
        const saved =
          step.write.kind === "message"
            ? await data.addMessage(session.id, step.write.input)
            : await data.addUsage(session.id, step.write.usage);
        if (!saved.ok) {
          dispatch({ type: "write_failed", failure: { source: "data", failure: saved.failure } });
          return;
        }
        dispatch({ type: "write_done" });
      } else {
        const answer = await ai.reply(step.request);
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

  async function send(): Promise<void> {
    const conversation = current.current;
    if (conversation === null || busy(conversation) || sendState(conversation).locked) return;
    if (!hasText(conversation.draft) && conversation.pending === null) return;
    dispatch({ type: "send_started" });
    await run();
  }

  async function end(): Promise<void> {
    const conversation = current.current;
    if (conversation === null || busy(conversation)) return;
    if (conversation.session === null) {
      router.dismissTo("/");
      return;
    }
    // INFO: writes left from a failed save go first, so a paid reply's cost is not dropped;
    // if they fail again the session stays open with them queued.
    if (conversation.writes.length > 0) {
      dispatch({ type: "flush_started" });
      await run();
      if ((current.current?.writes.length ?? 0) > 0) return;
    }
    dispatch({ type: "end_started" });
    const ended = await data.endSession(conversation.session.id);
    if (!ended.ok) {
      dispatch({ type: "end_failed", failure: { source: "data", failure: ended.failure } });
      return;
    }
    router.dismissTo("/");
  }

  async function retry(): Promise<void> {
    const conversation = current.current;
    if (conversation === null) {
      setView({ kind: "loading" });
      show(await readChat(origin));
      return;
    }
    if (busy(conversation)) return;
    const kind = retryKind(conversation);
    dispatch({ type: "retry" });
    if (kind === "end") await end();
    else if (kind === "resend") {
      if (hasText(conversation.draft)) await send();
    } else await run();
  }

  return {
    view,
    setDraft: (text) => dispatch({ type: "draft_changed", text }),
    send,
    retry,
    end,
    updateKey: () => router.push("/api-key"),
  };
}
