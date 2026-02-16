# Kamatas: `get_products_by_main_category` Custom Tool

## Overview

Replaces two deprecated tools (`ikas_search_facets_v1` and `ikas_search_products_v1`) with a single, simpler category-based product discovery tool.

**Created:** 2026-02-16
**Workspace:** `ac7ec7a6-f09a-4035-8e96-e9e95b75221b`
**Workflow:** `53408cc2-52fa-46e5-85d7-402d2f42f3a4` (Kamatas PROD)
**Tool ID:** `1l6OXfiPurePIeJcLDOS4`

## Discovered Main Categories

Queried from ikas Admin API (`listCategory`), filtered to storefront-visible (`salesChannelIds` includes `7cbc724c-3edf-48c7-88b7-741b9caddee7`):

| Slug | Name | Category ID | Children |
|------|------|-------------|----------|
| `sineklikler` | Sineklikler | `b5a51ad9-adf5-4d30-b90a-5e8e7f49a570` | 11 subcategories (Akordiyon, Menteşeli, Sabit, Kedi, Sürme, Nobel, Cam Balkon, Anti-Polen, etc.) |
| `perdeler` | Perdeler | `0c53dc4d-9a78-4e11-9006-68ca4b2e1179` | 2 subcategories (Plise Perdeler, Seperatör Perdeler) |
| `otomatik-panjurlar` | Otomatik Panjurlar | `4a1974eb-3e41-4124-a5fe-ac9e165ae44d` | 3 subcategories (Pencere, Kapı, Maximum Kapı) |
| `profiller` | Profiller | `7dde0a14-b734-452f-9c7c-52f7fcc6bfa2` | 3 subcategories (Küpeşteler, Sineklik Profilleri, Ara Çıtalar) |
| `aksesuarlar` | Aksesuarlar | `6aafc449-11f7-4a80-8316-a0407e30555e` | 6 subcategories (Sineklik, Cam Kapı Hidrolikleri, Tüller, Kedi Tülleri, Pencere/Kapı, Panjur) |
| `tutamaklar` | Tutamaklar | `cba93172-c033-4463-b024-5afce6964f47` | 1 subcategory (Merdiven Tutamakları) |

**Total visible categories:** 89

## Tool Schema

```json
{
  "type": "function",
  "function": {
    "name": "get_products_by_main_category",
    "description": "Ana kategoriye göre tüm ürünleri, alt kategori ağacını ve fiyat bilgilerini getirir.",
    "parameters": {
      "type": "object",
      "properties": {
        "mainCategory": {
          "type": "string",
          "enum": ["sineklikler", "perdeler", "otomatik-panjurlar", "profiller", "aksesuarlar", "tutamaklar"],
          "description": "Ana kategori slug'ı"
        }
      },
      "required": ["mainCategory"]
    }
  }
}
```

## Response Format (v5 — Grouped + Flattened)

**Updated 2026-02-16:** Replaced flat product list with grouped response schema.

```json
{
  "mainCategory": "Sineklikler",
  "totalProducts": 100,
  "totalGroups": 39,
  "baseUrl": "https://kamatas.com",
  "groups": [
    {
      "type": "Anti-Polen akordeon Kapı Sineklik",
      "dims": "90x210",
      "price": 2398,
      "variants": [
        { "color": "Altınmeşe", "url": "/anti-polen-akordiyon-kapi-sinekligi-altinmese-max-90x210" },
        { "color": "Antrasit", "url": "/anti-polen-kapi-sinekligi-antrasit-max-90x210" },
        { "color": "Beyaz", "url": "/anti-polen-akordiyon-kapi-sinekligi-beyaz-max-90x210" }
      ]
    },
    {
      "type": "Akordeon DUBLE Kapı Sineklik",
      "dims": "290x240",
      "variants": [
        { "color": "Antrasit", "price": 4621.5, "url": "/double-akordiyon-kapi-sinekligi-antrasit-maximum-290x240" },
        { "color": "Altınmeşe", "price": 5220, "url": "/double-akordiyon-kapi-sinekligi-altinmese-maximum-290x240" },
        { "color": "Beyaz", "price": 4621.5, "url": "/double-akordiyon-kapi-sinekligi-beyaz-maximum-290x240" }
      ]
    },
    {
      "type": "Yapışkanlı Sineklik Yaması Tülü Tamir Bandı 50mm x 2m",
      "variants": [
        { "price": 99.99, "url": "/yapiskanli-sineklik-yamasi-tulu-tamir-bandi-50mm-x-5m" }
      ]
    }
  ]
}
```

### Schema Details

| Field | Type | Description |
|-------|------|-------------|
| `mainCategory` | string | Display name of the category |
| `totalProducts` | number | Total individual products (variants) |
| `totalGroups` | number | Number of product type groups |
| `baseUrl` | string | Prepend to variant URLs for full links |
| `groups[].type` | string | Product type name (color stripped) |
| `groups[].dims` | string? | Max dimensions as "WxH" (cm), omitted if none |
| `groups[].price` | number? | Price in TRY — present only when ALL variants share the same price |
| `groups[].variants[].color` | string? | Color name (Turkish), omitted for colorless products |
| `groups[].variants[].price` | number? | Price in TRY — present only when prices differ per variant |
| `groups[].variants[].url` | string | Relative URL path (prepend `baseUrl`) |

### Price Rules
- If all variants in a group have the **same price** → `price` is at group level, omitted from variants
- If variants have **different prices** → `price` is per-variant, omitted from group
- Price is always flat number (TRY assumed), not nested `{amount: X}`

### Grouping Logic
- **Group key:** Normalized product type + dimensions
- **Color extraction:** Turkish-aware, checks last word then first word against known colors (Beyaz, Antrasit, Altınmeşe, Kahverengi, Naturel)
- **Typo normalization:** "Sinekliğ"→"Sineklik", "Cam Balkonlar"→"Cam Balkon"
- **Case normalization:** Turkish İ/I handling for grouping (KEDİ = Kedi)
- **URL deduplication:** No duplicate URLs within any group

### Token Savings (v4 → v5)

| Metric | v4 (flat) | v5 (grouped) | Savings |
|--------|-----------|--------------|---------|
| JSON chars | 22,046 | 13,819 | **8,227 (37%)** |
| Est. tokens | ~5,511 | ~3,454 | **~2,057** |
| LLM input tokens | 7,627 | 5,550 | **2,077 (27%)** |
| Products/groups | 100 flat | 39 groups | 61 fewer entries |

## Implementation Details

- **Auth:** OAuth2 client_credentials via `{{KAMATAS_IKAS_CLIENT_ID}}` / `{{KAMATAS_IKAS_CLIENT_SECRET}}`
- **Caching:** Redis via Upstash (10-min TTL for products, 15-min for category tree, ~4h for token)
- **Storefront filter:** `salesChannelIds: { eq: "7cbc724c-3edf-48c7-88b7-741b9caddee7" }` (server-side + client-side defense)
- **Pagination:** Up to 10 pages × 200 products = 2000 max per category
- **Product dedup:** By product ID (Set-based)
- **Sorting:** Alphabetical (Turkish locale)
- **Grouping (v5):** Type + dims based, with color variants, Turkish-aware normalization
- **Price optimization:** Same-price groups hoist price to group level
- **URL format:** Relative paths (strip `https://kamatas.com` prefix)
- **Error handling:** All errors in Turkish

## Changes Made

### 1. New Custom Tool Created
- Tool: `get_products_by_main_category` (ID: `1l6OXfiPurePIeJcLDOS4`)

### 2. Agent Tool List Updated
Removed:
- `ikas_search_facets_v1` (ID: `FjKweexYbZUtRH9FbrgD1`) — ❌ removed from agent
- `ikas_search_products_v1` (ID: `XyCxFRVmb4vmXDv6Xl1iC`) — ❌ removed from agent

Added:
- `get_products_by_main_category` (ID: `1l6OXfiPurePIeJcLDOS4`) — ✅ added to agent

Kept:
- `handoff_to_human` (ID: `WcK_p-88OCRSERdTRnSAl`)
- `ikas_browse` (ID: `Jld_awT643hDFjkAGZigL`)
- `ikas_lookup_customer_orders` (ID: `fWAlf6K9NoFrkjHtezh8G`)
- `calculate_product_price` (ID: `au9k4nrkq2wYhkcUVF__i`)

### 3. Agent Prompt Updated
Key prompt changes:
- **Simple Flow** → Uses `get_products_by_main_category` instead of facets+search
- **When Customers Give Dimensions** → References new tool for filtering by subcategory
- **Tools & Intent Routing** → New routing table with `get_products_by_main_category` as primary
- **Main Category Tool section** → Detailed usage guide replacing Search Tools section
- **Product discovery order** → Simplified flow without strictFit/toleranceFit buckets
- **Dimension Verification** → Simplified section replacing unknownDimensions rules
- **UUID Safety** → Updated to reference new tool alongside `ikas_browse`

### 4. Old Tools — NOT Deleted (Limitation)
The sim-mcp API does not support deleting custom tools. The old tools remain in the workspace but are **NOT attached to the agent** and cannot be invoked.

**Manual cleanup required:**
- Delete `ikas_search_facets_v1` (ID: `FjKweexYbZUtRH9FbrgD1`) via Sim UI
- Delete `ikas_search_products_v1` (ID: `XyCxFRVmb4vmXDv6Xl1iC`) via Sim UI

## Agent Routing Logic (Updated)

```
Customer Intent                    → Tool
────────────────────────────────   ──────────────────────────────
"sineklik istiyorum"               → get_products_by_main_category({mainCategory: "sineklikler"})
"perde ne kadar?"                  → get_products_by_main_category({mainCategory: "perdeler"})
"aksesuar var mı?"                 → get_products_by_main_category({mainCategory: "aksesuarlar"})
"panjur bakıyordum"                → get_products_by_main_category({mainCategory: "otomatik-panjurlar"})
Deep subcategory navigation        → ikas_browse (with categoryId from previous results)
Order/tracking inquiry             → ikas_lookup_customer_orders
Area pricing calculation           → calculate_product_price
Ready to buy / complaints          → handoff_to_human
```

## Testing

The tool can be tested by executing the Kamatas PROD workflow via webhook or by calling the tool directly in Sim's custom tool testing UI.

Test cases:
1. `{mainCategory: "sineklikler"}` — Should return 50+ products with subcategory tree
2. `{mainCategory: "perdeler"}` — Should return plise + seperatör products
3. `{mainCategory: "invalid"}` — Should return Turkish error: "Geçersiz kategori..."
4. `{}` — Should return Turkish error with valid categories list
5. Second call to same category — Should show `cacheHit: true`
