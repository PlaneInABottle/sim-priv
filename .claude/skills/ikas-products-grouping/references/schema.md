# API Schema

## Tool Parameters

```typescript
{
  type: "object",
  properties: {
    mainCategory: {
      type: "string",
      enum: ["sineklikler", "tülüler", "klasikler", ...],
      description: "Main product category from ikas storefront"
    }
  },
  required: ["mainCategory"]
}
```

## Response Schema (Grouped Format)

```json
{
  "mainCategory": "sineklikler",
  "categoryLabel": "Sineklikler",
  "totalProducts": 100,
  "totalGroups": 39,
  "groups": [
    {
      "type": "Akordeon DUBLE Kapı Sineklik",
      "dims": "290x240",
      "price": 4621.5,
      "variants": [
        {
          "color": "Antrasit",
          "url": "/products/akordeon-duble-kapi-sineklik-antrasit"
        },
        {
          "color": "Beyaz",
          "url": "/products/akordeon-duble-kapi-sineklik-beyaz"
        },
        {
          "color": "Altınmeşe",
          "price": 5220,
          "url": "/products/akordeon-duble-kapi-sineklik-altinmese"
        }
      ]
    }
  ]
}
```

## Field Definitions

### Root Level

| Field | Type | Description |
|-------|------|-------------|
| `mainCategory` | string | Category slug (lowercase, hyphenated) |
| `categoryLabel` | string | Human-readable category name (Turkish) |
| `totalProducts` | number | Count of products in category (before grouping) |
| `totalGroups` | number | Count of groups (after grouping) |
| `groups` | array | Array of grouped products |

### Group Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Product type (base name without color) |
| `dims` | string | No | Dimensions: "widthxheight" (e.g., "290x240") |
| `price` | number | No | Base price in TRY. Omit if variants have different prices |
| `variants` | array | Yes | Color/price variants of this type |

### Variant Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `color` | string | Yes | Color name in Turkish (e.g., "Beyaz", "Antrasit") |
| `url` | string | Yes | Relative URL path (e.g., "/products/slug") |
| `price` | number | No | Price override. Only if different from group price |

## Color Palette (Kamatas Example)

```javascript
const colors = [
  "Beyaz",
  "Antrasit",
  "Altınmeşe",
  "Kahverengi",
  "Naturel",
  "Gri",
  "Ara Gri",
  "Metalik Gri",
  "Siyah",
  "Koyu Gri",
  "Ceviz",
  "Çelik",
  "Mermer",
  "Mermer Beyaz",
  "Mermer Siyah"
];
```

**Notes on color extraction:**
- Multi-word colors: "Metalik Gri", "Mermer Beyaz" (check longest matches first)
- Case-sensitive match
- Colors removed from product name suffix during base type extraction
- If no color found: use "Standart"

## ikas GraphQL Integration

### OAuth2 Token

```graphql
POST /api/admin/oauth/token

Request:
{
  "grant_type": "client_credentials",
  "client_id": "{{ENV_IKAS_CLIENT_ID}}",
  "client_secret": "{{ENV_IKAS_CLIENT_SECRET}}"
}

Response:
{
  "access_token": "eyJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### Product Query

```graphql
query ListProductsByCategory(
  $categoryId: ID!
  $salesChannelId: ID!
) {
  listProducts(
    filter: {
      AND: [
        { categories: { any: { id: { eq: $categoryId } } } }
        { salesChannels: { any: { id: { eq: $salesChannelId } } } }
      ]
    }
    first: 100
  ) {
    nodes {
      id
      name
      variants {
        id
        name
        price {
          amount
          currency
        }
        attributes {
          key
          value
        }
        images {
          path
        }
      }
    }
  }
}
```

**Variables:**
```json
{
  "categoryId": "7cbc724c-...",
  "salesChannelId": "c2a8f4e0-..."
}
```

### Category Discovery

Get available main categories once (cache result):

```graphql
query ListCategories($salesChannelId: ID!) {
  listCategories(
    filter: {
      salesChannels: { any: { id: { eq: $salesChannelId } } }
      parent: { isNull: true }
    }
  ) {
    nodes {
      id
      name
      slug
    }
  }
}
```

Result updates tool's enum:
```
mainCategory enum = [slug1, slug2, ...]
```

## Token Efficiency Metrics

### Before Grouping (Flat)

100 products × ~55 tokens/product = **~5,500 tokens**

Breakdown per product:
- Product name: 8 tokens
- Color: 2 tokens
- Dimensions: 4 tokens
- Price object: 6 tokens
- URL: 8 tokens
- Variant array overhead: 27 tokens

### After Grouping (v6 Schema)

39 groups × ~60 tokens/group = **~2,300 tokens**

Savings by optimization:
- Deduplication: −89 products (−4,895 tokens)
- Relative URLs: −200 tokens (removed domain)
- Price hoisting: −300 tokens (moved outside variants)
- Omit nulls: −180 tokens (no empty fields)
- Dimension format: −100 tokens (simple string vs object)

**Result: 58% savings**

## Environment Variables

```
IKAS_CLIENT_ID=client_...
IKAS_CLIENT_SECRET=secret_...
SALES_CHANNEL_ID=c2a8f4e0-...
STORE_BASE_URL=https://kamatas.com
STORE_CATEGORIES_CACHE_TTL=86400  # 24 hours
```

## Error Handling

```javascript
// Invalid category
{
  "error": "Invalid mainCategory. Valid options: sineklikler, tülüler, klasikler",
  "code": "INVALID_CATEGORY"
}

// ikas API error
{
  "error": "Failed to fetch from ikas API",
  "code": "IKAS_API_ERROR",
  "details": "GraphQL error: ..."
}

// Network timeout
{
  "error": "Request timed out",
  "code": "TIMEOUT"
}
```
