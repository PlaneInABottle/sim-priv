---
name: ecommerce-agent-template
description: Reusable template for creating e-commerce support agent prompts for ikas-based companies. Use when (1) onboarding a new ikas e-commerce company that needs a WhatsApp/chat support agent, (2) creating or customizing an agent prompt with product browsing, order lookup, area-based pricing, dimension routing, measurement guidance, and human handoff, (3) adapting the proven Kamatas agent pattern to a different product domain. Covers all ikas tool integrations (ikas_browse, calculate_product_price, ikas_lookup_customer_orders, handoff_to_human).
---

# E-Commerce Agent Prompt Template

Reusable prompt template for ikas-based e-commerce support agents. Modeled on the Kamatas agent (`docs/prompts/kamatas-agent-prompt-compressed.md`).

## Workflow

### 1. Gather Company Information

Collect before generating:

- **Identity:** Company name, address, website domain, channel (WhatsApp/etc.)
- **Products:** Product families, category hierarchy, terminology glossary
- **Language:** Primary language, formality rules, natural phrases, name honorifics
- **Dimensions:** How customers specify sizes, dimension-to-product routing rules
- **Measurement:** Measurement method, tutorial video URLs (by product × scenario)
- **Pricing:** Currency, area-based product list (if any), out-of-stock label
- **Handoff:** Label taxonomy, VIP rules, warm handoff phrases
- **Status translations:** Order/payment/package statuses in target language

### 2. Generate Prompt from Template

Read `references/template.md` — the complete prompt template with `{{PLACEHOLDER}}` markers.

Replace all placeholders using `references/placeholders.md` as a lookup table. Each placeholder has: description, Kamatas example value, and guidance.

### 3. Validate

1. Run `grep '{{' generated-prompt.md` — must return 0 matches
2. Verify all `<!-- CUSTOMIZE: -->` comments were addressed
3. Confirm prompt is under 500 lines
4. Check all handoff labels are consistent between sections

## Template Architecture

Three tiers — know what to preserve vs customize:

**Universal (never modify):**
- Memory-first rule, intent→tool routing table
- ikas_browse mechanics, calculate_product_price formula, UUID safety
- Hard rules (anti-hallucination), sanity checklist, one-question-per-message pattern
- 3-round handoff rule, 15-message goal

**Structural (keep pattern, change content):**
- Who You Are, Your Voice, Customer Recognition, First Message
- Product navigation hierarchy, dimension routing, measurement & installation
- Handoff categories, status translations, conversation examples

**Company-specific (fully custom):**
- Product families, terminology, videos, VIP rules, dimension thresholds

## Reference Files

- **`references/template.md`** — Complete prompt template with all `{{PLACEHOLDER}}` markers and `<!-- CUSTOMIZE: -->` comments. Read this to generate a new agent prompt.
- **`references/placeholders.md`** — All ~60 placeholders with descriptions, types, Kamatas examples, and fill-in guidance. Read this for the placeholder lookup table.

## Tool Configuration

Every ikas agent needs these four tools:

| Tool | ikas API | Purpose |
|------|----------|---------|
| `ikas_browse` | `listCategory` / `listProduct` (GraphQL) | Product discovery by category UUID |
| `calculate_product_price` | Custom JS function | Area pricing: `max(100×unitPrice, W×H×unitPrice/100)` |
| `ikas_lookup_customer_orders` | `listOrder` (GraphQL) | Order lookup by phone/email/orderNumber |
| `handoff_to_human` | Platform-specific | Human escalation with labels + internal_note |

Skip `calculate_product_price` if all products are fixed-price.

## Dimension Extraction & Product Filtering

### Dimension Extraction (Critical)

**When customer provides dimensions, ALWAYS extract and pass to search tools:**

```
Customer: "80x180 menteşeli pencere"
Extract: {width: 80, height: 180}
Pass to tool: ikas_browse({mainCategory: "menteseli-pencere-sinekligi"})
→ Agent filters results by extracted dimensions (width: 80, height: 180)

> **Note:** Company-specific implementations may use a custom tool name (e.g., Kamatas uses `get_products_by_main_category`). The generic template name is `ikas_browse`.
```

**Turkish dimension patterns:**
- `80x180` or `80×180` → width: 80, height: 180
- `en 80 boy 180` → width: 80, height: 180
- `80 genişlik 180 yükseklik` → width: 80, height: 180
- Single number → ask which dimension

**Never pass `{width: 0, height: 0}`** - this disables filtering and returns all products.

### Product Filter Buckets

Search tools return three buckets:

| Bucket | Meaning | Agent Action |
|--------|---------|--------------|
| **strictFit** | Product dimensions ≥ requested | Suggest these first |
| **toleranceFit** | Product 0-2cm smaller than requested | Suggest if no strict fits |
| **unknownDimensions** | Dimensions couldn't be parsed | Ignore OR handoff for manual verification |

**Never suggest unknownDimensions products** without explicit verification.

### Cross-Category Routing

When dimensions don't fit requested category, search alternative:

```
Customer: "80×180 menteşeli pencere"
Agent searches: "menteşeli pencere" with {width: 80, height: 180}
Tool returns: pencere 70×130 (too small, excluded)
Agent recognizes: 180cm height > pencere max (~150cm)
Agent searches: "menteşeli kapı" with {width: 80, height: 180}
Tool returns: kapı 90×210 (fits in strictFit)
Agent suggests: "Pencere sineklikte bu ölçü yok, kapı menteşelimizde tam uyması var: [link]"
```

**Dimension thresholds:**
- Pencere (window): Typical max 70W × 150H cm
- Kapı (door): Typical max 100W × 220H cm

**Routing rule:** If customer says "pencere" but height > 150cm → search kapı first.
