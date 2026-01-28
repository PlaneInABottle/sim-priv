---
name: sim-upstream-sync
description: Keep a forked Sim repo up-to-date with upstream (sim-origin/main) using a rebase-first workflow. Use when you need to fetch new updates from sim-origin, rebase your origin/develop onto sim-origin/main, resolve conflicts (especially bun.lock), force-push with lease safely, and then sync origin/main from the updated develop.
---

# Sim Upstream Sync

## Rebase upstream into develop (recommended)

1) Ensure a clean working tree

```bash
git status -sb
```

2) Create safety backups

```bash
DEV_SHA=$(git rev-parse --short develop)
MAIN_SHA=$(git rev-parse --short main)

git branch backup/develop-pre-upstream-$DEV_SHA develop
git branch backup/main-pre-upstream-$MAIN_SHA main
```

3) Fetch upstream and your fork

```bash
git fetch sim-origin --prune
git fetch origin --prune
```

4) Rebase develop onto upstream (avoid interactive editor)

```bash
git checkout develop
GIT_EDITOR=: VISUAL=: EDITOR=: git rebase sim-origin/main
```

### Resolve common conflicts

#### bun.lock conflict

Do not hand-edit lockfile JSON unless you must. Prefer regenerating.

```bash
# Pick a side to get past markers (usually upstream)
git checkout --ours bun.lock

# Regenerate lockfile deterministically
bun install --no-progress

git add bun.lock
GIT_EDITOR=: VISUAL=: EDITOR=: git rebase --continue
```

If rebase stops again later on bun.lock, repeat the same regenerate flow.

#### If an editor pops up

Continue without opening an editor:

```bash
GIT_EDITOR=: VISUAL=: EDITOR=: git rebase --continue
```

#### Abort safely

```bash
git rebase --abort
# Return to safety backup if needed:
# git reset --hard backup/develop-pre-upstream-<sha>
```

5) Force-push rebased develop to your fork

```bash
git push --force-with-lease origin develop
```

## Sync main from develop (make main match develop)

Use this when you want your fork's `main` to exactly match your updated `develop`.

```bash
git checkout main
git reset --hard develop

git push --force-with-lease origin main
```

## Prevent accidental pushes to sim-origin

Set push defaults so `git push` from `develop` targets your fork, not upstream:

```bash
git config push.default current

git config branch.develop.pushRemote origin
# Optional: make status/ahead-behind compare to your fork branch
# git branch --set-upstream-to=origin/develop develop
```

## Bundled automation

Run the helper script for a repeatable flow:

```bash
.claude/skills/sim-upstream-sync/scripts/rebase_upstream.sh \
  --upstream sim-origin --upstream-branch main \
  --fork origin --develop develop --main main
```
