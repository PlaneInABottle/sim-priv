---
name: billing-essentials
description: "Complete guide to Sim Studio's billing and usage tracking system. Use when working on: (1) cost calculation and token extraction, (2) subscription and plan management, (3) usage limits and overage billing, (4) Stripe integration, (5) usage monitoring UI, or (6) billing-related bugs and features. Covers Cloud and self-hosted deployments identically—cost tracking is always on regardless of billing enforcement flags."
---

# Billing Essentials

## Quick Start

Sim Studio's billing system has three layers:

1. **Token & Cost Calculation** - Every LLM call extracts input/output tokens and calculates cost using the formula: `Cost = (inputTokens × inputPrice/1M) + (outputTokens × outputPrice/1M)`
2. **Usage Tracking** - Current period cost stored in `userStats.currentPeriodCost`; all usage logged to `usageLog` table
3. **Limits & Enforcement** - Optional per-user and per-org budget limits; warnings at 80%, blocks at 100%
4. **Overage Billing** - When users exceed limit, unbilled overage tracked; auto-invoiced via Stripe at $50 threshold

**Key principle:** Cost tracking is ALWAYS ON. Billing enforcement (limits, charges, Stripe) is controlled by `BILLING_ENABLED` flag.

## Core Concepts

### Cost Calculation Formula

```
Cost = (inputTokens × (inputPrice / 1,000,000)) + (outputTokens × (outputPrice / 1,000,000))
```

All prices stored as "per 1 million tokens". Results rounded to 8 decimal places.

**Location:** `providers/utils.ts:478-524` (calculateCost function) and `providers/models.ts:106-1635` (100+ model pricing definitions)

**Example:**
- GPT-4o: input=$0.005/1M, output=$0.015/1M
- Using 1000 input tokens + 500 output tokens:
  - Input cost: (1000 × 0.005/1M) = $0.000005
  - Output cost: (500 × 0.015/1M) = $0.0000075
  - Total: $0.0000125 (~$0.00)

### Feature Flags

Two independent flags control behavior:

**`isBillingEnabled`** (`BILLING_ENABLED` env var)
- Controls: Enforcement of limits, overage billing, Stripe integration
- Affects: Nothing about cost calculation (always happens)
- Default: `true` (Cloud), `false` (self-hosted)

**`isHosted`** (determined by URL)
- Cloud: `https://www.sim.ai`
- Self-hosted: Any other URL
- Affects: Feature availability, UI behavior

**Golden rule:** Cost tracking happens identically in Cloud and self-hosted. The difference is enforcement—self-hosted can disable billing entirely.

### Subscription Hierarchy

Four tiers with best plan winning:

**Enterprise > Team > Pro > Free**

**Location:** `lib/billing/core/subscription.ts`

| Plan | Base Cost | Cost Limit | Seats | Overage |
|---|---|---|---|---|
| Free | $0 | $20 | N/A | Credit-based |
| Pro | $20/mo | $20 | N/A | Auto-billed at $50 |
| Team | $40/seat/mo | $40/seat | Custom | Pooled org overage |
| Enterprise | Custom | Custom | Custom | Custom |

**getHighestPrioritySubscription(userId)** returns the best subscription from personal account or any org memberships.

## Implementation Details

Read `references/fundamentals.md` for:
- Token extraction process with provider-specific tokenization
- Complete environment variable reference
- Cloud vs self-hosted comparison
- Subscription state structure and organization pooling

Read `references/implementation.md` for:
- Usage limit system with thresholds (80% warning, 100% blocked)
- Overage calculation and $50 threshold auto-invoicing mechanism
- Stripe integration with 30+ endpoint wrappers
- Complete webhook handler list and payment flows
- Month-end billing and invoice finalization

## Common Tasks

### Understanding Cost Calculation

1. Find the model in `providers/models.ts` (e.g., `gpt-4o`)
2. Extract `inputPrice` and `outputPrice` (per 1M tokens)
3. Get token counts from LLM response (via tokenization library)
4. Apply formula: `(input × inputPrice/1M) + (output × outputPrice/1M)`
5. Cost stored in `workflow_execution_logs.cost` column (if logged)

### Debugging Usage Limits

1. Check user's subscription: `getHighestPrioritySubscription(userId)`
2. Get current usage: `getUserUsageData(userId)` → `currentPeriodCost`
3. Get limit: `getUserUsageLimit(userId)` or subscription base
4. Check status: `checkUsageStatus(userId)` → returns `isWarning`, `isExceeded`
5. If team member, also check org limits: `getOrgUsageLimit(orgId)`

### Handling Overage Billing

1. When user exceeds limit by $50+: `checkAndBillOverageThreshold()` auto-triggers
2. Creates Stripe invoice item for overage
3. Finalizes invoice (charges payment method on file)
4. Webhook `invoice.finalized` → `handleInvoiceFinalized()`
5. Calculates and marks overage as billed in `userStats.billedOverageThisPeriod`

### Configuring Self-Hosted Billing

**To enable billing (Stripe + limits):**
```bash
BILLING_ENABLED=true
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
FREE_TIER_COST_LIMIT=20
PRO_TIER_COST_LIMIT=20
TEAM_TIER_COST_LIMIT=40
ENTERPRISE_TIER_COST_LIMIT=200
```

**To keep cost tracking but disable enforcement (self-hosted reference pricing):**
```bash
BILLING_ENABLED=false
# Costs still calculated, limits not enforced
# Billing UI hidden from users
```

**To completely disable billing:**
```bash
BILLING_ENABLED=false
# Can also delete Stripe environment variables
```

## Data Storage

**Cost stored in two tables:**

1. **`usageLog`** - Per-transaction detailed log (only if `BILLING_ENABLED=true`)
   - Tracks: category (model/fixed), source (workflow/wand/copilot), inputTokens, outputTokens, cost
   - Used for: Historical analysis, per-transaction breakdown

2. **`userStats`** - Per-user aggregated current period
   - Tracks: `currentPeriodCost`, `currentUsageLimit`, `creditBalance`, `billingBlocked`
   - Used for: Real-time limit enforcement, UI display

**Note:** Cost calculation and storage in `workflow_execution_logs` happens regardless of `BILLING_ENABLED` flag. Usage aggregation is the difference.

## Architecture Overview

```
Workflow Execution
  ↓
Extract tokens (inputTokens, outputTokens) via tokenization library
  ↓
Lookup model pricing (provider-specific rates from models.ts)
  ↓
Calculate cost: (input × inputPrice/1M) + (output × outputPrice/1M)
  ↓
Store in workflow_execution_logs.cost
  ↓
(If BILLING_ENABLED=true) Log to usageLog + update userStats.currentPeriodCost
  ↓
Check limit: checkUsageStatus() → isWarning (80%), isExceeded (100%)
  ↓
(If exceeded) Block execution + set billingBlocked=true
  ↓
(If unbilled overage ≥ $50) checkAndBillOverageThreshold() → Create Stripe invoice
  ↓
Webhook: invoice.finalized → Calculate final overage → Mark as billed
  ↓
Display in UI: usage-indicator (pill), usage-header ($X/$limit), cost breakdown in log details
```

## Files Reference

### Core Billing
- **Configuration:** `lib/core/config/feature-flags.ts`, `lib/core/config/env.ts`
- **Subscription:** `lib/billing/core/subscription.ts`
- **Cost Calculation:** `lib/tokenization/calculators.ts`, `providers/utils.ts`, `providers/models.ts`
- **Usage Tracking:** `lib/billing/core/usage.ts`, `lib/billing/core/usage-log.ts`
- **Limits:** `lib/billing/calculations/usage-monitor.ts`
- **Overage:** `lib/billing/threshold-billing.ts`, `lib/billing/core/billing.ts`

### Stripe Integration
- **Client:** `lib/billing/stripe-client.ts`
- **Tools:** `tools/stripe/` (30+ endpoint wrappers)
- **Webhooks:** `lib/billing/webhooks/` (subscription.ts, invoices.ts, disputes.ts)

### UI
- **Components:** `sidebar/components/{usage-indicator,usage-header,subscription}/`
- **Hooks:** `hooks/use-subscription-state.ts`, `hooks/use-billing-state.ts`
- **API:** `app/api/{billing,usage}/`

### Database
- **Schema:** `packages/db/schema.ts` lines 666-850 (userStats, subscription, usageLog, organization)
