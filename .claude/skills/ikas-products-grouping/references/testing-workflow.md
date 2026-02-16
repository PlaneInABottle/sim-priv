# Testing Workflow

## Phase 1: Local JavaScript Test (Before Sim Studio)

Create a standalone test script to validate transformation logic without touching the UI.

### 1.1 Mock ikas Response

```javascript
// test-products.js
const mockProducts = [
  {
    id: "prod-1",
    name: "Akordeon DUBLE Kapı Sineklik Antrasit",
    price: { amount: 4621.5, currency: "TRY" },
    variants: [
      { id: "var-1", dimensions: { maxWidth: 290, maxHeight: 240 } }
    ],
    imagePath: "/images/sineklik-1.jpg"
  },
  // ... more products
];

module.exports = { mockProducts };
```

### 1.2 Transformation Functions

```javascript
const colors = [
  "Beyaz", "Antrasit", "Altınmeşe", "Kahverengi", "Naturel", 
  "Gri", "Ara Gri", "Metalik Gri", "Siyah", "Koyu Gri",
  "Ceviz", "Çelik", "Mermer", "Mermer Beyaz", "Mermer Siyah"
];

function extractColor(name) {
  for (const color of colors) {
    if (name.includes(color)) return color;
  }
  return null;
}

function extractBaseType(name) {
  let baseName = name.trim();
  for (const color of colors) {
    baseName = baseName.replace(new RegExp(`\\s*${color}\\s*$`), "").trim();
  }
  return baseName;
}

function serializeDims(dims) {
  if (!dims) return null;
  const w = dims.maxWidth ?? dims.width ?? dims.minWidth;
  const h = dims.maxHeight ?? dims.height ?? dims.minHeight;
  return (w && h) ? `${w}x${h}` : null;
}

module.exports = { extractColor, extractBaseType, serializeDims, colors };
```

### 1.3 Grouping Function

```javascript
function groupProducts(products) {
  const groups = new Map();

  for (const product of products) {
    const color = extractColor(product.name);
    const baseType = extractBaseType(product.name);
    const dims = serializeDims(product.variants?.[0]?.dimensions);
    const groupKey = dims ? `${baseType}|${dims}` : baseType;
    const price = product.price?.amount;
    const url = product.imagePath;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        type: baseType,
        ...(dims && { dims }),
        price,
        variants: []
      });
    }

    const group = groups.get(groupKey);
    const variant = { color: color || "Standart", url };
    
    if (price !== group.price) {
      variant.price = price;
    }
    
    group.variants.push(variant);
  }

  return Array.from(groups.values());
}

module.exports = { groupProducts };
```

### 1.4 Test Runner

```javascript
const { mockProducts } = require('./test-products');
const { groupProducts, extractColor, extractBaseType, serializeDims } = require('./transformations');

console.log('=== Color Extraction ===');
const product1 = mockProducts[0];
console.log(`Name: ${product1.name}`);
console.log(`Color: ${extractColor(product1.name)}`);
console.log(`Base Type: ${extractBaseType(product1.name)}`);

console.log('\n=== Grouping ===');
const grouped = groupProducts(mockProducts);
console.log(`Products: ${mockProducts.length}`);
console.log(`Groups: ${grouped.length}`);
console.log(`Token Savings: ${Math.round(100 * (1 - grouped.length / mockProducts.length))}%`);

console.log('\n=== Sample Group ===');
console.log(JSON.stringify(grouped[0], null, 2));
```

### 1.5 Run Test

```bash
node test-products.js
```

Expected output:
```
=== Color Extraction ===
Name: Akordeon DUBLE Kapı Sineklik Antrasit
Color: Antrasit
Base Type: Akordeon DUBLE Kapı Sineklik

=== Grouping ===
Products: 100
Groups: 39
Token Savings: 61%

=== Sample Group ===
{
  "type": "Akordeon DUBLE Kapı Sineklik",
  "dims": "290x240",
  "price": 4621.5,
  "variants": [
    { "color": "Antrasit", "url": "/..." },
    { "color": "Beyaz", "url": "/..." }
  ]
}
```

---

## Phase 2: Isolated Tool Test in Sim Studio

Create the tool and test with **minimal blocks enabled** (trigger + tool + response only).

### 2.1 Create Custom Tool via MCP

```typescript
const toolConfig = {
  title: "Get Products by Main Category",
  schema: {
    type: "function",
    function: {
      name: "get_products_by_main_category",
      description: "Fetch grouped products by main category",
      parameters: {
        type: "object",
        properties: {
          mainCategory: {
            type: "string",
            enum: ["sineklikler", "tülüler", "klasikler"],
            description: "Product category"
          }
        },
        required: ["mainCategory"]
      }
    }
  },
  code: `
    // Tool code here - same transformation + grouping logic
    // See references/tool-code.md for full implementation
  `
};

// Use sim-mcp: sim-mcp-upsert_custom_tools({ workspaceId, tools: [toolConfig] })
```

### 2.2 Create Test Workflow

1. Create a **separate test workflow** (or disable blocks in existing one)
2. Keep only: `api_trigger` → `agent` → `response`
3. Agent uses the new tool
4. Execute: `sim-mcp-execute_workflow(useDraftState: true)`

### 2.3 Check Results

```typescript
// Get execution logs
sim-mcp-get_execution_logs({ 
  workspaceId, 
  workflowId,
  includeTraceSpans: true,
  includeFinalOutput: true 
})

// Look for:
// ✓ Tool executed successfully
// ✓ Output matches expected schema
// ✓ No errors in transformations
```

### 2.4 Measure Token Usage

From execution logs:
```json
{
  "cost": 0.015,  // Cost in USD (proportional to tokens)
  "traceSpans": [
    {
      "name": "agent_block",
      "inputTokens": 450,
      "outputTokens": 320
    }
  ]
}
```

---

## Phase 3: Full Integration Test

After isolated testing passes:

1. **Enable other blocks** in production workflow
2. Test realistic conversation flows
3. Verify agent routing (when to use tool vs other blocks)
4. Check token usage across multiple categories
5. Monitor performance in production

### 3.1 Conversation Test Cases

```
User: "Show me products in sineklikler"
Expected: Agent calls tool, returns grouped products, lists 3-5 variants

User: "What colors are available?"
Expected: Agent extracts colors from previous tool response

User: "I need a 290x240 sineklik"
Expected: Agent filters groups by dimension
```

### 3.2 Multi-Category Performance

Test with all categories to ensure consistent token savings:

```
- sineklikler: 100 products → 39 groups (61%)
- tülüler: 80 products → 28 groups (65%)
- klasikler: 120 products → 41 groups (66%)
```

---

## Common Issues and Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Color not extracted | Missing color in palette | Add to `colors` array |
| Null dimensions | Product missing dimensions | Add fallback: `dims ?? "standard"` |
| Variants not grouped | Group key mismatch | Check `baseType` extraction logic |
| High token usage | Nested objects not flattened | Remove unnecessary fields, use scalars |
| Tool times out | ikas API slow | Add Redis cache, implement pagination |
