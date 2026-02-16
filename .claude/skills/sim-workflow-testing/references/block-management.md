# Block Management

Architecture diagram, block reference, and SQL tracking schema for the Kamatas PROD workflow.

---

## Table of Contents

1. [Architecture Diagram](#architecture-diagram)
2. [Block Quick Reference](#block-quick-reference)
3. [SQL Tracking Schema](#sql-tracking-schema)

---

## Architecture Diagram

```
                                    ┌─────────────────────────────────────────────────┐
                                    │              KAMATAS PROD WORKFLOW               │
                                    │         53408cc2-52fa-46e5-85d7-402d2f42f3a4    │
                                    └─────────────────────────────────────────────────┘

    ┌────────────┐      ┌──────────────┐
    │  Webhook 1 │─────▶│ Incoming Only│──── IF (incoming text) ──────────────────────┐
    │ (trigger)  │      │ (condition)  │                                               │
    └────────────┘      └──────┬───────┘                                               │
                               │                                          ┌────────────┴──────────────┐
                          ELSE │                                          │ Build Conversation        │
                               │                                          │ Composite Key (function)  │
                               ▼                                          └────────────┬──────────────┘
                     ┌──────────────────┐                                      ┌───────┴────────┐
                     │ Is Media Message?│                                      │                 │
                     │   (condition)    │                                      ▼                 ▼
                     └────────┬─────────┘                          ┌─────────────────┐  ┌──────────────┐
                              │                                    │fetchCustomerInfo│  │storeUserMsg  │
                     IF media │                                    │ (workflow_input)│  │  (memory)    │
                              ▼                                    └────────┬────────┘  └──────┬───────┘
                     ┌──────────────────┐                                   │                   │
                     │  Media Handoff   │                                   │                   ▼
                     │   (function)     │                                   │           ┌──────────────┐
                     └──────────────────┘                                   │           │    API 1     │
                                                                           │           │  (api call)  │
                                                                           │           └──────┬───────┘
                                                                           │                  │
                                                                           │                  ▼
                                                                           │           ┌──────────────┐
                                                                           │           │ debounceWait │
                                                                           │           │   (wait)     │
                                                                           │           └──────┬───────┘
                                                                           │                  │
                                                                           │                  ▼
                                                                           │          ┌───────────────────┐
                                                                           │          │getLatestMessageId │
                                                                           │          │     (api)         │
                                                                           │          └───────┬───────────┘
                                                                           │                  │
                                                                           │                  ▼
                                                                           │     ┌───────────────────────┐
                                                                           │     │checkIfTheMessageLatest│
                                                                           │     │     (condition)       │
                                                                           │     └───────────┬───────────┘
                                                                           │            IF latest
                                                                           │                 │
                                                                           ▼                 ▼
                                                                   ┌─────────────────────────────────────┐
                                                                   │              Loop 1                 │
                                                                   │  ┌──────────────┐  ┌─────────────┐  │
                                                                   │  │Support Agent │─▶│AgentVariable│  │
                                                                   │  │   (agent)    │  │ (variables) │  │
                                                                   │  │              │─▶│             │  │
                                                                   │  │   (on error) │  └─────────────┘  │
                                                                   │  │      │       │                   │
                                                                   │  │      ▼       │                   │
                                                                   │  │   Wait 2     │                   │
                                                                   │  └──────────────┘                   │
                                                                   └───────────────┬─────────────────────┘
                                                                                   │
                                                                                   ▼
                                                                        ┌────────────────────┐
                                                                        │getLatestMessageId2 │
                                                                        │      (api)         │
                                                                        └─────────┬──────────┘
                                                                                  │
                                                                                  ▼
                                                                   ┌───────────────────────────┐
                                                                   │checkIfTheMessageLatest2   │
                                                                   │       (condition)         │
                                                                   └────────────┬──────────────┘
                                                                           IF latest
                                                                                │
                                                                                ▼
                                                                   ┌──────────────────────┐
                                                                   │Extract Search Context│
                                                                   │    (function)        │
                                                                   └─────────┬────────────┘
                                                                             │
                                                                             ▼
                                                                   ┌──────────────────┐
                                                                   │Has IKAS Context? │
                                                                   │   (condition)    │
                                                                   └───┬──────────┬───┘
                                                                IF yes│          │ELSE
                                                                      ▼          │
                                                            ┌──────────────┐     │
                                                            │Store IKAS   │     │
                                                            │Context (mem)│     │
                                                            └──────┬──────┘     │
                                                                   │            │
                                                                   ▼            ▼
                                                              ┌──────────────────┐
                                                              │    Memory 1      │
                                                              │   (memory)       │
                                                              └────────┬─────────┘
                                                                       │
                                                                       ▼
                                                              ┌────────────────────────┐
                                                              │Send to Chatwoot        │
                                                              │(No Files) 1 (function) │
                                                              └────────────────────────┘
```

---

## Block Quick Reference

| # | Block Name | Block ID | Type |
|---|-----------|----------|------|
| 1 | Webhook 1 | `f3d0bdbd` | generic_webhook |
| 2 | Incoming Only | `dcad3f5b` | condition |
| 3 | Is Media Message? | `block-9f9c16f6` | condition |
| 4 | Media Handoff | `block-b0a9fec7` | function |
| 5 | Build Conversation Composite Key | `buildconversationcompositekey` | function |
| 6 | fetchCustomerInformation | `5c001454` | workflow_input |
| 7 | storeUserMessage | `d4b467d3` | memory |
| 8 | API 1 | `ca5acc54` | api |
| 9 | debounceWait | `bc6cc87d` | wait |
| 10 | getLatestMessageId | `c18d418f` | api |
| 11 | checkIfTheMessageLatest | `a057131e` | condition |
| 12 | Loop 1 | `f2c10d85` | loop |
| 13 | Support Agent | `35a00fab` | agent |
| 14 | AgentVariable | `2c432318` | variables |
| 15 | Wait 2 | `598e048a` | wait |
| 16 | getLatestMessageId2 | `cfeba002` | api |
| 17 | checkIfTheMessageLatest2 | `892e0602` | condition |
| 18 | Extract Search Context | `89d6feb8` | function |
| 19 | Has IKAS Context? | `77f980fc` | condition |
| 20 | Store IKAS Context | `84cc0a48` | memory |
| 21 | Memory 1 | `e38be766` | memory |
| 22 | Send to Chatwoot (No Files) 1 | `3275b7a8` | function |

> **Note:** Block IDs shown as short prefixes for readability. Full UUIDs are in `company-tests/kamatas-test-suite.md`.

---

## SQL Tracking Schema

Use this schema to track test results within an agent session:

```sql
CREATE TABLE IF NOT EXISTS test_runs (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    workflow_name TEXT NOT NULL,
    profile TEXT NOT NULL,         -- CONDITION_ONLY | PATH_ISOLATION | FULL_INTEGRATION
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    status TEXT DEFAULT 'running'  -- running | passed | failed | error
);

CREATE TABLE IF NOT EXISTS test_results (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES test_runs(id),
    scenario_id TEXT NOT NULL,
    scenario_name TEXT NOT NULL,
    test_group TEXT NOT NULL,      -- condition_routing | media_handoff | text_flow | integration
    profile TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending | passed | failed | error | timeout | skipped
    execution_id TEXT,
    expected_path TEXT,            -- JSON array of expected block names
    actual_path TEXT,              -- JSON array of actual block names from trace
    expected_output TEXT,
    actual_output TEXT,
    error_message TEXT,
    executed_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS block_snapshots (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES test_runs(id),
    block_id TEXT NOT NULL,
    block_name TEXT NOT NULL,
    original_enabled INTEGER NOT NULL,  -- 1 = enabled, 0 = disabled
    test_enabled INTEGER,               -- State during test (null = not modified)
    restored INTEGER DEFAULT 0          -- 1 = restored to original
);
```

### Common Queries

Insert a test run:
```sql
INSERT INTO test_runs (id, workflow_id, workflow_name, profile)
VALUES ('run-001', '53408cc2-52fa-46e5-85d7-402d2f42f3a4', 'Kamatas PROD', 'CONDITION_ONLY');
```

Record a result:
```sql
INSERT INTO test_results (id, run_id, scenario_id, scenario_name, test_group, profile, status, expected_path, actual_path)
VALUES ('res-001', 'run-001', 'CR-01', 'Text message routing', 'condition_routing', 'CONDITION_ONLY', 'passed',
        '["Webhook 1", "Incoming Only"]', '["Webhook 1", "Incoming Only"]');
```

Query pass rate:
```sql
SELECT
    test_group,
    COUNT(*) as total,
    SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed,
    ROUND(100.0 * SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) / COUNT(*), 1) as pass_rate
FROM test_results
WHERE run_id = 'run-001'
GROUP BY test_group;
```
