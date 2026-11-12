// Test helper (not a test file): the real data adapter and the real provider
// adapter over one recording fetch, for the key isolation test. Nothing leaves
// the process: the fetch answers the API paths and the provider endpoint with
// scripted bodies. The key is generated at run time and the adapter reads it
// through the fake key port, as src/ai/index.ts does.

import { PRACTICE_KINDS, TUTOR_MODEL } from "@fluency-lab/shared";

import { createClaudeAi } from "@/ai/claude-ai";
import { createHonoData } from "@/data/hono-data";
import { exerciseFor } from "./fake-ai";
import { fakeKeys } from "./fake-keys";
import { generatedSecret } from "./generated-secret";

export const apiKey = generatedSecret("api-key");

export type Recorded = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
};

export const recorded: Recorded[] = [];

const stamp = "2026-11-05T09:00:00Z";
const sessionBody = {
  id: "session-1",
  topicId: null,
  title: "Free chat",
  status: "active",
  summary: null,
  contextSummary: null,
  contextThroughId: null,
  titleSource: "default",
  costUsd: 0,
  createdAt: stamp,
  updatedAt: stamp,
};
const messageBody = {
  id: "message-1",
  sessionId: "session-1",
  role: "user",
  text: "x",
  corrections: null,
  newWords: null,
  replyToId: null,
  noteId: null,
  createdAt: stamp,
};

const threadMessageBody = {
  ...messageBody,
  corrections: {
    items: [{ original: "I never been", corrected: "I've never been", rule: "Present perfect" }],
    explanation: null,
  },
};
const threadRowBody = {
  id: "thread-row-1",
  messageId: "message-1",
  role: "user",
  text: "x",
  newWords: null,
  createdAt: stamp,
};

const reviewAllTrue = {
  singleAnswer: true,
  meaningKept: true,
  answerNotInPrompt: true,
  oneRealMistake: true,
  naturalEnglish: true,
  solverAnswerAccepted: true,
  passed: true,
  reason: "",
};

// INFO: the accepted answer of each exercise the writer was asked for, by prompt, for the solver.
const issued = new Map<string, string>();
let written = 0;

// INFO: the provider's answer to any practice call, told apart by the required keys of the
// schema in the request body: the writer, the blind solver, the reviewer, the grader or the
// study note. The writer answers an exercise of the kind in its request, each with its own prompt.
export function providerPracticeAnswer(body: string): Response {
  const sent = JSON.parse(body) as {
    output_config: { format: { schema: { required: string[] } } };
    messages: { content: string }[];
  };
  const required = sent.output_config.format.schema.required;
  const turn = JSON.parse(sent.messages[0]?.content ?? "{}") as { kind?: string; prompt?: string };
  if (required.includes("solverAnswerAccepted")) return providerBody(reviewAllTrue);
  if (required.includes("alreadyCorrect")) {
    return providerBody({ answer: issued.get(turn.prompt ?? "") ?? "", alreadyCorrect: false });
  }
  if (required.includes("flawed")) return providerGradeSuccess();
  if (required.includes("columns")) return providerNoteSuccess();
  if (required.includes("accepted")) {
    written += 1;
    const kind = PRACTICE_KINDS.find((entry) => entry === turn.kind) ?? "choose";
    const exercise = exerciseFor(kind, written);
    issued.set(exercise.prompt, exercise.accepted[0] ?? "");
    return providerBody(exercise);
  }
  return providerSuccess();
}

// INFO: the provider's answer to the grading of a typed answer.
export function providerGradeSuccess(): Response {
  return providerBody({ flawed: false, correct: false, explanation: "Use have." });
}

// INFO: the provider's answer to a study note request: a summary with two points.
export function providerNoteSuccess(): Response {
  return providerBody({
    kind: "summary",
    title: "Present perfect",
    topic: "Have + past participle",
    columns: [],
    rows: [],
    points: ["Use it for experiences up to now.", "Use it for recent news."],
    remember: "Think of now.",
  });
}

const storedNoteBody = {
  id: "note-1",
  sessionId: null,
  sessionTitle: null,
  kind: "summary",
  title: "Present perfect",
  topic: "Have + past participle",
  content: {
    points: ["Use it for experiences up to now.", "Use it for recent news."],
    remember: "Think of now.",
  },
  createdAt: stamp,
};

const practiceRunBody = {
  id: "run-1",
  focus: "mistakes",
  topicId: null,
  noteId: null,
  target: 5,
  costUsd: 0,
  createdAt: stamp,
  finishedAt: null,
};
type PostedItem = {
  position: number;
  kind: string;
  rule: string;
  prompt: string;
  options: string[] | null;
  accepted: string[];
  explanation: string;
  source: string | null;
};

const practiceItemBody = (posted: PostedItem) => ({
  ...posted,
  id: `item-${posted.position}`,
  runId: "run-1",
  userAnswer: null,
  correct: null,
  answeredAt: null,
});

// INFO: every item posted so far, by position, as the API answers a save: the whole run.
function savedItems() {
  const byPosition = new Map<number, PostedItem>();
  for (const entry of recorded) {
    if (entry.method !== "POST" || !entry.url.endsWith("/items")) continue;
    const sent = JSON.parse(entry.body) as { items: PostedItem[] };
    for (const posted of sent.items) byPosition.set(posted.position, posted);
  }
  return [...byPosition.values()].sort((a, b) => a.position - b.position).map(practiceItemBody);
}

function providerBody(payload: unknown): Response {
  return new Response(
    JSON.stringify({
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify(payload) }],
      usage: { input_tokens: 700, output_tokens: 150 },
    }),
    { status: 200 },
  );
}

// INFO: the provider's answer to a thread question.
export function providerThreadSuccess(): Response {
  return providerBody({ reply: "Because of the tense.", newWords: [], withdrawn: [] });
}

export function providerSuccess(): Response {
  return new Response(
    JSON.stringify({
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            reply: "Nice! Where did you go?",
            corrections: [],
            explanation: "",
            newWords: [],
            title: "Ramen spots in Tokyo",
          }),
        },
      ],
      usage: { input_tokens: 700, output_tokens: 150 },
    }),
    { status: 200 },
  );
}

// INFO: the test swaps this to script the provider's answer.
export const provider: { answer: (body: string) => Response } = { answer: providerSuccess };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function apiAnswer(method: string, pathname: string): Response {
  if (pathname.endsWith("/thread") && method === "GET") {
    return json({ session: sessionBody, message: threadMessageBody, messages: [] });
  }
  if (pathname.endsWith("/thread") && method === "POST") return json(threadRowBody, 201);
  if (pathname.endsWith("/withdraw")) return json(threadMessageBody);
  if (pathname === "/practice/recent-prompts") return json({ items: [] });
  if (pathname === "/profile") {
    return json({
      id: "user-1",
      displayName: "Ada",
      level: "beginner",
      goals: [],
      topics: [],
      provider: "claude",
      monthlyLimitUsd: 10,
      onboardingCompletedAt: stamp,
      createdAt: stamp,
      updatedAt: stamp,
    });
  }
  if (pathname === "/progress/mistakes") {
    return json({
      items: [
        {
          rule: "Present perfect",
          times: 2,
          latest: { original: "I have went", corrected: "I have gone" },
        },
      ],
      nextOffset: null,
    });
  }
  if (pathname === "/notes" && method === "POST") return json(storedNoteBody, 201);
  if (pathname === "/notes/note-1" && method === "GET") return json(storedNoteBody);
  if (pathname === "/practice/runs" && method === "POST") return json(practiceRunBody, 201);
  if (pathname.endsWith("/items") && method === "POST") return json({ items: savedItems() }, 201);
  if (pathname.startsWith("/practice/runs/") && pathname.endsWith("/checks")) {
    const sent = JSON.parse(recorded[recorded.length - 1]?.body ?? "{}") as { checks: unknown[] };
    return json({ count: sent.checks.length }, 201);
  }
  if (pathname.startsWith("/practice/runs/") && pathname.endsWith("/usage")) {
    return json(practiceRunBody);
  }
  if (pathname.startsWith("/practice/items/") && pathname.endsWith("/answer")) {
    return json({
      ...practiceItemBody({
        position: 0,
        kind: "choose",
        rule: "Present perfect",
        prompt: "I ___ to Japan twice.",
        options: ["have been", "was", "am"],
        accepted: ["have been"],
        explanation: "Because of the rule.",
        source: null,
      }),
      userAnswer: "x",
      correct: false,
    });
  }
  if (pathname === "/sessions/spend") return json({ monthStart: "2026-11-01", spentUsd: 0 });
  if (pathname === "/sessions/active") return json({ activeSession: null });
  if (pathname === "/sessions/week") {
    return json({ weekStart: "2026-11-02", today: "2026-11-05", days: [], perfectDays: [] });
  }
  if (pathname === "/sessions" && method === "POST") return json(sessionBody, 201);
  if (pathname.endsWith("/messages") && method === "POST") return json(messageBody, 201);
  if (pathname.endsWith("/title") && method === "PATCH") {
    return json({ ...sessionBody, title: "Ramen spots in Tokyo", titleSource: "auto" });
  }
  if (pathname.endsWith("/usage") || pathname.endsWith("/context")) return json(sessionBody);
  return json({ error: "not_found" }, 404);
}

const fetchFn: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  const headers: Record<string, string> = {};
  request.headers.forEach((value, name) => {
    headers[name] = value;
  });
  recorded.push({
    url: request.url,
    method: request.method,
    headers,
    body: await request.text(),
  });
  const url = new URL(request.url);
  if (url.origin === "https://api.anthropic.com") {
    return provider.answer(recorded[recorded.length - 1]?.body ?? "");
  }
  return apiAnswer(request.method, url.pathname);
};

export const data = createHonoData({
  baseUrl: "http://api.test",
  fetchFn,
  readToken: async () => ({ ok: true, token: generatedSecret("token") }),
});

export const ai = createClaudeAi({
  fetchFn,
  readKey: () => fakeKeys.readApiKey(),
});

export const model = TUTOR_MODEL;
