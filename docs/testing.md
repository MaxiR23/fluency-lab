# Testing

Conventions for tests in this repo.

## Commands

    pnpm test                    run all tests (every workspace, then scripts/test)
    pnpm exec jest <path>        one apps/mobile file, path from the repo root
    pnpm exec vitest run <path>  one packages/shared or apps/api file, path from the repo root
    pnpm supabase test db        the pgTAP database tests (needs the local Supabase stack)

## Runner

One runner per place: **jest-expo**, the Expo preset for Jest, for
`apps/mobile` (pure functions, hooks and components); **vitest** for
`packages/shared`, which has no Expo or React Native, and for `apps/api`; and `node --test`
for `scripts/test`. The database (row level security, triggers) is tested
with **pgTAP** through `pnpm supabase test db`, which needs the local stack.

- Pure functions (recommendations, spend limit, session analysis, text
  helpers) get plain unit tests: input in, output out, no render, no
  mocks of React Native.
- Rendering is tested only where a component has its own logic.
- `describe` / `it` / `expect` come from explicit imports in each test
  file, not from ambient types: `@jest/globals` in `apps/mobile`,
  `vitest` in `packages/shared` and `apps/api`.
- `render`, `fireEvent` and `act` from Testing Library are async and
  are awaited.
- Tests never contain literal values that look like secrets (passwords,
  keys, tokens, ids next to jwt or auth settings); they are generated at
  run time.

## File location

Each workspace has a `test/` directory at its root, mirroring its
`src/`. Expo Router routes live in `apps/mobile/src/app/`, so their
tests go under `apps/mobile/test/app/`.

    apps/mobile/src/<path>/<file>.ts   -> apps/mobile/test/<path>/<file>.test.ts
    apps/mobile/src/app/index.tsx      -> apps/mobile/test/app/index.test.tsx
    packages/shared/src/<file>.ts      -> packages/shared/test/<file>.test.ts
    apps/api/src/<file>.ts             -> apps/api/test/<file>.test.ts
    supabase/tests/database/<name>_test.sql   (header with `--`)

Cross-cutting tests of a workspace that do not map to a single file
live at the root of its `test/`. The repo scripts are tested with
`node --test` in `scripts/test/`, not with jest or vitest.

## API routes

Routes of `apps/api` are chained on one `Hono` expression so the type of
the app carries them to the typed client (RPC), and are tested through
`app.request`, never by starting a server.

## Naming

Test names describe the behavior being verified, not a category:

    it("suggests a review topic when a mistake repeats in two sessions")
    it("warns when the month's spend reaches the limit")
    it("returns no suggestions for a user with no sessions")

The name should be enough to know what broke when it fails.

## Pure functions first

Logic lives in pure functions, outside components. A component only
calls them and draws the result. If a piece of logic can only be
tested by rendering, it is in the wrong place: move it to a function.

Every pure function ships with tests for:

1. The normal case.
2. The empty case (no sessions, no mistakes, zero spend).
3. The edges (exactly at the limit, one over, one under).

## Calls to the outside

The AI provider, auth, the backend and storage go through a small
interface (a port), and tests fake that interface, never the library.
Tests never call a real AI API, the real backend or a device.

Every function that calls the outside ships with four tests:

1. Success with data. Asserts the parsed shape, not just that the call
   happened.
2. The expected empty state, returned as a success.
3. A failure the screen branches on (invalid key, limit reached),
   returned as a typed outcome.
4. Transport failure: timeout, network error, a body with the wrong
   shape. Each one is its own typed outcome and never a bare throw.

A fixture never contains a real API key, token or user id.

## File header

Each test file MUST start with this header:

    // apps/mobile/test/<path>/<file>.test.ts
    //
    // Tests for <what>.
    //
    // Tested:
    // - <behavior 1>
    // - <behavior 2>
    //
    // What is covered:
    // - Normal case, empty case, edges
    //
    // Run with: pnpm exec jest apps/mobile/test/<path>/<file>.test.ts
    //
    // SEE: apps/mobile/src/<path>/<file>.ts

## TDD workflow

Red, green, refactor:

1. Write the test. It fails.
2. Write the minimum code to make it pass.
3. Refactor with the tests green.

Tests and implementation ship in the same branch and the same PR.
A function without tests is not done, and neither is its screen.

## SEE

- jest-expo: https://docs.expo.dev/develop/unit-testing/
- vitest: https://vitest.dev/
- Testing Library for React Native: https://callstack.github.io/react-native-testing-library/
