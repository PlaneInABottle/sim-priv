# Billing Implementation

## Table of Contents
1. [Usage Limits & Monitoring](#usage-limits--monitoring)
2. [Overage & Threshold Billing](#overage--threshold-billing)
3. [Stripe Integration](#stripe-integration)

---

## Usage Limits & Monitoring

### Overview
Sim Studio enforces per-user and per-organization usage limits. Limits trigger warnings at 80% and prevent execution at 100%.

### Usage Limit System

**Location:** `/apps/sim/lib/billing/core/usage.ts`

#### Getting User Usage Data

```typescript
getUserUsageData(userId) // Returns:
{
  currentPeriodCost: number,      // Spent this billing period ($)
  currentUsageLimit: number,      // User's budget limit ($)
  creditBalance: number,          // Available credits ($)
  billingBlocked: boolean,        // Limit exceeded?
  lastActive: Date
}
```

#### Setting Usage Limits

```typescript
updateUserUsageLimit(userId, limitAmount) // Sets custom limit for user
getUserUsageLimit(userId) // Returns: { limit, isCustom, updatedAt }
```

**Limit constraints:**
- Minimum: $1
- Maximum: None (enterprise can set very high)
- Default: From subscription plan (FREE=$20, PRO=$20, TEAM=$40/seat, etc.)

#### Organization-Level Limits

```typescript
getOrgUsageLimit(orgId) // Returns: { limit, usedSeats, totalSeats, billingBlocked }
```

**Team/Enterprise:** All members share org budget.

### Usage Monitoring

**Location:** `/apps/sim/lib/billing/calculations/usage-monitor.ts`

#### Core Function

```typescript
checkUsageStatus(userId) // Returns:
{
  percentUsed: number,      // 0-100% of limit
  isWarning: boolean,       // >= 80% of limit
  isExceeded: boolean,      // >= 100% of limit
  currentUsage: number,     // Current period cost
  limit: number,            // User's limit
  message?: string          // Warning/error message
}
```

**Thresholds:**
- **Green**: 0-80% - Normal operation
- **Yellow (Warning)**: 80-99% - UI warning shown
- **Red (Exceeded)**: 100%+ - Execution blocked, billing halted

#### Organization-Level Checking

Also checks organization limits when user is team/enterprise member:

```typescript
const orgStatus = checkOrgUsageStatus(orgId)
if (orgStatus.isExceeded) {
  // Block all org members from executing
}
```

### UI Integration

**Components showing usage:**

| Component | Location | Shows |
|---|---|---|
| **usage-indicator** | `sidebar/components/usage-indicator/` | Animated pill (green/yellow/red) with % used |
| **usage-header** | `settings-modal/components/usage-header/` | Plan name + cost breakdown ($X/$Y) |
| **usage-limit** | `settings-modal/components/usage-limit/` | Editable limit with constraints |

**Visualization config** (`client/usage-visualization.ts`):
- Green pill: 0-80%
- Yellow pill: 80-100%
- Red pill: 100%+
- Animation: 1.8 pills/sec

### Data Storage

**Location:** `/packages/db/schema.ts` (line 666)

```typescript
userStats {
  id
  userId
  currentPeriodCost: decimal   // $X.XX spent this period
  currentUsageLimit: decimal   // User's budget limit
  creditBalance: decimal       // Available credits
  billingBlocked: boolean      // Limit exceeded?
  lastActive: Date
}
```

**Billing period:** Calendar month (resets on 1st of each month)

---

## Overage & Threshold Billing

### Overview
When users exceed their plan limit, incremental overages are tracked and billed at month-end using a threshold mechanism. This prevents "surprise" charges.

**Key principle:** Users are only charged when unbilled overage reaches $50 threshold or month ends.

### Overage Calculation

**Location:** `/apps/sim/lib/billing/core/billing.ts`

#### Core Function

```typescript
calculateUserOverage(userId) // Returns:
{
  totalOverage: number,        // Total overage this period
  billedOverage: number,       // Already billed
  unbilledOverage: number,     // Pending invoice
  invoiceCount: number,        // Number of invoices created
  invoicedAt: Date[]           // When overages were invoiced
}
```

#### Formula

```
unbilledOverage = currentPeriodCost - subscriptionBasePrice - previouslyBilledOverage
```

Example:
```
Pro subscription base = $20/month
User spent = $75
Previously billed overage = $10
Unbilled overage = $75 - $20 - $10 = $45
```

### Threshold Billing

**Location:** `/apps/sim/lib/billing/threshold-billing.ts`

**Function:** `checkAndBillOverageThreshold(userId, currentCost)`

**Mechanism:**
1. Calculate unbilled overage
2. If unbilled overage ≥ `OVERAGE_THRESHOLD_DOLLARS` ($50):
   - Create Stripe invoice item for overage amount
   - Finalize invoice
   - Mark overage as billed
3. If < $50:
   - Wait for threshold to be reached or month-end (whichever first)

**Advantage:** Users never see surprise charges > $50 mid-month.

### Storage & Tracking

**userStats table columns:**
```typescript
billedOverageThisPeriod: decimal  // Total overage already invoiced
```

**usageLog table:**
```typescript
{
  id
  userId
  organizationId?
  workflowId?
  category: 'model' | 'fixed'      // Token-based or flat fee
  source: 'workflow' | 'wand' | 'copilot'
  cost: decimal                     // Amount charged
  inputTokens?: number
  outputTokens?: number
  createdAt: Date
}
```

### Month-End Billing

Webhook handler: `/apps/sim/lib/billing/webhooks/invoices.ts`

**`handleInvoiceFinalized(stripeInvoice)`:**
1. Retrieves subscription from Stripe invoice
2. Calculates final overage for the period
3. Creates invoice line item for remaining overage
4. Marks overage as billed in userStats
5. Finalizes invoice for payment

**Fired by:** Stripe webhook `invoice.finalized`

### Organization Overage

**For Team/Enterprise:** Overage is pooled at organization level.

```typescript
calculateSubscriptionOverage(subscriptionId) // Returns org overage
```

Minimum billing for Team plan:
```
minimumBilling = basePricePerSeat × numberOfSeats
```

Even if org members use less, they're still charged for all seats.

---

## Stripe Integration

### Overview
Stripe handles subscription management, payment processing, and invoicing. All Stripe operations require `STRIPE_SECRET_KEY`.

### Stripe Client

**Location:** `/apps/sim/lib/billing/stripe-client.ts`

```typescript
getStripeClient()          // Returns Stripe instance or null
requireStripeClient()      // Throws error if not available
hasValidStripeCredentials() // boolean
```

### Stripe Tools

**Location:** `/apps/sim/tools/stripe/` (30+ endpoint wrappers)

#### Subscription Management
```typescript
create_subscription    // Create new subscription
update_subscription    // Change plan, seats, etc.
cancel_subscription    // End subscription
list_subscriptions     // Find subscriptions
retrieve_subscription  // Get details
```

#### Customer Management
```typescript
create_customer        // Create Stripe customer
retrieve_customer      // Get customer details
update_customer        // Update info
list_customers         // List all customers
```

#### Invoice Management
```typescript
create_invoice         // Create manual invoice
finalize_invoice       // Mark as final (triggers payment)
pay_invoice            // Manually pay invoice
send_invoice           // Send invoice to customer
list_invoices          // List invoices
```

#### Payment Methods
```typescript
create_charge          // One-time charge
create_payment_intent  // Async payment
capture_charge         // Finalize pending charge
list_payment_methods   // List saved methods
```

#### Pricing
```typescript
create_price           // Add new price point
update_price           // Modify pricing
list_prices            // List all prices
```

### Webhook Handlers

**Location:** `/apps/sim/lib/billing/webhooks/`

#### Subscription Events

**File:** `subscription.ts`

| Event | Handler | Purpose |
|---|---|---|
| `customer.subscription.created` | `handleSubscriptionCreated()` | New subscription, set limits |
| `customer.subscription.deleted` | `handleSubscriptionDeleted()` | Cleanup, restore Pro subs, delete empty org |
| `customer.subscription.updated` | `handleSubscriptionUpdated()` | Seat changes, plan updates |

#### Invoice Events

**File:** `invoices.ts`

| Event | Handler | Purpose |
|---|---|---|
| `invoice.finalized` | `handleInvoiceFinalized()` | Calculate overage, bill user |
| `invoice.payment_succeeded` | `handleInvoicePaymentSucceeded()` | Unblock user, send receipt |
| `invoice.payment_failed` | `handleInvoicePaymentFailed()` | Block user, notify |

#### Dispute Events

**File:** `disputes.ts`
- Handle disputed charges
- Update account status

### Setting Up Stripe Integration

**Required Environment Variables:**
```bash
BILLING_ENABLED=true
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_FREE_PRICE_ID=price_xxxxx
STRIPE_PRO_PRICE_ID=price_xxxxx
STRIPE_TEAM_PRICE_ID=price_xxxxx
STRIPE_ENTERPRISE_PRICE_ID=price_xxxxx
```

**Stripe Dashboard Setup:**
1. Create products for Free, Pro, Team, Enterprise
2. Create recurring prices for each
3. Create webhook endpoint for `/api/billing/webhooks`
4. Enable events: subscription, invoice, dispute events
5. Get webhook secret and price IDs

### Stripe Data in Sim Studio

**subscription table columns:**
```typescript
stripeCustomerId: string    // Stripe customer ID
referenceId: string         // Internal subscription ID
metadata: JSON              // Store price IDs, seat count, custom pricing
```

**userStats table columns:**
```typescript
stripeCustomerId: string    // Link to Stripe customer
```

### Payment Flow

**New subscription:**
```
User selects Pro ($20/month)
  ↓
Create Stripe subscription
  ↓
Stripe charges immediately
  ↓
Payment succeeded webhook
  ↓
Set user.currentUsageLimit = $20
  ↓
User can execute
```

**Overage billing:**
```
User exceeds limit by $50
  ↓
checkAndBillOverageThreshold() triggered
  ↓
Create Stripe invoice item for $50
  ↓
Finalize invoice
  ↓
Stripe charges payment method on file
  ↓
invoice.payment_succeeded webhook
  ↓
Mark overage as billed
```

### Error Handling

**When Stripe is unavailable:**
- If `hasValidStripeCredentials() = false`, billing is disabled
- Cost tracking still happens
- No limits enforced
- Self-hosted can operate without Stripe

**Payment failures:**
- Webhook: `invoice.payment_failed`
- Set `userStats.billingBlocked = true`
- Execution is blocked
- User notified via UI and email
