# Fluency Lab

An app to practice English by writing. You open a chat about anything,
or pick a suggested topic, and every session saves your mistakes, new
words and progress. Suggestions get better as you use it. Following a
plan is optional; free practice is the default.

## Status

Expo project in a pnpm monorepo. The design layer exists (tokens and
base components); email sign-in, sign-up, password reset, onboarding, Home
with the tab bar (Progress and Settings as placeholders) and the Chat no-key
state are built, the other screens are not. The screen map, the
palette and the Home design are decided.

## Decided

- Expo SDK 58, Expo Router, TypeScript; runs in Expo Go
- pnpm as the only package manager
- Repository layout: a pnpm monorepo
- Text only: no voice in the MVP
- Sign in with Google, Apple and email
- AI with the user's own key (Claude or OpenAI); the user sets a
  monthly spend limit and is warned when it is reached
- One dark theme: black background, muted accents, nothing loud
- Backend: Hono on Node in `apps/api`
- Auth and storage: Supabase Auth and Postgres behind `apps/api`,
  reached only through a port
- Test runners: jest-expo (app), vitest (`packages/shared`, `apps/api`),
  `node --test` (repo scripts), pgTAP (database, `supabase/tests/`)
- App layout in `apps/mobile/src/`: `app/` (routes), `auth/` (the auth
  port and its adapter), `components/`, `constants/` (theme tokens),
  `data/` (the data port and its adapter), `hooks/`, `keys/` (the key port
  and its secure-store adapter), `utils/` (pure functions)
- App identifier: `com.maxirebolo.fluencylab`

## Pending

Nothing is pending.

## Running

Requires Node 24 and pnpm.

    pnpm install
    pnpm start                 Expo dev server (apps/mobile)

Open it in Expo Go by scanning the printed QR code.

## Local Supabase

Needs Docker running.

    pnpm supabase start        brings the local stack up
    pnpm supabase:status       prints the local URLs and keys
    pnpm supabase:stop         stops it

Copy each `.env.example` to `.env.local` (never committed) and fill it from
the status output. Filter it so that no other secret is printed:

    pnpm supabase status -o env | grep -E '^(API_URL|PUBLISHABLE_KEY)='

    apps/mobile/.env.local
      EXPO_PUBLIC_SUPABASE_URL              http://<LAN IP>:54321
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY  PUBLISHABLE_KEY
      EXPO_PUBLIC_API_URL                   http://<LAN IP>:3000
    apps/api/.env.local
      SUPABASE_URL                          http://127.0.0.1:54321
      SUPABASE_PUBLISHABLE_KEY              PUBLISHABLE_KEY

The phone reaches the stack on the Mac's LAN IP (`ipconfig getifaddr en0`);
update the mobile URL when the network changes. `SUPABASE_URL` in `apps/api`
stays on `127.0.0.1` because the token's `iss` is always
`http://127.0.0.1:54321/auth/v1`. No other key of the status output goes into
a mobile env file or a doc. Read the emails the stack sends in Mailpit at
`http://127.0.0.1:54324`. The reset email template is
`supabase/templates/recovery.html`; restart the stack (`pnpm supabase:stop`,
then `pnpm supabase:start`) after changing it.

### Running the API with the local stack

    pnpm supabase:start        brings the stack up
    pnpm supabase db reset     applies supabase/migrations/ (wipes local users and data)
    pnpm --filter api dev      the API on port 3000, on every interface
    pnpm supabase test db      the database tests (pgTAP), they need the stack

Fill `apps/api/.env.local` first. The API listens on every interface, so the
phone reaches it on the LAN IP.

## Layout

    apps/mobile        the Expo app; routes in src/app/
    apps/api           the Hono backend (Node); routes in src/app.ts
    packages/shared    types and pure logic shared by the app and the backend
    supabase/          local Supabase config (config.toml), email templates,
                       migrations/ and the database tests in tests/
    scripts/           repo scripts and their tests

`apps/api` has `GET /health` and `GET /me` (the user of a valid Supabase
token; 401 when the token is missing or invalid, 500 when the signing keys
cannot be loaded, so an outage never tells the client its token is bad).
It also has `GET /profile`, `PUT /profile`, `GET /sessions/active`,
`POST /sessions` and `GET /sessions/:id/messages`: 401 without a valid token,
400 on invalid input, 404 when the row is not the caller's, 503 when the
database cannot be reached. The API reads the database as the signed-in user,
so row level security applies.
`pnpm --filter api dev` needs `apps/api/.env.local`. Its routes are chained on one `Hono`
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

| Token            | Value     | Use                                                             |
| ---------------- | --------- | --------------------------------------------------------------- |
| background       | `#000000` | screen                                                          |
| surface          | `#141414` | cards, input background                                         |
| border           | `#262626` | card borders, dividers                                          |
| text             | `#F5F5F5` | primary text                                                    |
| text-muted       | `#A3A3A3` | secondary text                                                  |
| text-placeholder | `#737373` | input placeholder                                               |
| accent           | `#6DA5C0` | tags, links, active item                                        |
| accent-deep      | `#072E33` | highlighted card background, Logo badge, deep button background |
| accent-line      | `#0C4A50` | highlighted card border, Logo badge border, deep button border  |
| accent-pressed   | `#0C7075` | pressed accent                                                  |
| error            | `#F87171` | error text and borders                                          |

## Rules

- Reusable and centralized: shared components, one source for layout,
  spacing and color.
- Pure functions, easy to test. Logic lives outside components.
- TDD: the test comes first.
- Clean code.
