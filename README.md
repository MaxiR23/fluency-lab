# Fluency Lab

An app to practice English by writing. You open a chat about anything,
or pick a suggested topic, and every session saves your mistakes, new
words and progress. Suggestions get better as you use it. Following a
plan is optional; free practice is the default.

## Status

Expo project in a pnpm monorepo. The design layer exists (tokens and
base components); email sign-in, sign-up, password reset, onboarding, Home
with the tab bar, Settings, Profile, Progress (history, mistakes, words and study notes), the daily practice (focus, exercises and result, with the animated Home), study notes (the note screen, Progress · Notes and the notes in the chat) and the Chat
screen (chat with the tutor, replying to a tutor message, asking about a correction in its own thread, saved sessions, corrections and new words, the
monthly limit, and the no-key state) are built, the other screens are not. The screen
map, the palette and the Home design are decided.

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
- App layout in `apps/mobile/src/`: `app/` (routes), `ai/` (the AI port and
  its provider adapter), `auth/` (the auth
  port and its adapter), `components/`, `constants/` (theme tokens),
  `data/` (the data port and its adapter), `haptics/` (the haptics port and
  its expo-haptics and key-value adapters), `hooks/`, `keys/` (the key port
  and its secure-store adapter), `utils/` (pure functions)
- App identifier: `com.maxirebolo.fluencylab`

## Pending

Nothing is pending.

## Running

Requires Node 24 and pnpm.

    pnpm install
    pnpm dev                   Supabase, the API and Expo in one terminal (needs Docker)
    pnpm start                 Expo dev server (apps/mobile)

Open it in Expo Go by scanning the printed QR code.

## Local Supabase

Needs Docker running.

    pnpm supabase start        brings the local stack up
    pnpm supabase:status       prints the local URLs and keys
    pnpm supabase:stop         stops it

Copy each `.env.example` to `.env.local` (never committed) and fill it from
the status output. Filter it so that no other secret is printed:

    pnpm supabase status -o env | grep -E '^(API_URL|PUBLISHABLE_KEY|SECRET_KEY)='

    apps/mobile/.env.local
      EXPO_PUBLIC_SUPABASE_URL              http://<LAN IP>:54321
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY  PUBLISHABLE_KEY
      EXPO_PUBLIC_API_URL                   http://<LAN IP>:3000
    apps/api/.env.local
      SUPABASE_URL                          http://127.0.0.1:54321
      SUPABASE_PUBLISHABLE_KEY              PUBLISHABLE_KEY
      SUPABASE_SECRET_KEY                   SECRET_KEY

The secret key goes only in `apps/api/.env.local`, never in a mobile env file or a
doc. It is used only to delete an account.

The phone reaches the stack on the Mac's LAN IP (`ipconfig getifaddr en0`).
In development the app puts Metro's host in both mobile URLs, so they keep
working when the address changes; the values in `.env.local` are the fallback
and the production values. With `expo start --tunnel` the Metro host serves
only Metro, so the API and Supabase are not reachable through it. `SUPABASE_URL` in `apps/api`
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
`GET /sessions/open`, `DELETE /sessions/:id`, `GET /sessions/week`,
`GET /sessions/spend`, `GET /profile/stats`, `DELETE /account`, `POST /sessions`,
`GET /sessions/:id/messages`, `POST /sessions/:id/messages`,
`POST /sessions/:id/usage` and `POST /sessions/:id/end`: 401
without a valid token, 400 on invalid input, 404 when the row is not the
caller's, 503 when the database cannot be reached. `GET /profile` creates the
caller's profile when it is missing instead of answering 404. `GET
/sessions/week?tz=<IANA zone>` answers the days of the current week (Monday
first, in that zone) that have a session or a finished practice run, and among them the perfect days (a finished run with no missed item); 400 for an unknown zone. `GET
/sessions/spend?tz=<IANA zone>` answers the month's spend, which keeps the cost of deleted sessions and adds the cost of
practice runs (`practice_runs.cost_usd`). `GET
/profile/stats?tz=<IANA zone>` answers the session count, the day streak and the new words. The day streak counts consecutive days with a session back from today, or from yesterday when today has none yet (it stays alive until today ends), in the device's time zone. `DELETE
/account` deletes the caller's auth user and, through the cascades, their data; it needs
`SUPABASE_SECRET_KEY`. `GET
/sessions/:id/messages` answers the session, its messages and the study notes saved in it. `POST
/sessions/:id/usage` prices the reported tokens and adds them to the session's
cost. `POST /sessions` takes a topic or a starter id. The practice has `GET
/practice/today?tz=<IANA zone>` (today's run in that zone, or none), `POST /practice/runs`, `GET /practice/runs/:id`,
`POST /practice/runs/:id/items` (a position already saved is ignored, so a retry repeats safely), `POST /practice/runs/:id/usage`
(priced and added to the run's cost, which counts in the month's spend), `POST /practice/runs/:id/target`, `POST
/practice/runs/:id/finish` and `POST /practice/items/:id/answer`. The study notes have `POST /notes`,
`GET /notes/:id`, `DELETE /notes/:id` and `GET /progress/notes?tz=<IANA zone>` (newest first, with today in that zone); a note run is `POST /practice/runs` with the `note` focus. The API
reads the database as the signed-in user, so row level security applies.
`pnpm --filter api dev` needs `apps/api/.env.local`. Its routes are chained on one `Hono`
expression and the type of the app (`AppType`) is exported for the typed
client (RPC). Run it with `pnpm --filter api dev`.

## Screens (MVP)

    Login           Google, Apple, email
    Onboarding      first launch only: provider, key, monthly limit, level
    Home            today's practice card, the week, Free chat and Pick a topic, continue last session
    Suggestions     the full list of suggested topics, opened from Home
    Practice        pick a focus (mistakes, words or a topic) and start, opened from Home
    Practice run    the exercises of today's practice, or of a study note, and its result
    Chat            the session, corrections inline, reply to a tutor message, end session
    Thread          a correction's own thread: ask the tutor, withdrawn corrections
    Open chats      the active chats, open or delete one, from Home
    Summary         after a session: mistakes, new words, topic; also
                    opened from a Progress History row
    Plan            optional, off by default
    Note            a study note: the table or the summary, Remember, delete, Practice this
    Progress        session history, frequent mistakes, vocabulary, study notes
    Session detail  one session, shown by Summary when opened from Progress
    Settings        key, provider, model, monthly limit and spend, level, data

Bottom navigation: Home, Progress, Settings. Suggestions, Practice, Practice run,
Chat, Note, Summary and Session detail open on top of it.

Later, not in the MVP: YouTube suggestions and a small web page to see
progress.

## Palette

| Token              | Value                    | Use                                                             |
| ------------------ | ------------------------ | --------------------------------------------------------------- |
| background         | `#000000`                | screen                                                          |
| surface            | `#141414`                | cards, input background                                         |
| surface-sunken     | `#0A0A0A`                | empty day circle of the week strip                              |
| border             | `#262626`                | card borders, dividers                                          |
| border-strong      | `#404040`                | dashed border of a future day                                   |
| text               | `#F5F5F5`                | primary text                                                    |
| text-muted         | `#A3A3A3`                | secondary text                                                  |
| text-placeholder   | `#737373`                | input placeholder                                               |
| accent             | `#6DA5C0`                | tags, links, active item                                        |
| accent-deep        | `#072E33`                | highlighted card background, Logo badge, deep button background |
| accent-line        | `#0C4A50`                | highlighted card border, Logo badge border, deep button border  |
| accent-pressed     | `#0C7075`                | pressed accent                                                  |
| accent-soft        | `rgba(109,165,192,0.12)` | icon box tint                                                   |
| accent-tag         | `rgba(109,165,192,0.16)` | tag pill background                                             |
| accent-bubble      | `rgba(109,165,192,0.18)` | tutor bubble in the Free chat card, send button glow            |
| accent-bubble-line | `rgba(109,165,192,0.35)` | tutor bubble border                                             |
| shadow             | `#000000`                | raised card shadow                                              |
| error              | `#F87171`                | error text and borders                                          |
| surface-raised     | `#1A1A1A`                | open chat input                                                 |
| border-raised      | `#2E2E2E`                | open chat input border                                          |
| surface-disabled   | `#0F0F0F`                | locked input, disabled send                                     |
| border-disabled    | `#1F1F1F`                | locked input and disabled send border                           |
| text-disabled      | `#525252`                | locked placeholder, disabled send icon                          |

## Rules

- Reusable and centralized: shared components, one source for layout,
  spacing and color.
- Pure functions, easy to test. Logic lives outside components.
- TDD: the test comes first.
- Clean code.
