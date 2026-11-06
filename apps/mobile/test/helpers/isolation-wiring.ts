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
  createdAt: stamp,
};

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
  if (pathname === "/sessions/spend") return json({ monthStart: "2026-11-01", spentUsd: 0 });
  if (pathname === "/sessions/active") return json({ activeSession: null });
  if (pathname === "/sessions/week") {
    return json({ weekStart: "2026-11-02", today: "2026-11-05", days: [] });
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
