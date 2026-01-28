#!/usr/bin/env bash
set -euo pipefail

UPSTREAM_REMOTE="sim-origin"
UPSTREAM_BRANCH="main"
FORK_REMOTE="origin"
DEVELOP_BRANCH="develop"
MAIN_BRANCH="main"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --upstream) UPSTREAM_REMOTE="$2"; shift 2 ;;
    --upstream-branch) UPSTREAM_BRANCH="$2"; shift 2 ;;
    --fork) FORK_REMOTE="$2"; shift 2 ;;
    --develop) DEVELOP_BRANCH="$2"; shift 2 ;;
    --main) MAIN_BRANCH="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree not clean; commit/stash first." >&2
  exit 1
fi

DEV_SHA=$(git rev-parse --short "$DEVELOP_BRANCH")
MAIN_SHA=$(git rev-parse --short "$MAIN_BRANCH")

git branch "backup/${DEVELOP_BRANCH}-pre-upstream-${DEV_SHA}" "$DEVELOP_BRANCH" || true
git branch "backup/${MAIN_BRANCH}-pre-upstream-${MAIN_SHA}" "$MAIN_BRANCH" || true

git fetch "$UPSTREAM_REMOTE" --prune

git checkout "$DEVELOP_BRANCH"

# Avoid editor prompts during rebase
export GIT_EDITOR=:
export VISUAL=:
export EDITOR=:

if ! git rebase "${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}"; then
  echo "Rebase stopped (likely conflicts)." >&2
  echo "If bun.lock is conflicted, run:" >&2
  echo "  git checkout --ours bun.lock && bun install --no-progress && git add bun.lock" >&2
  echo "Then continue:" >&2
  echo "  git rebase --continue" >&2
  exit 1
fi

git push --force-with-lease "$FORK_REMOTE" "$DEVELOP_BRANCH"

git checkout "$MAIN_BRANCH"
git reset --hard "$DEVELOP_BRANCH"

git push --force-with-lease "$FORK_REMOTE" "$MAIN_BRANCH"
