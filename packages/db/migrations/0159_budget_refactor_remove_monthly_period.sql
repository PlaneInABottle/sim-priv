-- 1. Rename monthly_limit → conversation_limit in workspace_budget
ALTER TABLE "workspace_budget" RENAME COLUMN "monthly_limit" TO "conversation_limit";

-- 2. Drop the period-based index (references period_key which we're dropping)
DROP INDEX IF EXISTS "chatwoot_conv_consumptions_workspace_period_idx";

-- 3. Drop the period_key column from chatwoot_conversation_consumptions
ALTER TABLE "chatwoot_conversation_consumptions" DROP COLUMN "period_key";

-- 4. Add index on workspace_id for fast all-time COUNT(*) queries
CREATE INDEX "chatwoot_conv_consumptions_workspace_idx"
  ON "chatwoot_conversation_consumptions" USING btree ("workspace_id");
