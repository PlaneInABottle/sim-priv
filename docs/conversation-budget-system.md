# Conversation Budget System

## Overview

The Conversation Budget System enforces a **per-workspace monthly limit** on unique Chatwoot conversations processed by AI in Sim Studio. It is designed for a self-hosted, single-operator deployment with 3 workspaces — each representing one Chatwoot business client.

The entire system is implemented via **3 workflow blocks** — a PostgreSQL Execute block, a Condition block, and a Function block — inserted at the top of each Chatwoot webhook workflow. There are **zero changes to Sim Studio source code**; the mechanism lives entirely in PostgreSQL (2 tables) and workflow configuration managed through sim-mcp.

**Key properties:**

- **Atomic** — budget check and consumption happen inside a single writable CTE within one implicit transaction.
- **Session-aware** — a conversation counts as 1 token per active session. Messages within a 24-hour window belong to the same session and are free. A new session starts when the conversation has been idle for 24+ hours, consuming another token.
- **Fail-safe** — DB errors route to the same handoff function via the PG block's error edge, opening the conversation for a human agent instead of silently dropping it.

---

## Architecture

```
[generic_webhook "Webhook 1"]
         │
         ▼
[PostgreSQL Execute — "Budget Check"]  ──error──▶ [Function — "Budget Exceeded Handoff"]
  writable CTE (check + insert)                     /toggle_status → "open"
         │ success
         ▼
[Condition — "Budget Gate"]
  <Budget Check.rows[0].allowed> === true
    │ true                  │ false
    ▼                       ▼
[rest of workflow]   [Function — "Budget Exceeded Handoff"]
                       /toggle_status → "open"
```

The PostgreSQL Execute block runs a single writable CTE that atomically checks the workspace's monthly limit, applies 24h session logic, inserts a new session row if needed, and returns one field: `allowed` (boolean). The Condition block reads `<Budget Check.rows[0].allowed>` and gates execution. If `true`, the workflow continues. If `false` (budget exhausted) or if the PG block throws an error (DB down), both paths lead to the **Budget Exceeded Handoff** function — it calls `/toggle_status → open` to hand the conversation to a human agent.

---

## Database Schema

### Raw SQL

Use this for direct migration or `psql` execution:

```sql
CREATE TABLE workspace_budget (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE REFERENCES workspace(id) ON DELETE CASCADE,
  monthly_limit INTEGER NOT NULL DEFAULT 100,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE chatwoot_conversation_consumptions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  chatwoot_conversation_id BIGINT NOT NULL,
  period_key TEXT NOT NULL,
  workflow_execution_id TEXT,
  consumed_at TIMESTAMP NOT NULL DEFAULT now()
);

-- One row per session (a conversation can have multiple rows if it re-engages after 24h)
CREATE INDEX chatwoot_conv_consumptions_workspace_period_idx
  ON chatwoot_conversation_consumptions (workspace_id, period_key);

-- For fast 24h activity lookups: "has this conversation been active recently?"
CREATE INDEX chatwoot_conv_consumptions_recent_idx
  ON chatwoot_conversation_consumptions (workspace_id, chatwoot_conversation_id, consumed_at DESC);
```

### Drizzle TypeScript (for `packages/db/schema.ts`)

```typescript
export const workspaceBudget = pgTable(
  'workspace_budget',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .unique()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    monthlyLimit: integer('monthly_limit').notNull().default(100),
    isEnabled: boolean('is_enabled').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  }
)

export const chatwootConversationConsumptions = pgTable(
  'chatwoot_conversation_consumptions',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    chatwootConversationId: bigint('chatwoot_conversation_id', { mode: 'number' }).notNull(),
    periodKey: text('period_key').notNull(),
    workflowExecutionId: text('workflow_execution_id'),
    consumedAt: timestamp('consumed_at').notNull().defaultNow(),
  },
  (table) => ({
    // No unique constraint — one row per session, multiple sessions per conversation allowed
    workspacePeriodIdx: index('chatwoot_conv_consumptions_workspace_period_idx').on(
      table.workspaceId,
      table.periodKey
    ),
    // For fast 24h activity lookups (raw SQL uses DESC for forward scan; Drizzle defaults to ASC — functionally equivalent via backward scan)
    recentIdx: index('chatwoot_conv_consumptions_recent_idx').on(
      table.workspaceId,
      table.chatwootConversationId,
      table.consumedAt
    ),
  })
)
```

> **Note:** `id` is a bare `text('id').primaryKey()` — UUID is generated at the application/SQL layer, not in the schema definition. This matches the project convention (zero uses of `$defaultFn` in the schema).

---

## Budget Check Query (Writable CTE)

This query goes directly into the PostgreSQL Execute block's `query` subblock. No stored function or extra migration needed — just the 2 tables.

```sql
WITH
recent AS (
  SELECT 1 FROM chatwoot_conversation_consumptions
  WHERE workspace_id = '<variable.WORKSPACE_ID>'
    AND chatwoot_conversation_id = CAST('<Webhook 1.conversation.id>' AS BIGINT)
    AND consumed_at > NOW() - INTERVAL '24 hours'
  LIMIT 1
),
budget AS (
  SELECT monthly_limit, is_enabled FROM workspace_budget
  WHERE workspace_id = '<variable.WORKSPACE_ID>'
),
usage AS (
  SELECT COUNT(*)::INTEGER AS used FROM chatwoot_conversation_consumptions
  WHERE workspace_id = '<variable.WORKSPACE_ID>'
    AND period_key = to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM')
),
ins AS (
  INSERT INTO chatwoot_conversation_consumptions
    (id, workspace_id, chatwoot_conversation_id, period_key, consumed_at)
  SELECT
    gen_random_uuid()::TEXT,
    '<variable.WORKSPACE_ID>',
    CAST('<Webhook 1.conversation.id>' AS BIGINT),
    to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM'),
    NOW()
  WHERE NOT EXISTS (SELECT 1 FROM recent)
    AND (SELECT is_enabled FROM budget) = TRUE
    AND (SELECT used FROM usage) < (SELECT monthly_limit FROM budget)
  RETURNING 1
)
SELECT CASE
  WHEN NOT EXISTS (SELECT 1 FROM budget) THEN TRUE   -- no config row = fail open
  WHEN (SELECT is_enabled FROM budget) = FALSE THEN TRUE  -- disabled = allow
  WHEN EXISTS (SELECT 1 FROM recent) THEN TRUE        -- active session (within 24h)
  WHEN EXISTS (SELECT 1 FROM ins) THEN TRUE           -- new session inserted
  ELSE FALSE                                          -- budget exhausted
END AS allowed
```

**How it works:**
1. `recent` — checks if this conversation had activity within the last 24h (active session → free pass)
2. `budget` — reads the workspace's limit and enabled flag
3. `usage` — counts sessions consumed this month
4. `ins` — conditionally inserts a new session row (only if not recent, enabled, and under limit)
5. Final `SELECT CASE` — returns `allowed` boolean based on all of the above

**What `allowed = false` means:** budget is exhausted. The condition block routes to the handoff function.
**What a PG error means:** DB is down, misconfigured, or `conversation.id` is missing/non-numeric (`CAST` fails). The error edge routes to the same handoff function (fail-safe).

> **Note:** `gen_random_uuid()` requires PostgreSQL 13+ (built-in) or the `pgcrypto` extension on older versions.

---

## Migration Guide

### Step 1: Add tables to `packages/db/schema.ts`

Add both Drizzle table definitions (see [Database Schema](#drizzle-typescript-for-packagesdbschemats) section) at the bottom of the file, before the last closing.

### Step 2: Generate migration

```bash
cd packages/db
bun ../../node_modules/drizzle-kit/bin.cjs generate --config=./drizzle.config.ts
```

This creates `migrations/0158_{auto_name}.sql` and updates `meta/_journal.json`. **That's the only migration needed** — no stored function migration required.

### Step 3: Apply migrations

```bash
cd packages/db
bun run db:migrate
```

### Step 4: Find workspace IDs

```sql
SELECT id, name FROM workspace ORDER BY created_at;
```

### Step 5: Seed budget config

```sql
INSERT INTO workspace_budget (id, workspace_id, monthly_limit, is_enabled)
VALUES
  (gen_random_uuid()::text, 'ws_id_here', 500, true)
ON CONFLICT (workspace_id) DO NOTHING;
```

Repeat for each workspace, adjusting `ws_id_here` and the limit.

### Step 6: Verify

```sql
-- Check tables exist
SELECT * FROM workspace_budget;
SELECT count(*) FROM chatwoot_conversation_consumptions;

-- After wiring the workflow: run it manually and check a row appears
SELECT * FROM chatwoot_conversation_consumptions ORDER BY consumed_at DESC LIMIT 5;
```

---

## Workflow Integration

### Adding the budget gate to a Chatwoot webhook workflow

Use the following 8-step sim-mcp sequence (exact subblock IDs shown):

**1. Add workspace variable**

`add_variable` — name: `WORKSPACE_ID`, type: `string`, value: the workspace's actual ID.

**2. Discover existing topology**

`get_workflow` — find the webhook trigger block ID, the first downstream block ID, and the edge ID connecting them.

**3. Disconnect webhook from first block**

`remove_edge` — remove the edge from webhook → first block.

**4. Add budget blocks and edges**

`add_blocks` — add **three blocks** and **three edges** (main path only; else-branch and error edges are added in Step 7):

- **Block 1:** `postgresql` type, name `"Budget Check"`
- **Block 2:** `condition` type, name `"Budget Gate"`
- **Block 3:** `function` type, name `"Budget Exceeded Handoff"`
- **Edge:** webhook → Budget Check
- **Edge:** Budget Check → Budget Gate
- **Edge:** Budget Gate (`sourceHandle: "condition-{gateBlockId}-if"`) → original next block

**5. Configure PostgreSQL subblocks**

| Subblock ID | Value |
|-------------|-------|
| `operation` | `"execute"` |
| `query` | See [Budget Check Query](#budget-check-query-writable-cte) section — paste the full CTE |
| `host` | DB host |
| `port` | DB port (e.g. `"5432"`) |
| `database` | DB name |
| `username` | DB user |
| `password` | DB password |
| `ssl` | `"disabled"` (for localhost) |

**6. Configure Condition subblock**

Subblock ID: `conditions`

```json
[
  { "id": "{gateBlockId}-if", "title": "if", "value": "<Budget Check.rows[0].allowed> === true" },
  { "id": "{gateBlockId}-else", "title": "else", "value": "" }
]
```

**7. Wire the Budget Exceeded Handoff block**

`add_edge` — two edges connect to the handoff block (already added in Step 4):

- **Edge:** Budget Gate (`sourceHandle: "condition-{gateBlockId}-else"`) → Budget Exceeded Handoff
- **Edge:** Budget Check (`sourceHandle: "error"`) → Budget Exceeded Handoff

Set handoff block subblocks:
- `language` → `"javascript"`
- `code` → see below

> **⚠️ Env vars are workspace-specific. Substitute before wiring:**
>
> | Workspace | Bot Token Var | Base URL Var |
> |-----------|---------------|--------------|
> | Kamatas | `{{KAMATAS_BOT_TOKEN}}` | `{{RAVEN_URL}}` |
> | Artiron | `{{ARTIRON_BOT_TOKEN}}` | `{{ARTIRON_URL}}` |

```javascript
const accountId = <Webhook 1.account.id>;
const conversationId = <Webhook 1.conversation.id>;
const apiToken = '{{KAMATAS_BOT_TOKEN}}';   // ← replace per workspace
const baseUrl = '{{RAVEN_URL}}' + '/api/v1'; // ← replace per workspace
const basePath = '/accounts/' + accountId + '/conversations/' + conversationId;

const res = await fetch(baseUrl + basePath + '/toggle_status', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Api-Access-Token': apiToken },
  body: JSON.stringify({ status: 'open' })
});

return { ok: res.ok, status: res.status };
```

**8. Verify**

`get_workflow` — confirm the full chain, including **all three** paths:
- Main path: Webhook → Budget Check → Budget Gate (`-if`) → rest of workflow
- Budget exceeded: Budget Gate (`-else`) → Budget Exceeded Handoff
- DB error: Budget Check (error edge) → Budget Exceeded Handoff

### Key reference values

| Item | Value |
|------|-------|
| PG block operation | `"execute"` |
| PG output tag | `<Budget Check.rows[0].allowed>` |
| Variable syntax | `<variable.WORKSPACE_ID>` (NOT `{{WORKSPACE_ID}}`) |
| SSL for localhost | `"disabled"` |
| sourceHandle (true) | `"condition-{blockId}-if"` |
| sourceHandle (false) | `"condition-{blockId}-else"` |
| sourceHandle (error) | `"error"` |

> **⚠️ Important:** The webhook trigger block's display name must match the tag. If the block is named `"Webhook 1"`, use `<Webhook 1.conversation.id>`. Verify with `get_workflow` before wiring.

---

## Operations Quick Reference

### Check current month usage for a workspace

```sql
SELECT
  wb.monthly_limit,
  wb.is_enabled,
  COALESCE(COUNT(c.id), 0) AS used,
  wb.monthly_limit - COALESCE(COUNT(c.id), 0) AS remaining
FROM workspace_budget wb
LEFT JOIN chatwoot_conversation_consumptions c
  ON c.workspace_id = wb.workspace_id
  AND c.period_key = to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM')
WHERE wb.workspace_id = 'ws_xxx'
GROUP BY wb.monthly_limit, wb.is_enabled;
```

### View all workspaces: usage vs limit

```sql
SELECT
  w.name,
  wb.monthly_limit,
  wb.is_enabled,
  COALESCE(usage.used, 0) AS used,
  wb.monthly_limit - COALESCE(usage.used, 0) AS remaining
FROM workspace_budget wb
JOIN workspace w ON w.id = wb.workspace_id
LEFT JOIN (
  SELECT workspace_id, COUNT(*) AS used
  FROM chatwoot_conversation_consumptions
  WHERE period_key = to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM')
  GROUP BY workspace_id
) usage ON usage.workspace_id = wb.workspace_id
ORDER BY w.name;
```

### Change monthly limit

```sql
UPDATE workspace_budget
SET monthly_limit = 200, updated_at = now()
WHERE workspace_id = 'ws_xxx';
```

### Disable budget enforcement (testing / emergency bypass)

```sql
UPDATE workspace_budget SET is_enabled = false WHERE workspace_id = 'ws_xxx';
```

### Re-enable budget enforcement

```sql
UPDATE workspace_budget SET is_enabled = true WHERE workspace_id = 'ws_xxx';
```

### Reset current month (e.g., after testing)

```sql
DELETE FROM chatwoot_conversation_consumptions
WHERE workspace_id = 'ws_xxx'
  AND period_key = to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM');
```

### View full usage history by month

```sql
SELECT period_key, COUNT(*) AS conversations
FROM chatwoot_conversation_consumptions
WHERE workspace_id = 'ws_xxx'
GROUP BY period_key
ORDER BY period_key DESC;
```

### Debug: find a specific conversation

```sql
SELECT * FROM chatwoot_conversation_consumptions
WHERE chatwoot_conversation_id = 12345;
```

---

## Design Decisions

| Decision | Alternative | Why this |
|----------|-------------|----------|
| PostgreSQL block in workflow | Modify `route.ts` / executor | Zero source changes → survives rebases, upstream merges |
| Writable CTE (no stored function) | Stored function with `FOR UPDATE` | No extra migration for function; logic visible in workflow block; minor race condition (1-2 token over-spend) acceptable for single-operator low-volume setup |
| Error edge → handoff | Fail-open (ignore DB errors) | DB errors open the conversation for a human agent instead of silently dropping it |
| `is_enabled` column | `toggle_block_enabled` MCP call | `toggle_block_enabled` severs the DAG — all downstream blocks become unreachable. `is_enabled` lets the CTE short-circuit without changing workflow topology |
| `period_key TEXT 'YYYY-MM'` | `DATE` column / partition | Human-readable, simple equality checks, trivial to generate with `to_char()`, no date arithmetic needed |
| Session-based counting (24h window) | Count per-message / count once per period | Each conversation session costs 1 token. Re-engagement after 24h idle counts as a new session (new token) |
| 2 tables, no audit log | 3rd audit/history table | Consumptions table IS the history — rows accumulate, never deleted. `updated_at` on `workspace_budget` shows when limits changed |
| Budget exceeded → open conversation | Dead-end / Response block | Response block has `singleInstance: true` — can't add a second one. Function block calls `/toggle_status → open` to hand conversation to a human agent |
