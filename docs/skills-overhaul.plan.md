# Skills Portfolio Overhaul - Migration Status Plan

## Objective

Complete the repo-local migration from `.claude/skills` to `.agents/skills`, keep the supporting docs coherent with the migrated tree, and validate the live tree with the shared maintainer/creator tooling before commit.

## Current state (verified locally)

- Repo-local skills now live under `.agents/skills/<skill>/SKILL.md`; the branch still contains the matching `.claude/skills/**` deletions that should ship in the same migration commit.
- `ecommerce-agent-template` already uses valid sibling links to `../ikas-api/SKILL.md#quick-start`, `../ikas-api/SKILL.md#rate-limiting`, and `../ikas-products-grouping/SKILL.md`. No content rewrite is needed there.
- `sim-workflows` still had one broken local anchor in `references/mcp-tools-reference.md`: it linked to `../SKILL.md#disabling-blocks-for-safe-testing` even though the target section lives in the same reference file. This is the remaining repo-local skill-link fix in scope.
- `AGENTS.md` already reflects the repo-local skill inventory under `.agents/skills/` and correctly treats `skill-maintainer` / `skill-creator` as externally loaded authority skills rather than repo-owned skills.
- `docs/ai-native-workflow-guide.md` already teaches the active `.agents/skills/.../SKILL.md` layout and the rule that packaged `.skill` archives belong outside the live tree.
- Repo-local `sim-app-development` and `sim-self-hosting` skills already exist in the migrated tree; any later work on them is refinement-only, not new-skill creation.
- Packaged `.skill` archives should stay outside the live tree (for example `./dist/skills`). Validate explicitly that no top-level `.skill` archive exists under `./.agents/skills`.
- No external-doc lookup is required for this migration. Local skill files, `audit_skills.py`, `quick_validate.py`, `AGENTS.md`, and repo docs are sufficient authority for this scope.

## Scope

### In scope

- Fix the remaining broken local anchor in `sim-workflows`
- Remove stale pre-migration claims from this plan file
- Validate the migrated `./.agents/skills` tree with the shared audit and per-skill validator workflow
- Commit the migration file moves plus the related docs/reference updates already present in the working tree

### Out of scope

- Moving `.claude/commands` or `.claude/rules`
- Broader content rewrites beyond migration coherence and path/reference accuracy
- External API/library re-research unless a local claim cannot be verified from repository evidence
- Unrelated docs or product-code changes outside the migration/fix set

## Files expected in the commit

- All `.claude/skills/**` deletions corresponding to the migration
- All `.agents/skills/**` additions corresponding to the migration
- `.agents/skills/sim-workflows/references/mcp-tools-reference.md`
- `AGENTS.md`
- `docs/ai-native-workflow-guide.md`
- `docs/skills-overhaul.plan.md`

## Validation workflow

Run from repo root:

```bash
python3 /Users/Y_ALTAY1/.agents/skills/skill-maintainer/scripts/audit_skills.py ./.agents/skills --validator /Users/Y_ALTAY1/.agents/skills/skill-creator/scripts/quick_validate.py

for skill_dir in ./.agents/skills/*/; do
  [ -f "$skill_dir/SKILL.md" ] || continue
  python3 /Users/Y_ALTAY1/.agents/skills/skill-creator/scripts/quick_validate.py "$skill_dir" || exit 1
done

find ./.agents/skills -maxdepth 1 -name '*.skill' -print
```

Expected outcomes:

- Repo audit finishes with `Errors: 0`
- Every per-skill validation prints `Skill is valid!`
- `find` returns no top-level `.skill` archives under `./.agents/skills`

## Targeted migration checks

Use these checks to confirm the known analyzer findings are resolved:

```bash
rg -n "safe testing patterns|disabling-blocks-for-safe-testing" .agents/skills/sim-workflows/references/mcp-tools-reference.md .agents/skills/sim-workflows/SKILL.md
rg -n "rate-limiting|quick-start" .agents/skills/ecommerce-agent-template/SKILL.md .agents/skills/ikas-api/SKILL.md
# Confirm separately that stale pre-migration phrases are absent from docs/skills-overhaul.plan.md
```

Expected outcomes:

- The `sim-workflows` reference points at the local `#disabling-blocks-for-safe-testing` section instead of a missing `SKILL.md` anchor
- The `ecommerce-agent-template` → `ikas-api` links resolve to existing headings (`#quick-start`, `#rate-limiting`)
- The stale pre-migration phrases no longer appear in `docs/skills-overhaul.plan.md`

## Commit requirements

- Stage only migration/fix files; do not include unrelated docs or artifacts
- Use one conventional commit for the migration + fixes
- Include this trailer exactly:

```
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```
