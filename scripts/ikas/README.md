# IKAS Test Suite

Comprehensive test suite for the IKAS e-commerce API integration.

## Directory Structure

```
scripts/ikas/
├── lib/                      # Shared utilities
│   ├── config.js             # Configuration constants
│   ├── auth.js               # OAuth and token management
│   ├── graphql.js            # GraphQL query utilities
│   ├── helpers.js            # Common helper functions
│   └── index.js              # Barrel export
├── browse/                   # Browse tool tests
│   ├── test-browse-urls.js   # URL generation tests
│   ├── test-browse-prices.js # Price inclusion tests
│   ├── test-filter-empty.js  # Empty category filtering
│   └── test-tree-first.js    # Tree-first approach tests
├── features/                 # Feature-specific tests
│   ├── test-slugs.js         # Slug retrieval tests
│   ├── test-metadata.js      # Metadata extraction tests
│   ├── test-product-detail.js # Product detail API tests
│   ├── test-category-check.js # Category inspection
│   └── test-visibility.js    # Sales channel visibility
├── analysis/                 # Catalog analysis scripts
│   ├── explore-catalog.js    # Full catalog exploration
│   ├── check-empty-categories.js # Empty category finder
│   ├── find-storefront-url.js # URL discovery
│   └── test-openrouter-capabilities.js # OpenRouter model tests
├── test-basic.js             # Basic API connectivity test
├── test-cached-token.js      # Token caching test
└── README.md                 # This file
```

## Quick Start

```bash
# Run basic API test
node scripts/ikas/test-basic.js

# Run browse tests
node scripts/ikas/browse/test-browse-prices.js

# Explore the catalog
node scripts/ikas/analysis/explore-catalog.js
```

## Test Categories

### Basic Tests
- **test-basic.js** - Tests OAuth authentication and basic API connectivity
- **test-cached-token.js** - Tests Redis-based token caching

### Browse Tests (`browse/`)
Tests for the `ikas_browse` tool functionality (step-by-step navigation):

| Test | Purpose |
|------|---------|
| `test-browse-urls.js` | URL generation for categories and products |
| `test-browse-prices.js` | Price data inclusion in browse results |
| `test-filter-empty.js` | Empty leaf category filtering logic |

### Feature Tests (`features/`)
Tests for specific API features:

| Test | Purpose |
|------|---------|
| `test-slugs.js` | Slug retrieval and URL construction |
| `test-metadata.js` | Metadata field extraction |
| `test-product-detail.js` | Full product detail API |
| `test-category-check.js` | Category content inspection |
| `test-visibility.js` | Sales channel visibility analysis |

### Analysis Scripts (`analysis/`)
Tools for catalog exploration and diagnostics:

| Script | Purpose |
|--------|---------|
| `explore-catalog.js` | Map entire catalog structure |
| `check-empty-categories.js` | Find categories without products |
| `find-storefront-url.js` | Discover correct storefront URL |
| `test-openrouter-capabilities.js` | Check model capabilities |

## Configuration

All tests share configuration from `lib/config.js`:

```javascript
// API Endpoints
OAUTH_URL: 'https://kamatas.myikas.com/api/admin/oauth/token'
GRAPHQL_URL: 'https://api.myikas.com/api/v1/admin/graphql'

// Storefront URLs
STOREFRONT_BASE: 'https://kamatas.com'
PRODUCT_PATH_PREFIX: '/urun/'
CATEGORY_PATH_PREFIX: '/'
```

## Key Findings

### Navigation Logic
- Categories with visible subcategories → Show ONLY visible subcategories
- Leaf categories (no visible children) → Show products with prices
- Hidden categories (no salesChannelIds) → Filtered out from results
- Empty leaf categories → Filter out from results

### Category Visibility
Categories are filtered based on `salesChannelIds`:
```javascript
// A category is visible if it has salesChannelIds assigned
function isVisibleCategory(category) {
  return category.salesChannelIds && category.salesChannelIds.length > 0
}
```

### URL Construction
```javascript
// Product URL
`https://kamatas.com/urun/${product.metaData.slug}`

// Category URL  
`https://kamatas.com/${category.metaData.slug}`
```

### Price Data Location
- Prices are stored at VARIANT level, not product level
- Use `variants[0].prices[0].sellPrice` for display price
- Check `discountPrice` for sale prices

### Known Empty/Hidden Categories
The following categories have no products or are not assigned to sales channels:
- Double Kasalı Akordiyon Sineklikleri (Max 280x200)
- 40x40 Köşebentler
- 50x50 Köşebentler
- İçten Takma Akordiyon Pencere Sineklikleri
- Nobel Pencere Akordiyon Sineklikleri
- Nobel Kapı Akordiyon Sineklikleri

These are automatically filtered out when browsing the catalog.

## Development

### Adding New Tests

1. Create test file in appropriate directory
2. Import utilities from `../lib/index.js`
3. Use `printHeader()` and `separator()` for formatting
4. Handle errors with `process.exit(1)`

### Example Test Template

```javascript
#!/usr/bin/env node
import {
  getToken,
  fetchCategories,
  separator,
  printHeader,
} from '../lib/index.js'

async function main() {
  try {
    printHeader('🚀 My New Test')
    
    const token = await getToken()
    // ... test logic
    
    separator()
    console.log('✅ TEST PASSED')
    separator()
  } catch (error) {
    console.error('❌ TEST FAILED:', error.message)
    process.exit(1)
  }
}

main()
```

## Notes

- All tests use ES modules (`.js` files with `import`)
- Tests are standalone and don't require a test framework
- Credentials are hardcoded for development convenience
- For production, use environment variables
