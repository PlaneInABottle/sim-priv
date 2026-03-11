# Budget Refactor: Remove Monthly Period → Flat Conversation Quota

## Problem Statement

The conversation budget system uses a monthly-reset model (`period_key = 'YYYY-MM'`). This is wrong: conversations should count against a flat total limit that depletes indefinitely with no automatic reset. The operator sets a `conversation_limit`; usage is the all-time count of unique consumed conversations.

## Approach

Rename column, drop period column, update CTE and UPSERT workflows. All changes are safe — production tables are empty.

## Success Criteria

- [ ] Migration `0159` applies cleanly on production
- [ ] Drizzle schema reflects `conversationLimit` (renamed), no `periodKey`
- [ ] Kamatas PROD CTE counts all-time consumptions (no period filter)
- [ ] `ins` INSERT no longer writes `period_key`
- [ ] `budget` CTE reads `conversation_limit` (not `monthly_limit`)
- [ ] "Update Workspace Budget" workflow uses `conversation_limit` in SQL
- [ ] Fail-open behavior preserved (no budget row → allowed = TRUE)
- [ ] 24h dedup preserved — same conversation within 24h is not double-charged

---

## Current State (Evidence)

### Drizzle Schema — `packages/db/schema.ts`

- **`workspaceBudget`** (lines 2411–2424): `monthlyLimit` column (integer, default 100)
- **`chatwootConversationConsumptions`** (lines 2430–2455): `periodKey` column (text, not null)
- **Indexes** (lines 2442–2454):
  - `chatwoot_conv_consumptions_workspace_period_idx` on `(workspace_id, period_key)` — useless without period
  - `chatwoot_conv_consumptions_recent_idx` on `(workspace_id, chatwoot_conversation_id, consumed_at)`
- **No UNIQUE constraint** on consumptions table currently (despite problem statement mentioning one)

### Migration — `packages/db/migrations/0158_numerous_king_cobra.sql`

- Creates both tables, FKs, and two indexes. No UNIQUE on consumptions columns.

### Kamatas PROD Workflow — `98c363ef-febc-42cc-82d2-d40b501c5b56`

- Block `3b8fdfa3-2b40-4894-b152-49cdac832312` (name: `budgetCheck`, type: `postgresql`)
- Subblock `query` contains the writable CTE with `monthly_limit`, `period_key`, and 24h `recent` dedup

### Update Workspace Budget Workflow — `b19436e5-87ae-4001-ae94-341f6fc778d1`

- Block `pg_block` (name: `Budget Upsert`, type: `postgresql`)
- Subblock `query` has UPSERT referencing `monthly_limit` and `<Start.monthly_limit>`
- Block `starter_block` has empty `inputFormat` (API caller sends fields directly)

### Key Design Decision: `period_key`

**Decision: DROP the column entirely.**
- Production table has **zero rows** — no data loss
- `consumed_at` timestamp already provides temporal information for any future audit
- Keeping it nullable adds dead code and confuses future developers
- The `workspace_period_idx` index becomes useless without the column

### Key Design Decision: `recent` CTE — Keep 24h Dedup

**Decision: Keep the 24h dedup window unchanged.**

The `recent` CTE checks if the same conversation was consumed within the last 24 hours. This prevents multiple charges for a single active conversation session (a customer might send 10 messages in one day — that's 1 token, not 10). After 24h, the same conversation CAN generate another charge if the customer writes again.

This means:
- `UNIQUE(workspace_id, chatwoot_conversation_id)` lifetime constraint — **NOT added**
- `recent_idx` on `(workspace_id, chatwoot_conversation_id, consumed_at)` — **KEPT** (needed for 24h lookup)
- Same conversation = multiple rows across different 24h windows → correct behavior

---

## Phase 1: Database Migration

**Owner**: @implementer (database)
**Dependencies**: None
**Complexity**: LOW

### Tasks

- [ ] **Task 1.1**: Create migration file `packages/db/migrations/0159_budget_refactor_remove_monthly_period.sql`
- [ ] **Task 1.2**: Write migration SQL (details below)
- [ ] **Task 1.3**: Verify migration applies cleanly with `bun run db:migrate` (or equivalent)

### Migration SQL

```sql
-- 1. Rename monthly_limit → conversation_limit in workspace_budget
ALTER TABLE "workspace_budget" RENAME COLUMN "monthly_limit" TO "conversation_limit";

-- 2. Drop the period-based index (references period_key which we're dropping)
DROP INDEX IF EXISTS "chatwoot_conv_consumptions_workspace_period_idx";

-- 3. Drop the period_key column from chatwoot_conversation_consumptions
ALTER TABLE "chatwoot_conversation_consumptions" DROP COLUMN "period_key";

-- 4. Add index on workspace_id for fast all-time COUNT(*) queries
CREATE INDEX "chatwoot_conv_consumptions_workspace_idx"
  ON "chatwoot_conversation_consumptions" USING btree ("workspace_id");
```

**Why keep `recent_idx`**: The `recent` CTE queries `(workspace_id, chatwoot_conversation_id, consumed_at)` for the 24h window — this index is still needed and must NOT be dropped.

**Why NO UNIQUE constraint**: A conversation can be charged multiple times — once per 24h activity window. Lifetime uniqueness would incorrectly block re-charges after 24h.

### Acceptance Criteria

- [ ] Migration file exists at correct path with correct name
- [ ] `workspace_budget` table has `conversation_limit` column (not `monthly_limit`)
- [ ] `chatwoot_conversation_consumptions` table has no `period_key` column
- [ ] Index `chatwoot_conv_consumptions_workspace_idx` exists on `(workspace_id)`
- [ ] Old index `workspace_period_idx` is dropped
- [ ] `recent_idx` on `(workspace_id, chatwoot_conversation_id, consumed_at)` is preserved
- [ ] NO lifetime UNIQUE constraint added to consumptions table
- [ ] Migration is idempotent-safe (uses `IF EXISTS` for drops)

### Files

| Action | File |
|--------|------|
| Create | `packages/db/migrations/0159_budget_refactor_remove_monthly_period.sql` |

---

## Phase 2: Drizzle Schema Update

**Owner**: @implementer (database)
**Dependencies**: Phase 1
**Complexity**: LOW

### Tasks

- [ ] **Task 2.1**: In `packages/db/schema.ts`, rename `monthlyLimit` → `conversationLimit` (line 2419)
  - Change: `monthlyLimit: integer('monthly_limit').notNull().default(100)` → `conversationLimit: integer('conversation_limit').notNull().default(100)`
- [ ] **Task 2.2**: Remove `periodKey` field from `chatwootConversationConsumptions` (line 2438)
  - Delete: `periodKey: text('period_key').notNull(), // Format: 'YYYY-MM'`
- [ ] **Task 2.3**: Update comment on `workspaceBudget` (line 2408)
  - Change: `// [budget-system] Per-workspace monthly AI conversation limit.` → `// [budget-system] Per-workspace flat AI conversation limit (no monthly reset).`
- [ ] **Task 2.4**: Update comment on `chatwootConversationConsumptions` (lines 2426–2429)
  - Replace with: `// [budget-system] One row per 24h conversation session consumed. No UNIQUE constraint by design — same conversation can be charged again after 24h. See docs/conversation-budget-system.md.`
- [ ] **Task 2.5**: Update index definitions in the table's third argument (lines 2442–2454)
  - Remove `workspacePeriodIdx` (references dropped `periodKey`)
  - Keep `recentIdx` on `(workspaceId, chatwootConversationId, consumedAt)` — still needed for 24h lookup
  - Add `workspaceIdx: index('chatwoot_conv_consumptions_workspace_idx').on(table.workspaceId)` for fast COUNT queries
  - Do NOT add any unique constraint
- [ ] **Task 2.6**: Verify `bun run db:generate` does NOT produce a new migration (schema matches migration state)

### Acceptance Criteria

- [ ] `monthlyLimit` → `conversationLimit` renamed in schema
- [ ] `periodKey` field removed from consumptions table
- [ ] Comments updated to reflect flat quota model
- [ ] `workspacePeriodIdx` removed, `recentIdx` kept, `workspaceIdx` added
- [ ] No lifetime UNIQUE constraint in schema
- [ ] `bun run db:generate` is clean (no diff)

### Files

| Action | File |
|--------|------|
| Edit | `packages/db/schema.ts` (lines 2408–2455) |

---

## Phase 3: Update Kamatas PROD CTE Query (via MCP)

**Owner**: @implementer (workflow)
**Dependencies**: Phase 1 (migration must be applied first)
**Complexity**: MEDIUM

### Tasks

- [ ] **Task 3.1**: Update subblock `query` on block `3b8fdfa3-2b40-4894-b152-49cdac832312` in workflow `98c363ef-febc-42cc-82d2-d40b501c5b56`
- [ ] **Task 3.2**: Use `sim-mcp-update_subblock` with the new CTE (below)
- [ ] **Task 3.3**: Execute workflow with test data to verify `allowed = TRUE` (no budget row → fail-open)

### New CTE Query

**CRITICAL**: The value must use real newlines, not `\n` escape sequences.

```sql
WITH
recent AS (
  SELECT 1 FROM chatwoot_conversation_consumptions
  WHERE workspace_id = '<variable.WORKSPACE_ID>'
    AND chatwoot_conversation_id = CAST('<webhook.conversation.id>' AS BIGINT)
    AND consumed_at > NOW() - INTERVAL '24 hours'
  LIMIT 1
),
budget AS (
  SELECT conversation_limit, is_enabled FROM workspace_budget
  WHERE workspace_id = '<variable.WORKSPACE_ID>'
),
usage AS (
  SELECT COUNT(*)::INTEGER AS used FROM chatwoot_conversation_consumptions
  WHERE workspace_id = '<variable.WORKSPACE_ID>'
),
ins AS (
  INSERT INTO chatwoot_conversation_consumptions
    (id, workspace_id, chatwoot_conversation_id, consumed_at)
  SELECT
    gen_random_uuid()::TEXT,
    '<variable.WORKSPACE_ID>',
    CAST('<webhook.conversation.id>' AS BIGINT),
    NOW()
  WHERE NOT EXISTS (SELECT 1 FROM recent)
    AND (SELECT is_enabled FROM budget) = TRUE
    AND (SELECT used FROM usage) < (SELECT conversation_limit FROM budget)
  RETURNING 1
)
SELECT CASE
  WHEN NOT EXISTS (SELECT 1 FROM budget) THEN TRUE
  WHEN (SELECT is_enabled FROM budget) = FALSE THEN TRUE
  WHEN EXISTS (SELECT 1 FROM recent) THEN TRUE
  WHEN EXISTS (SELECT 1 FROM ins) THEN TRUE
  ELSE FALSE
END AS allowed
```

### Changes from current CTE (diff summary)

| CTE | Old | New |
|-----|-----|-----|
| `recent` | 24h time-bounded check | **Unchanged** — still 24h dedup |
| `budget` | Selects `monthly_limit` | Selects `conversation_limit` |
| `usage` | Filters by `period_key = to_char(NOW()...)` | No period filter — counts **all** rows for workspace |
| `ins` INSERT | Includes `period_key` column and value | Removes `period_key` column only |
| `ins` WHERE | Checks `< monthly_limit` | Checks `< conversation_limit` |
| Final CASE | Unchanged | Unchanged |

### MCP Tool Call

```
Tool: sim-mcp-update_subblock
Params:
  workflowId: "98c363ef-febc-42cc-82d2-d40b501c5b56"
  blockId: "3b8fdfa3-2b40-4894-b152-49cdac832312"
  subblockId: "query"
  value: <the full CTE SQL above, as a multi-line string>
```

### Acceptance Criteria

- [ ] CTE counts all-time consumptions (no `period_key` filter in `usage`)
- [ ] INSERT does not include `period_key` column
- [ ] `budget` CTE reads `conversation_limit`
- [ ] `recent` 24h dedup preserved unchanged
- [ ] Fail-open: no budget row → `allowed = TRUE`
- [ ] Workflow executes successfully with test webhook payload

### Files

| Action | Resource |
|--------|----------|
| MCP Update | Workflow `98c363ef-...`, block `3b8fdfa3-...`, subblock `query` |

---

## Phase 4: Update "Update Workspace Budget" Workflow (via MCP)

**Owner**: @implementer (workflow)
**Dependencies**: Phase 1 (migration must be applied first)
**Complexity**: LOW

### Tasks

- [ ] **Task 4.1**: Update subblock `query` on block `pg_block` in workflow `b19436e5-87ae-4001-ae94-341f6fc778d1`
- [ ] **Task 4.2**: Use `sim-mcp-update_subblock` with the new UPSERT SQL (below)
- [ ] **Task 4.3**: Execute workflow with test data (`conversation_limit: 200, is_enabled: true`) to verify UPSERT works

### New UPSERT SQL

```sql
INSERT INTO workspace_budget (id, workspace_id, conversation_limit, is_enabled)
VALUES (
  gen_random_uuid()::TEXT,
  '<variable.WORKSPACE_ID>',
  CAST('<Start.conversation_limit>' AS INTEGER),
  CAST('<Start.is_enabled>' AS BOOLEAN)
)
ON CONFLICT (workspace_id)
DO UPDATE SET
  conversation_limit = EXCLUDED.conversation_limit,
  is_enabled = EXCLUDED.is_enabled,
  updated_at = NOW()
RETURNING workspace_id, conversation_limit, is_enabled
```

### Changes from current SQL

| Element | Old | New |
|---------|-----|-----|
| Column name | `monthly_limit` | `conversation_limit` |
| Input reference | `<Start.monthly_limit>` | `<Start.conversation_limit>` |
| RETURNING clause | `monthly_limit` | `conversation_limit` |

### MCP Tool Call

```
Tool: sim-mcp-update_subblock
Params:
  workflowId: "b19436e5-87ae-4001-ae94-341f6fc778d1"
  blockId: "pg_block"
  subblockId: "query"
  value: <the full UPSERT SQL above, as a multi-line string>
```

### Acceptance Criteria

- [ ] SQL references `conversation_limit` (not `monthly_limit`)
- [ ] Input reference is `<Start.conversation_limit>`
- [ ] RETURNING clause uses `conversation_limit`
- [ ] Workflow executes successfully, returns correct values

### Files

| Action | Resource |
|--------|----------|
| MCP Update | Workflow `b19436e5-...`, block `pg_block`, subblock `query` |

---

## Phase 5: Update Documentation

**Owner**: @implementer (docs)
**Dependencies**: Phases 1–4
**Complexity**: LOW

### Tasks

- [ ] **Task 5.1**: Update `docs/conversation-budget-system.md` — replace all `monthly_limit` references with `conversation_limit`, remove period_key references, update CTE examples
- [ ] **Task 5.2**: Update `docs/budget-check-kamatas-prod.md` — update CTE SQL, note the refactor date

### Acceptance Criteria

- [ ] No references to `monthly_limit` or `period_key` remain in docs
- [ ] CTE examples match the new query

### Files

| Action | File |
|--------|------|
| Edit | `docs/conversation-budget-system.md` |
| Edit | `docs/budget-check-kamatas-prod.md` |

---

## Deliverables

| Phase | Files Created/Modified |
|-------|----------------------|
| Phase 1 | `packages/db/migrations/0159_budget_refactor_remove_monthly_period.sql` (create) |
| Phase 2 | `packages/db/schema.ts` (edit lines 2408–2455) |
| Phase 3 | MCP: Workflow `98c363ef-...`, block `3b8fdfa3-...` subblock `query` |
| Phase 4 | MCP: Workflow `b19436e5-...`, block `pg_block` subblock `query` |
| Phase 5 | `docs/conversation-budget-system.md`, `docs/budget-check-kamatas-prod.md` |

## Execution Order

```
Phase 1 (migration) → Phase 2 (schema) → Phase 3 (CTE) + Phase 4 (UPSERT) [parallel] → Phase 5 (docs)
```

**Important**: Phases 3 and 4 MUST run AFTER Phase 1 migration is applied to production, because the SQL references column names that only exist after migration.

## Review Gates

| Gate | After Phase | Focus Area |
|------|-------------|------------|
| **Gate 1** | Phase 2 | @analyzer — verify schema matches migration; `db:generate` produces no diff |
| **Gate 2** | Phase 3+4 | @analyzer — execute both workflows with test data; verify `allowed` logic |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Migration fails on production | LOW (tables empty) | MEDIUM | `IF EXISTS` on drops; test locally first |
| CTE `\n` escaping in MCP call | MEDIUM (known gotcha) | HIGH (query breaks) | Use multi-line string literal, verify by re-reading block after update |
| Schema drift (Drizzle generates extra migration) | LOW | LOW | Run `db:generate` after schema edit; adjust if drift detected |
| Workflow not redeployed after update | MEDIUM | HIGH (old CTE still active) | Redeploy Kamatas PROD workflow after Phase 3 |

## Rollback

If rollback is needed (unlikely — tables are empty):

```sql
-- Reverse migration
ALTER TABLE "workspace_budget" RENAME COLUMN "conversation_limit" TO "monthly_limit";
ALTER TABLE "chatwoot_conversation_consumptions" ADD COLUMN "period_key" TEXT;
DROP INDEX IF EXISTS "chatwoot_conv_consumptions_workspace_idx";
CREATE INDEX "chatwoot_conv_consumptions_workspace_period_idx"
  ON "chatwoot_conversation_consumptions" USING btree ("workspace_id", "period_key");
```

## Notes

- **NO** "reset consumption history" feature (out of scope)
- **NO** UI changes to Sim Studio
- **NO** new tables or columns beyond the rename
- The `workflow_execution_id` column stays (nullable, reserved for future tracing)
- The `recent` CTE's 24h dedup prevents double-charging within a single activity window; the same conversation CAN generate a new charge after 24h
- After Phase 3, the Kamatas PROD workflow **must be redeployed** for the new CTE to take effect on live webhook traffic
