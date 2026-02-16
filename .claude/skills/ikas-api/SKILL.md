---
name: ikas-api
description: Complete guide for working with the ikas e-commerce Admin API (GraphQL). Use when the AI agent needs to (1) query or manage products, orders, customers, categories, or inventory on an ikas store, (2) authenticate via OAuth2 client_credentials, (3) write GraphQL queries/mutations for ikas, (4) handle ikas-specific patterns like pagination, filtering, date timestamps, phone lookups, or webhook configuration. Covers all Admin API endpoints, type definitions, and proven production patterns.
---

# ikas Admin API

## Quick Start

**Endpoint:** `https://api.myikas.com/api/v1/admin/graphql` (POST, JSON)
**Auth:** Bearer token via OAuth2 `client_credentials` grant

```js
// 1. Get token
const res = await fetch('https://<store>.myikas.com/api/admin/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'grant_type=client_credentials&client_id=<ID>&client_secret=<SECRET>'
});
const { access_token } = await res.json(); // expires_in: 14400s (4h)

// 2. GraphQL query
const data = await fetch('https://api.myikas.com/api/v1/admin/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${access_token}` },
  body: JSON.stringify({ query: '{ listCategory { id name parentId } }' })
});
```

## Core Concepts

### Pagination
All list queries use page-based pagination: `pagination: { limit: N, page: N }` (1-indexed).
Response: `{ count, data [...], hasNext, limit, page }`. Max limit: 200.

### Filter Types
| Type | Usage | Example |
|------|-------|---------|
| `StringFilterInput` | Exact or set match | `{ eq: "val" }` or `{ in: ["a","b"] }` |
| `DateFilterInput` | Date range (Unix ms) | `{ gte: 1700000000000, lte: 1710000000000 }` |
| `CategoryFilterInput` | Category set filter | `{ in: ["cat-id-1"] }` |
| `PaginationInput` | Page + limit | `{ limit: 50, page: 1 }` |
| Enum filters | Exact enum match | `{ eq: "PAID" }` |

### Sorting
String parameter, prefix `-` for descending: `sort: "-orderedAt"`, `sort: "name"`.
Sortable fields vary per query (commonly: `createdAt`, `updatedAt`, `name`, `orderedAt`).

### ⚠️ Critical Gotchas
- **Timestamps are Unix milliseconds** (numbers), NOT ISO strings. Convert: `new Date(timestamp)`
- **No direct phone filter** on orders — find customer first via `listCustomer(search: phone)`, then `listOrder(customerId: { eq: id })`
- **`search` on listCustomer** searches across name, email, phone fields
- **`search` on listOrder** searches order numbers only, NOT customer fields
- **Token expires in 4 hours** (14400s) — cache and refresh on 401

## API Coverage

### Queries (Read)
| Query | Key Filters | Reference |
|-------|-------------|-----------|
| `listProduct` | id, name, categoryIds, brandId, sku, barcodeList, tagIds, salesChannelIds | [products.md](references/products.md) |
| `searchProducts` | SearchInput (text search) | [products.md](references/products.md) |
| `listOrder` | id, orderNumber, customerId, customerEmail, status, orderedAt, search | [orders.md](references/orders.md) |
| `listCustomer` | id, email, phone, search, updatedAt | [customers.md](references/customers.md) |
| `listCategory` | id, name, categoryPath, search | [categories-and-more.md](references/categories-and-more.md) |
| `listSalesChannel` | id | [categories-and-more.md](references/categories-and-more.md) |
| `listStockLocation` | id, name | [categories-and-more.md](references/categories-and-more.md) |
| `listProductStockLocation` | productId, variantId, stockLocationId | [categories-and-more.md](references/categories-and-more.md) |
| `getMerchant` | — | [categories-and-more.md](references/categories-and-more.md) |
| `me` | — | [categories-and-more.md](references/categories-and-more.md) |
| `listWebhook` | — | [categories-and-more.md](references/categories-and-more.md) |

### Mutations (Write)
| Mutation | Purpose | Reference |
|----------|---------|-----------|
| `saveProduct` | Create/update product | [products.md](references/products.md) |
| `deleteProductList` | Delete products by ID list | [products.md](references/products.md) |
| `bulkUpdateProducts` | Batch update products | [products.md](references/products.md) |
| `saveVariantPrices` | Update variant pricing | [products.md](references/products.md) |
| `updateProductSalesChannelStatus` | Toggle product visibility | [products.md](references/products.md) |
| `saveProductStockLocations` | Update stock counts | [categories-and-more.md](references/categories-and-more.md) |
| `saveCategory` / `deleteCategoryList` | Manage categories | [categories-and-more.md](references/categories-and-more.md) |
| `createOrderWithTransactions` | Create order | [orders.md](references/orders.md) |
| `updateOrderPackageStatus` | Update shipping status | [orders.md](references/orders.md) |
| `fulfillOrder` / `cancelFulfillment` | Manage fulfillment | [orders.md](references/orders.md) |
| `refundOrderLine` | Process refunds | [orders.md](references/orders.md) |
| `updateOrderAddresses` | Change order addresses | [orders.md](references/orders.md) |
| `saveWebhook` / `deleteWebhook` | Manage webhooks | [categories-and-more.md](references/categories-and-more.md) |

## Common Patterns

### Customer Order Lookup (by phone)
```graphql
# Step 1: Find customer
query($search: String, $pagination: PaginationInput) {
  listCustomer(search: $search, pagination: $pagination) {
    count
    data { id firstName lastName phone email }
  }
}
# Variables: { "search": "+905551234567", "pagination": { "limit": 20, "page": 1 } }

# Step 2: Get their orders
query($customerId: StringFilterInput, $pagination: PaginationInput, $sort: String) {
  listOrder(customerId: $customerId, pagination: $pagination, sort: $sort) {
    count
    data { orderNumber status orderedAt totalFinalPrice currencyCode
      orderLineItems { quantity finalPrice variant { name sku } } }
  }
}
# Variables: { "customerId": { "eq": "<id>" }, "pagination": { "limit": 10, "page": 1 }, "sort": "-orderedAt" }
```

### Orders by Date Range
```graphql
query($orderedAt: DateFilterInput, $pagination: PaginationInput) {
  listOrder(orderedAt: $orderedAt, pagination: $pagination) {
    count
    data { orderNumber status totalFinalPrice orderedAt }
  }
}
# Variables: { "orderedAt": { "gte": <unix_ms_start>, "lte": <unix_ms_end> }, "pagination": { "limit": 50, "page": 1 } }
```

### Products by Category
```graphql
query($categoryIds: CategoryFilterInput, $pagination: PaginationInput) {
  listProduct(categoryIds: $categoryIds, pagination: $pagination) {
    data { id name totalStock metaData { slug }
      variants { id isActive prices { sellPrice discountPrice currency } } }
  }
}
# Variables: { "categoryIds": { "in": ["<category-id>"] }, "pagination": { "limit": 30, "page": 1 } }
```

## References

Read these files for complete field definitions, type schemas, and detailed examples:

- **[references/products.md](references/products.md)** — Product type schema, listProduct filters, saveProduct mutation, variant/price/stock management, image upload REST endpoint
- **[references/orders.md](references/orders.md)** — Order type schema (50+ fields), all listOrder filters, order mutations (fulfill, refund, cancel, create), enum values, full response examples
- **[references/customers.md](references/customers.md)** — Customer type schema, listCustomer filters, address model, phone lookup patterns
- **[references/categories-and-more.md](references/categories-and-more.md)** — Categories, sales channels, stock locations, merchant info, webhooks, product attributes, brands, tags, variant types

## IKAS Search Product Dimension Parsing

### Critical Slug Patterns

IKAS product URLs encode dimensions in slugs. Custom tools MUST parse these patterns:

| Pattern | Regex | Example | Result |
|---------|-------|---------|--------|
| Structured (standard) | `/en--0-(\d{2,4})-cm--boy--0-(\d{2,4})-cm/` | `menteseli-pencere-sinekligi-antrasit--en--0-70-cm--boy--0-130-cm` | 70×130 |
| Short variant | `/(\d{2,4})-cm--boy--(?:0-)?(\d{2,4})-cm/` | `70-cm--boy--130-cm` | 70×130 |
| DUBLE/Special | `/maximum-(\d{2,4})x(\d{2,4})/` | `double-akordiyon-sineklik-pencere-beyaz-maximum-290x150` | 290×150 |

**Parse order:** Try Pattern 1 → Pattern 2 → Pattern 3 → fallback to null

**Critical rules:**
- Products with `dimensions: null` = unknownDimensions bucket
- Never suggest unknownDimensions products without manual verification
- DUBLE products use `maximum-WxH` format (product's maximum capacity)

### SearchProducts vs ListProduct GraphQL

**SearchProducts:**
- Field: `searchProducts(input: SearchInput!)`
- Response: `results { ... }`
- NO categoryIds filter support
- Use for: broad text search across all products

**ListProduct:**
- Field: `listProduct(categoryIds: [UUID!], pagination: Pagination)`
- Response: `data { ... }`
- Supports categoryIds filter
- Use for: category-scoped search when categoryId known

**Don't mix:** searchProducts uses `input` object, listProduct uses separate args.

### Common GraphQL Validation Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot query field "id" on type "SearchProductVariantType"` | Querying flat fields on nested type | Use `productVariantTypes { order variantType { id name } variantValueIds }` |
| `Cannot query field "values" on type "SearchProductVariantType"` | Wrong field name | Use `variantValueIds` instead of `values` |
| `GraphQL HTTP 400` with searchProducts | Wrong query structure | Use `searchProducts(input: $input)` not `searchProducts(search: $search, pagination: $pagination)` |
