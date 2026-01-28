# Billing Fundamentals

## Table of Contents
1. [Token Extraction & Cost Calculation](#token-extraction--cost-calculation)
2. [Feature Flags & Configuration](#feature-flags--configuration)
3. [Subscription Hierarchy & Plan Logic](#subscription-hierarchy--plan-logic)

---

## Token Extraction & Cost Calculation

### Overview
Every LLM call extracts token counts (input/output) and converts them to costs. This calculation is identical across Cloud and self-hosted deployments.

### Cost Calculation Formula

```
Cost = (inputTokens × (inputPrice / 1,000,000)) + (outputTokens × (outputPrice / 1,000,000))
```

- Prices stored as "per 1 million tokens"
- Results rounded to 8 decimal places for precision
- Formula applies identically in all deployments

### Token Extraction Process

**Location:** `/apps/sim/lib/tokenization/`

**Key files:**
- `calculators.ts` - `calculateStreamingCost()` - estimates cost from tokens
- `estimators.ts` - token counting per provider (OpenAI, Anthropic, etc.)
- `constants.ts` - provider-specific tokenization configs and fallbacks

**Extraction flow:**
```
LLM Response
  ↓
Extract inputTokens + outputTokens (via tokenization library)
  ↓
Lookup model pricing (provider-specific rates)
  ↓
Apply formula: (input × inputPrice/1M) + (output × outputPrice/1M)
  ↓
Result: CostBreakdown { input: $X, output: $Y, total: $Z }
```

### Provider Pricing

**Location:** `/apps/sim/providers/models.ts` (lines 106-1635)

Contains 100+ model definitions with pricing. Example structure:

```typescript
{
  id: 'gpt-4o',
  name: 'GPT-4o',
  inputPrice: 0.005,      // $0.005 per 1M tokens
  outputPrice: 0.015,     // $0.015 per 1M tokens
  streaming: true,
  cacheInputPrice: 0.0025 // 50% of input price when cached
}
```

### Special Cases

**Prompt Caching:** If `useCachedInput=true`, uses `cachedInput` price (typically 50% of input price)

**Fallback Pricing:** If model not found, defaults to:
- Input: $1/1M tokens
- Output: $5/1M tokens

**Cost Multipliers:** Optional org/team pricing adjustments via `getCostMultiplier()` in `feature-flags.ts`

### Base Execution Charge

Every workflow execution incurs a base charge (applied once per execution):
```typescript
BASE_EXECUTION_CHARGE = 0.001  // $0.001 per execution
```

This is separate from token costs.

---

## Feature Flags & Configuration

### Overview
Two independent feature flags control billing behavior:
- `isBillingEnabled` - Controls enforcement (limits, charges, overage billing)
- `isHosted` - Determines if Cloud or self-hosted deployment

**Key principle:** Cost tracking is ALWAYS ON. Billing enforcement is OPTIONAL.

### Feature Flags

**Location:** `/apps/sim/lib/core/config/feature-flags.ts`

**`isBillingEnabled`** (line 31)
```typescript
isBillingEnabled = isTruthy(env.BILLING_ENABLED)
```
- Controls: Enforcement of usage limits, overage billing, Stripe integration
- Default in Cloud: `true`
- Default in self-hosted: `false`
- Behavior: Cost calculation and storage happens regardless; limit enforcement depends on this flag

**`isHosted`** (determined by URL)
```typescript
isHosted = NEXT_PUBLIC_APP_URL.includes('sim.ai')
```
- Cloud URL: `https://www.sim.ai` or staging URL
- Self-hosted: any other URL
- Affects: Feature availability, UI behavior, billing UI visibility

### Environment Variables

**Location:** `/apps/sim/lib/core/config/env.ts`

| Variable | Type | Purpose | Default |
|---|---|---|---|
| `BILLING_ENABLED` | boolean | Master switch for billing enforcement | `false` |
| `NEXT_PUBLIC_BILLING_ENABLED` | boolean | Client-side billing UI gating | `false` |
| `STRIPE_SECRET_KEY` | string | Stripe API key (required if BILLING_ENABLED=true) | - |
| `STRIPE_WEBHOOK_SECRET` | string | Stripe webhook verification | - |
| `FREE_TIER_COST_LIMIT` | number | Free plan budget | `$20` |
| `PRO_TIER_COST_LIMIT` | number | Pro plan budget | `$20` |
| `TEAM_TIER_COST_LIMIT` | number | Team plan budget per seat | `$40` |
| `ENTERPRISE_TIER_COST_LIMIT` | number | Enterprise plan budget | `$200` |
| `OVERAGE_THRESHOLD_DOLLARS` | number | Auto-invoice threshold | `$50` |
| `COST_MULTIPLIER` | number | Pricing multiplier (1.0 = no change) | `1.0` |

### Cloud vs Self-Hosted Differences

| Aspect | Cloud (www.sim.ai) | Self-Hosted |
|---|---|---|
| `isHosted` | `true` | `false` |
| `isBillingEnabled` | Typically `true` | Configurable (env) |
| Token tracking | Always on | Always on |
| Token display | Always shown | Always shown (ungated) |
| Billing UI | Stripe subscription enforced | Optional, reference pricing only |
| Usage limits | Enforced | Optional |
| Overage charges | Automatic (Stripe) | Optional (threshold-based) |
| Auth required | Yes (blocked) | Optional |

**Key insight:** All data is tracked identically. The difference is enforcement—self-hosted can run without billing infrastructure entirely.

---

## Subscription Hierarchy & Plan Logic

### Overview
Sim Studio supports a 4-tier subscription model: Free, Pro, Team, Enterprise.

**Key principle:** Enterprise > Team > Pro > Free (best plan wins)

### Plan Tiers

**Location:** `/apps/sim/lib/billing/core/subscription.ts`

**Free Plan**
- Cost limit: $20 (FREE_TIER_COST_LIMIT)
- Seats: N/A (individual)
- Billing: Credit-based (pre-paid)
- Overage: Not allowed (soft limit)

**Pro Plan**
- Cost limit: $20 (PRO_TIER_COST_LIMIT)
- Seats: N/A (individual)
- Billing: Monthly subscription + overage
- Overage: Auto-billed at $50 threshold

**Team Plan**
- Cost limit: $40 × seats (TEAM_TIER_COST_LIMIT per seat)
- Seats: Configurable (tracked in `subscription.seats`)
- Billing: Monthly × seats + pooled org overage
- Usage pooling: All team members share org budget
- Min billing: (base price × seats) regardless of usage

**Enterprise Plan**
- Cost limit: $200 (ENTERPRISE_TIER_COST_LIMIT)
- Seats: Configurable
- Billing: Fixed monthly cost (stored in `subscription.metadata.monthlyPrice`)
- Usage pooling: All org members share budget
- Custom: Pricing and limits set per customer

### Subscription Hierarchy Function

**`getHighestPrioritySubscription(userId)`** - Returns best subscription

Returns subscription in this priority order:
1. **Enterprise** (highest)
2. **Team**
3. **Pro**
4. **Free** (lowest)

If user is member of org with Enterprise/Team subscription, they use that instead of personal Pro.

### Plan Detection Helpers

```typescript
isProPlan(user)       // Returns: boolean
isTeamPlan(user)      // Returns: boolean
isEnterprisePlan(user) // Returns: boolean
```

### Subscription State Structure

**Location:** `/apps/sim/lib/billing/core/subscription.ts`

```typescript
{
  // Identification
  id: string
  userId: string
  organizationId?: string
  
  // Plan details
  plan: 'free' | 'pro' | 'team' | 'enterprise'
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing'
  
  // Capacity (for Team/Enterprise only)
  seats: number
  
  // Stripe integration
  stripeCustomerId?: string
  referenceId?: string  // Internal reference ID
  
  // Pricing (Enterprise only)
  metadata?: {
    monthlyPrice: number
    seats: number
    referenceId: string
  }
  
  // Lifecycle
  createdAt: Date
  updatedAt: Date
  canceledAt?: Date
}
```

### Organization Usage Pooling

**For Team/Enterprise:** All members share the organization's usage budget.

**Location:** `/apps/sim/lib/billing/core/organization.ts`

```typescript
getOrganizationBillingData(orgId) // Returns:
{
  organizationId,
  organizationName,
  subscriptionPlan,    // 'team' or 'enterprise'
  subscriptionStatus,
  totalSeats,
  usedSeats,
  totalCurrentUsage,   // Sum of all member usage in current period
  totalUsageLimit,     // org.orgUsageLimit or calculated from seats
  members: [
    {
      id,
      name,
      currentPeriodCost,
      usageLimit,
      billingBlocked
    }
  ]
}
```

### Default Cost Limits

**Location:** `/apps/sim/lib/billing/subscriptions/constants.ts`

```typescript
DEFAULT_FREE_CREDITS = 20              // $20
DEFAULT_PRO_TIER_COST_LIMIT = 20       // $20
DEFAULT_TEAM_TIER_COST_LIMIT = 40      // $40/seat
DEFAULT_ENTERPRISE_TIER_COST_LIMIT = 200 // $200
```

Overridable via environment variables:
```
FREE_TIER_COST_LIMIT=25
PRO_TIER_COST_LIMIT=50
TEAM_TIER_COST_LIMIT=75
ENTERPRISE_TIER_COST_LIMIT=500
```
