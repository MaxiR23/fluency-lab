// Test helper (not a test file): the real data adapter and the real provider
// adapter over one recording fetch, for the key isolation test. Nothing leaves
// the process: the fetch answers the API paths and the provider endpoint with
// scripted bodies. The key is generated at run time and the adapter reads it
// through the fake key port, as src/ai/index.ts does.

import { TUTOR_MODEL } from "@fluency-lab/shared";

import { createClaudeAi } from "@/ai/claude-ai";
import { createHonoData } from "@/data/hono-data";
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

const fixExercise = {
  kind: "fix",
  rule: "Present perfect",
  prompt: "I never been to Japan.",
  options: [],
  accepted: ["I've never been to Japan."],
  explanation: "Use the present perfect for an experience.",
  source: "",
};

const otherFixes = [
  ["Third person", "She never go to school.", "She never goes to school."],
  ["Third person", "He don't like tea.", "He doesn't like tea."],
  ["Past simple", "We never was late.", "We were never late."],
  ["Past simple", "They did not went home.", "They did not go home."],
].map(([rule, prompt, accepted]) => ({
  ...fixExercise,
  rule,
  prompt,
  accepted: [accepted],
}));

// INFO: the provider's answer to a practice round: five fix exercises, each with its own
// prompt and at most two of a rule, so the round validation keeps all five.
export function providerRoundSuccess(): Response {
  return providerBody({ items: [fixExercise, ...otherFixes] });
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
const practiceItemBody = (position: number) => ({
  id: `item-${position}`,
  runId: "run-1",
  position,
  kind: "fix",
  rule: "Present perfect",
  prompt: "I never been to Japan.",
  options: null,
  accepted: ["I've never been to Japan."],
  explanation: "Use the present perfect for an experience.",
  source: null,
  userAnswer: null,
  correct: null,
  answeredAt: null,
});

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
          }),
        },
      ],
      usage: { input_tokens: 700, output_tokens: 150 },
    }),
    { status: 200 },
  );
}

// INFO: the test swaps this to script the provider's answer.
export const provider: { answer: () => Response } = { answer: providerSuccess };

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
  if (pathname.endsWith("/items") && method === "POST") {
    return json({ items: [0, 1, 2, 3, 4].map(practiceItemBody) }, 201);
  }
  if (pathname.startsWith("/practice/runs/") && pathname.endsWith("/usage")) {
    return json(practiceRunBody);
  }
  if (pathname.startsWith("/practice/items/") && pathname.endsWith("/answer")) {
    return json({ ...practiceItemBody(0), userAnswer: "x", correct: false });
  }
  if (pathname === "/sessions/spend") return json({ monthStart: "2026-11-01", spentUsd: 0 });
  if (pathname === "/sessions/active") return json({ activeSession: null });
  if (pathname === "/sessions/week") {
    return json({ weekStart: "2026-11-02", today: "2026-11-05", days: [], perfectDays: [] });
  }
  if (pathname === "/sessions" && method === "POST") return json(sessionBody, 201);
  if (pathname.endsWith("/messages") && method === "POST") return json(messageBody, 201);
  if (pathname.endsWith("/usage")) return json(sessionBody);
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
  if (url.origin === "https://api.anthropic.com") return provider.answer();
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
