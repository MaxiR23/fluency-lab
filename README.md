# Fluency Lab

An app to practice English by writing. You open a chat about anything,
or pick a suggested topic, and every session saves your mistakes, new
words and progress. Suggestions get better as you use it. Following a
plan is optional; free practice is the default.

## Status

Fresh Expo project in a pnpm monorepo. No screen is built yet. The screen map and the
Home design are done; the rest of the design and the architecture come
next, one step at a time.

## Decided

- Expo SDK 58, Expo Router, TypeScript; runs in Expo Go
- pnpm as the only package manager
- Repository layout: a pnpm monorepo
- Text only: no voice in the MVP
- Sign in with Google, Apple and email
- AI with the user's own key (Claude or OpenAI); the user sets a
  monthly spend limit and is warned when it is reached
- One dark theme: black background, muted accents, nothing loud
- App identifier: `com.maxirebolo.fluency_lab`

## Pending

- Backend for accounts and progress (Supabase or another option)
- Test runner and checks

## Running

Requires Node 24 and pnpm.

    pnpm install
    pnpm start                 Expo dev server (apps/mobile)

Open it in Expo Go by scanning the printed QR code.

## Layout

    apps/mobile        the Expo app; routes in src/app/
    apps/api           the Hono backend (Node); routes in src/app.ts
    packages/shared    types and pure logic shared by the app and the backend
    scripts/           repo scripts and their tests

`apps/api` has only `GET /health`. Its routes are chained on one `Hono`
expression and the type of the app (`AppType`) is exported for the typed
client (RPC). Run it with `pnpm --filter api dev`.

## Screens (MVP)

    Login           Google, Apple, email
    Onboarding      first launch only: provider, key, monthly limit, level
    Home            free chat, continue last session, suggested topics
    Chat            the session, corrections inline, end session
    Summary         after a session: mistakes, new words, topic, cost
    Plan            optional, off by default
    Progress        session history, frequent mistakes, vocabulary
    Session detail  one session, opened from Progress
    Settings        key, provider, model, monthly limit and spend, level, data

Bottom navigation: Home, Progress, Settings. Chat, Summary and Session
detail open on top of it.

Later, not in the MVP: YouTube suggestions and a small web page to see
progress.

## Palette

| Token       | Value     | Use                         |
| ----------- | --------- | --------------------------- |
| background  | `#000000` | screen                      |
| surface     | `#141414` | cards                       |
| border      | `#262626` | card borders, dividers      |
| text        | `#F5F5F5` | primary text                |
| text-muted  | `#A3A3A3` | secondary text              |
| accent      | `#6DA5C0` | tags, links, active item    |
| accent-deep | `#072E33` | highlighted card background |
| accent-line | `#0C4A50` | highlighted card border     |

## Rules

- Reusable and centralized: shared components, one source for layout,
  spacing and color.
- Pure functions, easy to test. Logic lives outside components.
- TDD: the test comes first.
- Clean code.
