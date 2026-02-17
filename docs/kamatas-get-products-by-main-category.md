# Kamatas: `get_products_by_main_category` Custom Tool

## Overview

Replaces two deprecated tools (`ikas_search_facets_v1` and `ikas_search_products_v1`) with a single, simpler category-based product discovery tool.

**Created:** 2026-02-16
**Snapshot Updated:** 2026-02-17
**Workspace:** `ac7ec7a6-f09a-4035-8e96-e9e95b75221b`
**Workflow:** `53408cc2-52fa-46e5-85d7-402d2f42f3a4` (Kamatas PROD)
**Tool ID:** `1l6OXfiPurePIeJcLDOS4`
**Tool Updated At:** `2026-02-16T18:32:48.517Z`

## Discovered Main Categories

Queried from ikas Admin API (`listCategory`), filtered to storefront-visible (`salesChannelIds` includes `7cbc724c-3edf-48c7-88b7-741b9caddee7`):

| Slug                 | Name               | Category ID                            | Children                                                                                         |
| -------------------- | ------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `sineklikler`        | Sineklikler        | `b5a51ad9-adf5-4d30-b90a-5e8e7f49a570` | 11 subcategories (Akordiyon, Menteşeli, Sabit, Kedi, Sürme, Nobel, Cam Balkon, Anti-Polen, etc.) |
| `perdeler`           | Perdeler           | `0c53dc4d-9a78-4e11-9006-68ca4b2e1179` | 2 subcategories (Plise Perdeler, Seperatör Perdeler)                                             |
| `otomatik-panjurlar` | Otomatik Panjurlar | `4a1974eb-3e41-4124-a5fe-ac9e165ae44d` | 3 subcategories (Pencere, Kapı, Maximum Kapı)                                                    |
| `profiller`          | Profiller          | `7dde0a14-b734-452f-9c7c-52f7fcc6bfa2` | 3 subcategories (Küpeşteler, Sineklik Profilleri, Ara Çıtalar)                                   |
| `aksesuarlar`        | Aksesuarlar        | `6aafc449-11f7-4a80-8316-a0407e30555e` | 6 subcategories (Sineklik, Cam Kapı Hidrolikleri, Tüller, Kedi Tülleri, Pencere/Kapı, Panjur)    |
| `tutamaklar`         | Tutamaklar         | `cba93172-c033-4463-b024-5afce6964f47` | 1 subcategory (Merdiven Tutamakları)                                                             |

**Total visible categories:** 89

## Tool Schema

```json
{
  "type": "function",
  "function": {
    "name": "get_products_by_main_category",
    "description": "Ana kategoriye göre ürünleri gruplandırılmış olarak getirir. Ürünler tip + boyut (dims) bazında gruplandırılır, renk varyantları her grubun içinde listelenir. Fiyat düzdür (nested değil). URL'ler görecelidir, baseUrl ile birleştirin. Aynı fiyatlı gruplarda fiyat grup seviyesinde gösterilir. Desteklenen renkler: beyaz, antrasit, altınmeşe, kahverengi, naturel, siyah, bronz, parlak, gri, krem, kırmızı, pudra, yeşil, metalik gri, ara gri. Returns: { mainCategory, totalProducts, totalGroups, baseUrl, groups[{ type, dims?, price?, variants[{ color?, price?, url }] }] }",
    "parameters": {
      "type": "object",
      "properties": {
        "mainCategory": {
          "type": "string",
          "enum": [
            "sineklikler",
            "perdeler",
            "otomatik-panjurlar",
            "profiller",
            "aksesuarlar",
            "tutamaklar"
          ],
          "description": "Ana kategori slug'ı"
        }
      },
      "required": ["mainCategory"]
    }
  }
}
```

## Response Format (v6 — Grouped + Flattened, Full-Scan Color Extraction)

**Updated 2026-02-16:** v6 adds full-scan color extraction across ALL word positions,
multi-word colors (Metalik Gri, Ara Gri), expanded color palette (15 colors),
and punctuation-aware matching. Dramatically improves grouping for perdeler,
otomatik-panjurlar, aksesuarlar, and tutamaklar categories.

```json
{
  "mainCategory": "Tutamaklar",
  "totalProducts": 8,
  "totalGroups": 4,
  "baseUrl": "https://kamatas.com",
  "groups": [
    {
      "type": "Merdiven Tutamağı 100cm",
      "price": 870,
      "variants": [
        { "color": "Bronz", "url": "/aluminyum-bronz-merdiven-tutamak-..." },
        { "color": "Metalik Gri", "url": "/aluminyum-merdiven-korkuluk-..." }
      ]
    },
    {
      "type": "Orjin Pliseli Perde Katlanır Cam/Ev/Ofis Perdesi, İstediğin Ölçüde",
      "price": 5.42,
      "variants": [
        { "color": "Antrasit", "url": "/orjin-pliseli-perde-antrasit-..." },
        { "color": "Beyaz", "url": "/orjin-pliseli-perde-beyaz-..." },
        { "color": "Gri", "url": "/orjin-pliseli-perde-gri-..." },
        { "color": "Kırmızı", "url": "/still-plise-perde-kirmizi" },
        { "color": "Krem", "url": "/orjin-pliseli-perde-krem-..." },
        { "color": "Pudra", "url": "/still-plise-perde-pudra" },
        { "color": "Yeşil", "url": "/still-plise-perde-yesil" }
      ]
    },
    {
      "type": "Yapışkanlı Sineklik Yaması Tülü Tamir Bandı 50mm x 2m",
      "variants": [{ "price": 99.99, "url": "/yapiskanli-sineklik-yamasi-..." }]
    }
  ]
}
```

### Schema Details

| Field                       | Type    | Description                                                        |
| --------------------------- | ------- | ------------------------------------------------------------------ |
| `mainCategory`              | string  | Display name of the category                                       |
| `totalProducts`             | number  | Total individual products (variants)                               |
| `totalGroups`               | number  | Number of product type groups                                      |
| `baseUrl`                   | string  | Prepend to variant URLs for full links                             |
| `groups[].type`             | string  | Product type name (color stripped)                                 |
| `groups[].dims`             | string? | Max dimensions as "WxH" (cm), omitted if none                      |
| `groups[].price`            | number? | Price in TRY — present only when ALL variants share the same price |
| `groups[].variants[].color` | string? | Color name (Turkish), omitted for colorless products               |
| `groups[].variants[].price` | number? | Price in TRY — present only when prices differ per variant         |
| `groups[].variants[].url`   | string  | Relative URL path (prepend `baseUrl`)                              |

### Price Rules

- If all variants in a group have the **same price** → `price` is at group level, omitted from variants
- If variants have **different prices** → `price` is per-variant, omitted from group
- Price is always flat number (TRY assumed), not nested `{amount: X}`

### Supported Colors (v6)

**Multi-word (matched first):** Metalik Gri, Ara Gri
**Single-word:** Beyaz, Antrasit, Altınmeşe, Kahverengi, Naturel, Siyah, Bronz, Parlak, Gri, Krem, Kırmızı, Pudra, Yeşil
**Typo handling:** "Beya" → Beyaz

### Grouping Logic (v6)

- **Group key:** Normalized product type + dimensions
- **Color extraction (v6):** Scans ALL word positions (right-to-left), strips trailing punctuation before matching
- **Multi-word colors:** Checked first to prevent partial matches (e.g., "Metalik Gri" before "Gri")
- **Typo normalization:** "Sinekliğ"→"Sineklik", "Cam Balkonlar"→"Cam Balkon", "Beya"→"Beyaz"
- **Case normalization:** Turkish İ/I handling via `trLower()` (KEDİ = Kedi, ANTRASİT = Antrasit)
- **URL deduplication:** No duplicate URLs within any group

### Grouping Results Per Category (v6)

| Category           | Products | Groups | Ratio | Price Hoisting |
| ------------------ | -------- | ------ | ----- | -------------- |
| sineklikler        | 100      | 39     | 2.56x | 18 groups      |
| perdeler           | 20       | 9      | 2.22x | 4 groups       |
| otomatik-panjurlar | 12       | 3      | 4.0x  | 2 groups       |
| aksesuarlar        | 35       | 28     | 1.25x | 5 groups       |
| tutamaklar         | 8        | 4      | 2.0x  | 4 groups       |
| profiller          | 0        | 0      | —     | —              |

### Token Savings (v4 → v6)

| Metric                    | v4 (flat) | v6 (grouped) | Savings                    |
| ------------------------- | --------- | ------------ | -------------------------- |
| Sineklikler groups        | 100 flat  | 39 groups    | **61 fewer entries (37%)** |
| Perdeler groups           | 20 flat   | 9 groups     | **11 fewer entries (55%)** |
| Otomatik Panjurlar groups | 12 flat   | 3 groups     | **9 fewer entries (75%)**  |
| Tutamaklar groups         | 8 flat    | 4 groups     | **4 fewer entries (50%)**  |

## Implementation Details

- **Auth:** OAuth2 client_credentials via `{{KAMATAS_IKAS_CLIENT_ID}}` / `{{KAMATAS_IKAS_CLIENT_SECRET}}`
- **Caching:** Redis via Upstash (10-min TTL for products, 15-min for category tree, ~4h for token)
- **Storefront filter:** `salesChannelIds: { eq: "7cbc724c-3edf-48c7-88b7-741b9caddee7" }` (server-side + client-side defense)
- **Pagination:** Up to 10 pages × 200 products = 2000 max per category
- **Product dedup:** By product ID (Set-based)
- **Sorting:** Alphabetical (Turkish locale)
- **Grouping (v6):** Type + dims based, full-scan color extraction (15 colors incl. multi-word), Turkish-aware normalization
- **Price optimization:** Same-price groups hoist price to group level
- **Cache key:** `ikas:main-cat:${category}:v6`
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

## Note

This markdown is now aligned with the current Sim custom tool (`get_custom_tool` snapshot) for `get_products_by_main_category`.
/\*\*

- get_products_by_main_category v6 (grouped + flattened, full-scan color extraction)
-
- Ana kategoriye göre ürünleri getirir.
- v6: Enhanced color extraction – scans ALL word positions (not just first/last),
-     supports multi-word colors (Metalik Gri, Ara Gri), strips punctuation
-     before matching, handles "Beya" typo, and expands KNOWN_COLORS to cover
-     all categories (sineklikler, perdeler, otomatik-panjurlar, aksesuarlar, tutamaklar).
-     ~45% token savings vs v4 on multi-color categories.
  \*/
  const IKAS_OAUTH_URL = '<https://kamatas.myikas.com/api/admin/oauth/token>';
  const IKAS_GRAPHQL_URL = '<https://api.myikas.com/api/v1/admin/graphql>';
  const UPSTASH_URL = {{UPSTASH_REDIS_REST_URL}};
  const UPSTASH_TOKEN = {{UPSTASH_REDIS_REST_TOKEN}};
  const IKAS_CLIENT_ID = {{KAMATAS_IKAS_CLIENT_ID}};
  const IKAS_CLIENT_SECRET = {{KAMATAS_IKAS_CLIENT_SECRET}};
  const STOREFRONT_BASE = '<https://kamatas.com>';
  const STOREFRONT_CHANNEL_ID = '7cbc724c-3edf-48c7-88b7-741b9caddee7';
  const CACHE_TTL = 600;

const VALID_CATEGORIES = [
'sineklikler', 'perdeler', 'otomatik-panjurlar',
'profiller', 'aksesuarlar', 'tutamaklar'
];

const BASE_UNIT_LABELS = {
METER: 'metre', CENTIMETER: 'santimetre', MILLIMETER: 'milimetre',
KILOGRAM: 'kilogram', GRAM: 'gram', MILLIGRAM: 'miligram',
LITER: 'litre', MILLILITER: 'mililitre', CENTILITER: 'santilitre',
SQUARE_METERS: 'metrekare', CUBIC_METERS: 'metreküp', CUSTOM: 'özel'
};

// ─── Color Constants ──────────────────────────────────────────────────────────
// Multi-word colors checked FIRST (longest match wins, prevents partial "gri" match)
const KNOWN_COLORS_MULTI = ['metalik gri', 'ara gri'];

// Single-word colors, scanned across ALL word positions
const KNOWN_COLORS_SINGLE = [
'beyaz', 'antrasit', 'altınmeşe', 'kahverengi', 'naturel',
'siyah', 'bronz', 'parlak', 'gri', 'krem',
'kırmızı', 'pudra', 'yeşil'
];

const COLOR_DISPLAY = {
beyaz: 'Beyaz', antrasit: 'Antrasit', 'altınmeşe': 'Altınmeşe',
kahverengi: 'Kahverengi', naturel: 'Naturel',
siyah: 'Siyah', bronz: 'Bronz', parlak: 'Parlak', gri: 'Gri',
krem: 'Krem', 'kırmızı': 'Kırmızı', pudra: 'Pudra', yeşil: 'Yeşil',
'metalik gri': 'Metalik Gri', 'ara gri': 'Ara Gri'
};

// ─── Turkish-aware lowercase ──────────────────────────────────────────────────

function trLower(s) {
return s
.replace(/İ/g, 'i')
.replace(/I/g, 'ı')
.replace(/Ğ/g, 'ğ')
.replace(/Ü/g, 'ü')
.replace(/Ö/g, 'ö')
.replace(/Ş/g, 'ş')
.replace(/Ç/g, 'ç')
.toLowerCase();
}

// ─── Null Stripping ───────────────────────────────────────────────────────────

function stripNulls(obj) {
if (obj === null || obj === undefined) return undefined;
if (Array.isArray(obj)) {
return obj.map(stripNulls).filter(v => v !== undefined);
}
if (typeof obj !== 'object') return obj;
const result = {};
for (const [key, value] of Object.entries(obj)) {
const cleaned = stripNulls(value);
if (cleaned !== undefined && cleaned !== null) {
result[key] = cleaned;
}
}
return Object.keys(result).length > 0 ? result : undefined;
}

// ─── Redis Helpers ────────────────────────────────────────────────────────────

function hasRedis() { return !!(UPSTASH_URL && UPSTASH_TOKEN); }

async function redisGet(key) {
if (!hasRedis()) return null;
try {
const r = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
});
if (!r.ok) return null;
const j = await r.json();
return j?.result ? JSON.parse(j.result) : null;
} catch { return null; }
}

async function redisSet(key, val, ttl = CACHE_TTL) {
if (!hasRedis()) return;
try {
await fetch(UPSTASH_URL, {
method: 'POST',
headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
body: JSON.stringify(['SETEX', key, ttl, JSON.stringify(val)])
});
} catch {}
}

// ─── OAuth Token ──────────────────────────────────────────────────────────────

async function getToken() {
const tokenKey = 'ikas:token:main-cat-tool';
if (hasRedis()) {
try {
const r = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(tokenKey)}`, {
headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
});
if (r.ok) {
const j = await r.json();
if (j?.result) return j.result;
}
} catch {}
}

const body = `grant_type=client_credentials&client_id=${encodeURIComponent(IKAS_CLIENT_ID)}&client_secret=${encodeURIComponent(IKAS_CLIENT_SECRET)}`;
const r = await fetch(IKAS_OAUTH_URL, {
method: 'POST',
headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
body
});
if (!r.ok) throw new Error(`OAuth hatası: ${r.status}`);
const data = await r.json();
if (!data.access_token) throw new Error('Token alınamadı');

if (hasRedis()) {
const ttl = data.expires_in ? Math.max(60, Math.floor(data.expires_in \* 0.9)) : 12600;
try {
await fetch(UPSTASH_URL, {
method: 'POST',
headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
body: JSON.stringify(['SETEX', tokenKey, ttl, data.access_token])
});
} catch {}
}

return data.access_token;
}

// ─── GraphQL ──────────────────────────────────────────────────────────────────

async function gql(token, query, variables = {}) {
const r = await fetch(IKAS_GRAPHQL_URL, {
method: 'POST',
headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
body: JSON.stringify({ query, variables })
});
if (!r.ok) {
const text = await r.text();
throw new Error(`API hatası ${r.status}: ${text.slice(0, 300)}`);
}
const j = await r.json();
if (j?.errors?.length) throw new Error(j.errors.map(e => e.message).join('; '));
return j.data;
}

// ─── Category Helpers ─────────────────────────────────────────────────────────

async function getCategoryTree(token) {
const cacheKey = 'ikas:cat-tree:main-cat:v2';
const cached = await redisGet(cacheKey);
if (cached) return cached;

const data = await gql(token, '{ listCategory { id name parentId metaData { slug } salesChannelIds } }');
const cats = data?.listCategory || [];
await redisSet(cacheKey, cats, 900);
return cats;
}

function getDescendantIds(categories, rootId) {
const ids = [];
const queue = [rootId];
while (queue.length) {
const current = queue.shift();
const children = categories.filter(c => c.parentId === current);
for (const child of children) {
ids.push(child.id);
queue.push(child.id);
}
}
return ids;
}

// ─── Product Query ────────────────────────────────────────────────────────────

const PRODUCT_QUERY = `
query($categoryIds: CategoryFilterInput, $salesChannelIds: SalesChannelFilterInput, $pagination: PaginationInput) {
  listProduct(categoryIds: $categoryIds, salesChannelIds: $salesChannelIds, pagination: $pagination) {
    hasNext
    data {
      id name
      metaData { slug }
      baseUnit { type }
      attributes { value }
      variants {
        isActive
        prices { sellPrice discountPrice currency }
      }
    }
  }
}`;

async function fetchAllProducts(token, categoryIds) {
const seen = new Set();
const products = [];
let page = 1;

while (page <= 10) {
const data = await gql(token, PRODUCT_QUERY, {
categoryIds: { in: categoryIds },
salesChannelIds: { eq: STOREFRONT_CHANNEL_ID },
pagination: { limit: 200, page }
});

    const result = data?.listProduct;
    const items = result?.data || [];

    for (const p of items) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        products.push(p);
      }
    }

    if (!result?.hasNext) break;
    page++;

}

return products;
}

// ─── Dimension Extraction ─────────────────────────────────────────────────────

function parseDimensionsFromSlug(slug) {
if (!slug) return null;

const p1 = slug.match(/en--0-(\d{2,4})-cm--boy--0-(\d{2,4})-cm/);
if (p1) {
return { minWidth: parseInt(p1[1], 10), maxWidth: parseInt(p1[1], 10), minHeight: parseInt(p1[2], 10), maxHeight: parseInt(p1[2], 10) };
}

const p2 = slug.match(/(\d{2,4})-cm--boy--(?:0-)?((\d{2,4}))-cm/);
if (p2) {
return { minWidth: parseInt(p2[1], 10), maxWidth: parseInt(p2[1], 10), minHeight: parseInt(p2[2], 10), maxHeight: parseInt(p2[2], 10) };
}

const p3 = slug.match(/max(?:imum)?-(\d{2,4})x(\d{2,4})/);
if (p3) {
return { minWidth: null, maxWidth: parseInt(p3[1], 10), minHeight: null, maxHeight: parseInt(p3[2], 10) };
}

const p4 = slug.match(/(\d{2,4})x(\d{2,4})/);
if (p4) {
const w = parseInt(p4[1], 10);
const h = parseInt(p4[2], 10);
if (w >= 20 && h >= 20) {
return { minWidth: null, maxWidth: w, minHeight: null, maxHeight: h };
}
}

return null;
}

function extractDimensions(product) {
const attrs = product.attributes || [];
if (attrs.length > 0) {
const numericAttrs = attrs
.filter(a => a.value && /^\d+$/.test(a.value.trim()))
.map(a => parseInt(a.value.trim(), 10))
.filter(v => v >= 10 && v <= 500);

    if (numericAttrs.length === 2) {
      const [w, h] = numericAttrs.sort((a, b) => a - b);
      return { minWidth: w, maxWidth: w, minHeight: h, maxHeight: h };
    }

}

return parseDimensionsFromSlug(product.metaData?.slug);
}

// ─── Product Mapping (flat price, relative URL) ──────────────────────────────

function mapProduct(p) {
const slug = p.metaData?.slug;

const baseUnit = p.baseUnit?.type
? (BASE_UNIT_LABELS[p.baseUnit.type] || p.baseUnit.type.toLowerCase())
: null;

const allVariants = p.variants || [];
const activeVariants = allVariants.filter(v => v.isActive !== false);
const primaryVariant = activeVariants[0] || allVariants[0];
let price = null;
if (primaryVariant?.prices?.length) {
const prices = primaryVariant.prices;
const tryPrice = prices.find(pr => !pr.currency || pr.currency === 'TRY') || prices[0];
if (tryPrice) {
const hasDiscount = tryPrice.discountPrice && tryPrice.discountPrice < tryPrice.sellPrice;
price = Math.round((hasDiscount ? tryPrice.discountPrice : tryPrice.sellPrice) \* 100) / 100;
}
}

const dims = extractDimensions(p);
const raw = {
name: p.name,
price,
baseUnit,
dims: dims ? toDimsStr(dims) : null,
url: slug ? `/${slug}` : null
};

return stripNulls(raw);
}

// ─── Dimension String Helpers ─────────────────────────────────────────────────

function toDimsStr(dims) {
if (!dims) return null;
const w = dims.maxWidth || dims.minWidth;
const h = dims.maxHeight || dims.minHeight;
if (w && h) return `${w}x${h}`;
return null;
}

// ─── Color Extraction & Grouping (v6: full-scan) ─────────────────────────────

function extractColorAndType(name) {
let clean = name.trim().replace(/\s+/g, ' ');
// Remove dimension patterns in parentheses: (Max WxH), (WxH), etc.
clean = clean.replace(/\s*\([^)]*\d+x\d+[^)]_\)\s_/g, ' ').trim().replace(/\s+/g, ' ');

const lowerClean = trLower(clean);

// 1. Try multi-word colors first (longer match wins, prevents partial "gri" match)
for (const color of KNOWN_COLORS_MULTI) {
const idx = lowerClean.indexOf(color);
if (idx === -1) continue;
// Verify word boundaries
const beforeOk = idx === 0 || lowerClean[idx - 1] === ' ';
const afterIdx = idx + color.length;
const afterOk = afterIdx >= lowerClean.length || /[\s,;.]/.test(lowerClean[afterIdx]);
if (!beforeOk || !afterOk) continue;

    // Remove color from original string + clean up trailing comma/space
    const before = clean.substring(0, idx).trim();
    const after = clean.substring(afterIdx).replace(/^[,;.\s]+/, '').trim();
    const typeName = (before + (before && after ? ' ' : '') + after).replace(/\s+/g, ' ').trim();
    return { color: COLOR_DISPLAY[color], type: typeName || clean };

}

// 2. Try single-word colors: scan ALL positions, prefer rightmost match
// (rightmost = most likely the color variant, not part of product name)
const tokens = clean.split(/\s+/);

for (let i = tokens.length - 1; i >= 0; i--) {
const tokenClean = tokens[i].replace(/[,;.]+$/, ''); // strip trailing punctuation
const lowerToken = trLower(tokenClean);

    let matchedColor = null;
    if (KNOWN_COLORS_SINGLE.includes(lowerToken)) {
      matchedColor = lowerToken;
    } else if (lowerToken === 'beya') {
      matchedColor = 'beyaz'; // known ikas typo
    }

    if (matchedColor) {
      const remaining = [...tokens.slice(0, i), ...tokens.slice(i + 1)];
      let typeName = remaining.join(' ');
      // Clean up comma artifacts from color removal
      typeName = typeName
        .replace(/,\s*,/g, ',')           // double comma
        .replace(/^\s*,\s*/, '')           // leading comma
        .replace(/\s*,\s*$/, '')           // trailing comma
        .replace(/\s+/g, ' ')
        .trim();
      return { color: COLOR_DISPLAY[matchedColor], type: typeName || clean };
    }

}

// No color found
return { color: null, type: clean };
}

function normalizeGroupKey(typeName) {
let key = trLower(typeName);
key = key.replace(/\s+/g, ' ').trim();
// Fix known name variants (sineklikler typos)
key = key.replace(/sinekliğ(?!\w)/g, 'sineklik');
key = key.replace(/sinekli\s/g, 'sineklik ');
key = key.replace(/cam balkonlar\s/g, 'cam balkon ');
return key;
}

function pickDisplayName(typeNames) {
for (const name of typeNames) {
const lower = trLower(name);
if (!lower.includes('sinekliğ') && !lower.includes('cam balkonlar')) {
return name.replace(/\s+/g, ' ').trim();
}
}
return typeNames[0].replace(/\s+/g, ' ').trim();
}

function groupProducts(products) {
const groups = {};

for (const p of products) {
const { color, type: typeName } = extractColorAndType(p.name);
const dims = p.dims || '';
const key = normalizeGroupKey(typeName) + '|' + dims;

    if (!groups[key]) {
      groups[key] = { typeNames: [], variants: [], dims };
    }
    groups[key].typeNames.push(typeName);

    // Deduplicate by URL within group
    const url = p.url || '';
    const alreadyExists = groups[key].variants.some(v => v.url === url);
    if (!alreadyExists) {
      const variant = {};
      if (color) variant.color = color;
      if (p.price != null) variant.price = p.price;
      variant.url = url;
      groups[key].variants.push(variant);
    }

}

// Build sorted output array
const sortedKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'tr'));
return sortedKeys.map(key => {
const g = groups[key];
const displayName = pickDisplayName(g.typeNames);

    const out = { type: displayName };
    if (g.dims) out.dims = g.dims;

    // Same-price optimization: hoist price to group level if all variants share it
    const prices = g.variants.filter(v => v.price != null).map(v => v.price);
    const allSamePrice = prices.length === g.variants.length
      && prices.length > 1
      && new Set(prices).size === 1;

    if (allSamePrice) {
      out.price = prices[0];
      for (const v of g.variants) {
        delete v.price;
      }
    }

    out.variants = g.variants;
    return out;

});
}

// ─── Main Execution ───────────────────────────────────────────────────────────

async function execute(params) {
const mainCategory = String(params?.mainCategory || '').toLowerCase().trim();

if (!mainCategory || !VALID_CATEGORIES.includes(mainCategory)) {
return {
error: true,
message: `Geçersiz kategori: "${mainCategory || '(boş)'}". Geçerli kategoriler: ${VALID_CATEGORIES.join(', ')}`,
validCategories: VALID_CATEGORIES
};
}

const cacheKey = `ikas:main-cat:${mainCategory}:v6`;
const cached = await redisGet(cacheKey);
if (cached) return cached;

try {
const token = await getToken();
const allCategories = await getCategoryTree(token);

    const root = allCategories.find(c =>
      c.metaData?.slug === mainCategory && !c.parentId &&
      c.salesChannelIds?.includes(STOREFRONT_CHANNEL_ID)
    );

    if (!root) {
      return { error: true, message: `"${mainCategory}" ana kategorisi bulunamadı.` };
    }

    const descendantIds = getDescendantIds(allCategories, root.id);
    const allIds = [root.id, ...descendantIds];

    const rawProducts = await fetchAllProducts(token, allIds);
    const flatProducts = rawProducts
      .map(p => mapProduct(p))
      .filter(p => p !== undefined)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'));

    const groups = groupProducts(flatProducts);

    const result = {
      mainCategory: root.name,
      totalProducts: flatProducts.length,
      totalGroups: groups.length,
      baseUrl: STOREFRONT_BASE,
      groups
    };

    await redisSet(cacheKey, result, CACHE_TTL);
    return result;

} catch (err) {
return {
error: true,
message: `Ürünler yüklenirken hata oluştu: ${err.message}. Lütfen daha sonra tekrar deneyin.`
};
}
}

return execute(params);
