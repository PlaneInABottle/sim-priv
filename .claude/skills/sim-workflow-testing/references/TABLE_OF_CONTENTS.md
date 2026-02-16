# Reference Files — Table of Contents

Quick index for the `sim-workflow-testing` skill reference files.
Load the file relevant to your current task; avoid loading all at once.

---

## Core Testing

| File | Lines | Purpose | Load When |
|------|-------|---------|-----------|
| [testing-protocol.md](testing-protocol.md) | ~500 | 6-phase test execution protocol (PREPARE→RESTORE) | Every test run |
| [verification-rules.md](verification-rules.md) | ~330 | Assertion types, expected blocks, failure detection | Validating test results |
| [payload-templates.md](payload-templates.md) | ~260 | Base webhook template, scenario overrides, variables | Building test payloads |
| [payload-examples.md](payload-examples.md) | ~300 | 6 complete JSON payload examples (S-01, S-04, S-07, S-09, S-14, S-15) | Need full payload copy-paste |

## Error Handling & Advanced

| File | Lines | Purpose | Load When |
|------|-------|---------|-----------|
| [error-recovery.md](error-recovery.md) | ~140 | Error handling, rollback, batch protocol, profile transitions | Test failures, multi-scenario runs |
| [custom-tool-testing.md](custom-tool-testing.md) | ~150 | Tool-isolated testing, anti-patterns, lifecycle checklist | Building/testing custom tools |

## Workflow Reference

| File | Lines | Purpose | Load When |
|------|-------|---------|-----------|
| [block-management.md](block-management.md) | ~200 | Architecture diagram, block IDs, SQL tracking schema | Setting up tests, identifying blocks |
| [tag-reference-patterns.md](tag-reference-patterns.md) | ~170 | Tag anti-patterns, GraphQL errors, tool schema, pre-deploy checklist | Writing function blocks, debugging tag errors |

## Company-Specific

| File | Lines | Purpose | Load When |
|------|-------|---------|-----------|
| [company-tests/kamatas-test-suite.md](company-tests/kamatas-test-suite.md) | — | Full Kamatas PROD test matrix with scenarios | Testing Kamatas workflow |
