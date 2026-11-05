# Development workflow

Flow for every feature, fix or non-trivial change in this repo.

1. **Open an issue**
   - Title: `type(scope): short description`
   - Body: scope, out of scope, acceptance criteria
   - Label matching the commit type: feat, fix, docs, chore, test,
     refactor, ci. `scripts/ship.sh` takes the branch type from the
     label and the commit message from the title, so the title needs
     its scope: commitlint rejects one without it.
   - The `create-issue` skill drafts an issue from
     `.github/ISSUE_TEMPLATE/issue.md` with its label and a title that
     passes commitlint, and creates it only after the owner approves the
     draft. The `refine-issue` skill does the same for an existing issue
     that lacks scope, out of scope or acceptance criteria, and edits it
     only after approval. An issue that has the three sections is not
     refined.
   - Scope freeze: the scope is the issue body when the loop starts.
     What comes up mid-loop is a new issue, not an addition to the
     running one.

2. **Create the branch**
   - From updated main: `git checkout main && git pull`
   - Naming: `<type>/<description>`, for example `feat/login-screen`.
     The type equals the issue's label; the description is lowercase
     with hyphens, at most 5 words
   - Or skip this step and work on main without committing:
     `scripts/ship.sh prepare` creates the branch at step 6 with the
     same naming.

3. **Implement**
   - Through the agent loop, driven by an orchestrator that dispatches
     each stage by name with a one-line prompt (issue number, plan
     path, mode), does not read the agent definitions and does not
     implement. See the Workflow section of CLAUDE.md.
   - `plan-issue` runs only when the issue touches app logic or a
     screen, and the owner approves the plan before any code is
     written. Any other issue goes straight to `implement-issue`, whose
     scope and acceptance criteria stand in for the plan.
   - `implement-issue` reads the plan, not the sources the plan already
     cites, and hands back with the diff stat.
   - Test first (see `docs/testing.md`). Tests and implementation ship
     in the same branch.
   - See the definition of done in CLAUDE.md.

4. **Verify locally**
   - `implement-issue` runs `pnpm gate` (`pnpm typecheck`, `pnpm lint`
     and `pnpm test`, in that order) once, when the plan is
     implemented. If it fails, it fixes and reruns, at most three
     attempts, then stops and reports. In plan mode the report names a
     `plan-issue` addendum as the next stage; that one addendum per
     issue is implemented without a new owner approval (see Recovery).
   - The PreToolUse hook `scripts/gate-limit.mjs`, declared in
     `.claude/settings.json`, enforces the limit: inside
     `implement-issue` it blocks the fourth `pnpm gate` before it runs,
     and also the gate's parts (`pnpm typecheck`, `pnpm lint`,
     `pnpm test`, with or without `run`). Commands scoped to a file
     (`pnpm exec jest <path>`, `pnpm exec vitest run <path>`) and `pnpm format` stay allowed. The parts
     are blocked in their filtered forms too (`pnpm -r test`,
     `pnpm --filter <name> lint`). The count
     is per `agent_id`, kept under `.claude/loop/`, so every pass is a
     new dispatch, never a continuation of an earlier one. Project hooks
     load from the `.claude/` of the directory where the session starts,
     so the orchestrator session starts at the repo root. The main
     session, `scripts/ship.sh` and CI are not limited.
   - `scripts/ship.sh` runs the gate again at steps 6 and 7.

5. **Pick the path and review**
   - `scripts/loop-path.sh` prints `short` or `full` from the changed
     files, per the rule under "Short path" below. Short goes to step 6.
     Since nothing reviews that diff, the `ship` skill greps it for
     secrets (and for `https://`) before `scripts/ship.sh prepare`.
   - Full: run `review-changes` once, over the diff against
     `origin/main` (`git diff origin/main...HEAD` plus what is still
     uncommitted), not over whole files. Then `verify-findings`, only if
     the review reports Blocking or Important findings.
   - `implement-issue` in fix mode fixes what `verify-findings`
     confirmed plus the minors the owner decided to fix, in one cycle,
     and runs the gate. There is no second review: what the fix cycle
     leaves open is listed in the pull request for the owner to decide.

6. **Commit**
   - Through the `ship` skill, once blocking and important findings
     are fixed and the minor ones are decided. The skill names the
     files of the change; `scripts/ship.sh prepare` creates the branch
     if needed, runs the gate, commits those paths and writes
     `.claude/loop/pr-N.meta`. The skill then writes the pull request
     body and stops.
   - Conventional commits: `type(scope): short description`, lowercase,
     one line. No body: the reasoning goes in the pull request.
   - These branch commits never reach main; only the squash does.

7. **Push and open the PR**
   - Through the `ship` skill again, after approving the body. The body
     is `.claude/loop/pr-N.body.md` and can be edited before approving:
     what is in the file is what gets published. Then
     `scripts/ship.sh publish` checks that nothing moved since prepare,
     runs the gate, pushes and opens or updates the pull request.
   - Body: `Closes #N` first, then the sections of
     `.github/pull_request_template.md` that apply, in its order.

8. **Merge**
   - Squash only: the pull request lands on `main` as one commit.
   - CI has to be green before the merge.

## Recovery

- Three gate failures inside `implement-issue` (step 4) in plan mode:
  `plan-issue` writes an addendum from the failing output and
  `implement-issue` implements it without a new approval. If that run
  also fails three times, or the first failure was in issue mode or fix
  mode, the owner decides between a `plan-issue` addendum or
  `implement-issue` in fix mode, with the failing output as its list.
- A gate failure inside `scripts/ship.sh prepare` or `publish`: run
  `implement-issue` in fix mode with the gate output, then `prepare`
  again.
- Every other `scripts/ship.sh publish` failure before `git push`:
  follow the script's own message and run `prepare` again. Only a
  failure after the push and before the PR exists is retried with
  `publish` again, never `prepare`.
- An open decision `implement-issue` raises in issue mode or fix mode:
  the answer goes in the invocation text, verbatim.

## Short path

`scripts/loop-path.sh` prints `short` or `full` from the changed files.
Short only when every changed file is a `.md` and none is `CLAUDE.md` or
under `.claude/` or `.github/`. Short skips review and verification and
goes to `ship`; full goes to `review-changes`. There is no partial path:
the script decides, not judgment.

    implement-issue -> scripts/loop-path.sh -> ship

## Permissions

`.claude/settings.json` is the project's permission set for the loop:
the gate commands, `pnpm format`, `pnpm exec jest`, `pnpm exec vitest`,
`pnpm exec commitlint`, `scripts/ship.sh`, `scripts/loop-path.sh`, read-only git
(`fetch`, `diff`, `status`, `log`, `ls-files`), `gh issue view`,
`gh issue create`, `gh issue edit`, `gh label list`, `gh pr view` and
`gh pr list` run without a prompt. Any direct `git push` (the script is
the only pusher), `gh pr merge` and reading `.env` are denied. These
rules are a layer over the branch protection on GitHub, not the guard.
