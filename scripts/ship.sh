#!/usr/bin/env bash
# INFO: Mechanical half of shipping an issue: branch, gate, commit, push, PR.
#
# STEPS:
#   prepare <issue> [path ...]  branch if needed, gate, commit the given
#                               paths, write .claude/loop/pr-<issue>.meta
#   publish <issue>             verify nothing moved, gate, push, create or
#                               update the PR from pr-<issue>.body.md
#
# The PR body is prose and is written by the ship skill, not by this
# script. This script never reads previous commits, branches or PRs.

set -euo pipefail

TYPES="feat fix chore docs test refactor ci"
LOOP_DIR=".claude/loop"

die() {
  echo "ship: $*" >&2
  exit 1
}

usage() {
  die "usage: scripts/ship.sh prepare <issue> [path ...] | publish <issue>"
}

run_gate() {
  echo "ship: running the gate"
  pnpm gate || die "the gate failed"
}

check_no_operation_in_progress() {
  local dir
  for dir in rebase-merge rebase-apply MERGE_HEAD CHERRY_PICK_HEAD; do
    if [ -e "$(git rev-parse --git-path "$dir")" ]; then
      die "a rebase, merge or cherry-pick is in progress"
    fi
  done
}

issue_type() {
  local labels found=""
  labels=$(gh issue view "$1" --json labels -q '.labels[].name')
  for label in $labels; do
    for type in $TYPES; do
      if [ "$label" = "$type" ]; then
        [ -z "$found" ] || die "issue #$1 has more than one type label"
        found="$type"
      fi
    done
  done
  [ -n "$found" ] || die "issue #$1 has no type label"
  echo "$found"
}

branch_slug() {
  # "feat(mobile): bootstrap expo app" -> "bootstrap_expo_app", 5 words max
  echo "$1" |
    sed -E 's/^[a-z]+(\([^)]*\))?!?:[[:space:]]*//' |
    tr '[:upper:]' '[:lower:]' |
    sed -E 's/[^a-z0-9]+/ /g' |
    awk '{ n = (NF < 5) ? NF : 5; out = $1; for (i = 2; i <= n; i++) out = out "_" $i; print out }'
}

is_pushed() {
  [ -n "$(git ls-remote --heads origin "$1")" ]
}

open_pr_number() {
  local count
  count=$(gh pr list --head "$1" --state open --json number -q 'length')
  [ "$count" -le 1 ] || die "more than one open PR for branch $1"
  gh pr list --head "$1" --state open --json number -q '.[0].number // empty'
}

check_path_allowed() {
  # Under .claude/ only the project settings ship; the agents, the skills
  # and the loop directory stay per clone.
  local path="$1"
  while [ "${path#./}" != "$path" ]; do
    path="${path#./}"
  done
  set -- "$path"
  case "$1" in
    .. | ../* | */.. | */../*) die "refusing to stage $1" ;;
  esac
  case "$1" in
    .env.example | .claude/settings.json) ;;
    .claude/* | .env | .env.* | */node_modules/* | node_modules/* | \
      .expo/* | */.expo/* | ios/* | */ios/* | android/* | */android/*)
      die "refusing to stage $1"
      ;;
  esac
  if [ "$1" = "pnpm-lock.yaml" ] && [ -z "$(git status --porcelain -- '*package.json')" ]; then
    die "pnpm-lock.yaml changed without any package.json"
  fi
}

stage_paths() {
  # git add fails on a path whose deletion is already staged (it is in
  # neither the worktree nor the index); skip those, add the rest.
  local path
  local -a to_add=()
  for path in "$@"; do
    if [ ! -e "$path" ] && [ -z "$(git ls-files -- "$path")" ] &&
      [ -n "$(git diff --cached --name-only --diff-filter=D -- "$path")" ]; then
      continue
    fi
    to_add+=("$path")
  done
  [ "${#to_add[@]}" -eq 0 ] || git add -- "${to_add[@]}"
}

commit_paths() {
  # $1: amend or new. Remaining args: paths.
  local mode="$1"
  shift
  stage_paths "$@"
  local attempt
  for attempt in 1 2; do
    if [ "$mode" = "amend" ]; then
      git commit --amend --no-edit && return 0
    else
      git commit -F - <<<"$TITLE" && return 0
    fi
    # A hook may have rewritten files: re-stage the same paths once.
    [ "$attempt" = 1 ] && stage_paths "$@"
  done
  die "the commit failed twice; see the hook output above"
}

prepare() {
  local issue="$1"
  shift
  check_no_operation_in_progress

  TYPE=$(issue_type "$issue")
  TITLE=$(gh issue view "$issue" --json title -q '.title')
  [ "${TITLE%%[(:]*}" = "$TYPE" ] || die "title type and label differ"
  git fetch --quiet origin

  local branch
  branch=$(git branch --show-current)
  if [ "$branch" = "main" ]; then
    [ "$(git rev-parse main)" = "$(git rev-parse origin/main)" ] ||
      die "main is not up to date with origin/main"
    branch="w_$(date +%y%m%d)_${TYPE}_$(branch_slug "$TITLE")"
    git switch -c "$branch"
  fi
  case "$branch" in
    w_*) ;;
    *) die "not on main nor on a w_ branch: $branch" ;;
  esac

  local pushed="no" pr="" ahead
  is_pushed "$branch" && pushed="yes"
  pr=$(open_pr_number "$branch")
  [ "$pushed" = "no" ] || [ -n "$pr" ] || die "branch is pushed but has no open PR"
  ahead=$(git rev-list --count origin/main..HEAD)

  if [ "$pushed" = "no" ] && [ -n "$(git rev-list HEAD..origin/main)" ]; then
    die "branch is behind origin/main; rebasing is the owner's decision"
  fi

  local path
  for path in "$@"; do check_path_allowed "$path"; done

  printf '%s\n' "$TITLE" | pnpm exec commitlint || die "the issue title does not pass commitlint"

  run_gate

  if [ "$#" -eq 0 ]; then
    if [ -n "$pr" ]; then
      echo "ship: no files, description-only update of PR #$pr"
    elif [ "$ahead" -gt 0 ]; then
      echo "ship: no files, the issue commit already exists"
    else
      die "no files and no commit: nothing to deliver"
    fi
  elif [ "$pushed" = "no" ] && [ "$ahead" -gt 0 ]; then
    commit_paths amend "$@"
  else
    commit_paths new "$@"
  fi

  local mode="create" title="$TITLE"
  if [ -n "$pr" ]; then
    mode="update #$pr"
    title=$(gh pr view "$pr" --json title -q '.title')
  fi

  mkdir -p "$LOOP_DIR"
  cat >"$LOOP_DIR/pr-$issue.meta" <<EOF
Title: $title
Label: $TYPE
Base: main
Branch: $branch
Commit: $(git rev-parse HEAD)
Mode: $mode
EOF

  echo
  cat "$LOOP_DIR/pr-$issue.meta"
  echo
  git log --oneline origin/main..HEAD
  echo
  echo "ship: prepared. Write $LOOP_DIR/pr-$issue.body.md, then wait for approval."
}

meta_field() {
  sed -n "s/^$1: //p" "$LOOP_DIR/pr-$ISSUE.meta"
}

publish() {
  ISSUE="$1"
  local meta="$LOOP_DIR/pr-$ISSUE.meta" body="$LOOP_DIR/pr-$ISSUE.body.md"
  [ -f "$meta" ] || die "missing $meta: run prepare first"
  [ -s "$body" ] || die "missing or empty $body"

  head -n 1 "$body" | grep -qx "Closes #$ISSUE" || die "the body must start with: Closes #$ISSUE"
  ! grep -q '<!--' "$body" || die "the body still has template comments"
  ! grep -qE '(^|[^[:alnum:]_])Claude([^[:alnum:]_]|$)' "$body" || die "the body mentions forbidden attribution"
  ! grep -qiE 'co-authored-by|generated with|claude code|anthropic' "$body" || die "the body mentions forbidden attribution"

  local title label branch commit mode
  title=$(meta_field Title)
  label=$(meta_field Label)
  branch=$(meta_field Branch)
  commit=$(meta_field Commit)
  mode=$(meta_field Mode)

  case "$branch" in
    w_*) ;;
    *) die "not a w_ branch: $branch" ;;
  esac

  [ "$(git branch --show-current)" = "$branch" ] || die "not on $branch: prepare again"
  [ "$(git rev-parse HEAD)" = "$commit" ] || die "HEAD moved since prepare: prepare again"
  git diff --quiet HEAD || die "uncommitted changes in tracked files: prepare again"

  run_gate

  gh label list --json name -q '.[].name' | grep -qx "$label" || die "label $label does not exist"

  local pr
  pr=$(open_pr_number "$branch")
  case "$mode" in
    create) [ -z "$pr" ] || die "a PR already exists (#$pr): prepare again" ;;
    "update #"*) [ "$mode" = "update #$pr" ] || die "the open PR changed: prepare again" ;;
    *) die "unknown mode: $mode" ;;
  esac

  git push -u origin "$branch"

  if [ "$mode" = "create" ]; then
    gh pr create --base main --head "$branch" --title "$title" \
      --label "$label" --assignee @me --body-file "$body"
    pr=$(open_pr_number "$branch")
  else
    gh pr edit "$pr" --title "$title" --body-file "$body"
  fi

  gh pr view "$pr" --json number,title,labels,isDraft,baseRefName,url
}

[ "$#" -ge 2 ] || usage
command="$1"
shift
case "$command" in
  prepare) prepare "$@" ;;
  publish)
    [ "$#" -eq 1 ] || usage
    publish "$1"
    ;;
  *) usage ;;
esac