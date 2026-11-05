# Testing

Conventions for tests in this repo.

## Commands

    pnpm test                    run all tests
    pnpm test -- <pattern>       only the files that match
    pnpm exec jest <path>        one file

## Runner

One runner: **jest-expo**, the Expo preset for Jest. It runs everything:
pure functions, hooks and components.

- Pure functions (recommendations, spend limit, session analysis, text
  helpers) get plain unit tests: input in, output out, no render, no
  mocks of React Native.
- Rendering is tested only where a component has its own logic.
- `describe` / `it` / `expect` come from explicit `@jest/globals`
  imports in each test file, not from ambient types.
- `render`, `fireEvent` and `act` from Testing Library are async and
  are awaited.

## File location

Tests live in a `test/` directory at the repo root, mirroring `src/`.
Expo Router routes live in `src/app/`, so their tests go under
`test/app/`.

    src/<path>/<file>.ts     -> test/<path>/<file>.test.ts
    src/app/index.tsx        -> test/app/index.test.tsx

Cross-cutting tests that do not map to a single file live at the root
of `test/`.

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

    // test/<path>/<file>.test.ts
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
    // Run with: pnpm test -- <file>
    //
    // SEE: src/<path>/<file>.ts

## TDD workflow

Red, green, refactor:

1. Write the test. It fails.
2. Write the minimum code to make it pass.
3. Refactor with the tests green.

Tests and implementation ship in the same branch and the same PR.
A function without tests is not done, and neither is its screen.

## SEE

- jest-expo: https://docs.expo.dev/develop/unit-testing/
- Testing Library for React Native: https://callstack.github.io/react-native-testing-library/