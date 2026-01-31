#!/usr/bin/env node
/**
 * Test Product Detail API
 * Fetches comprehensive product information via GraphQL
 *
 * Usage: node scripts/ikas/features/test-product-detail.js
 */

import {
  fetchProductDetail,
  fetchProducts,
  getToken,
  introspectType,
  printHeader,
  separator,
  TEST_CATEGORIES,
} from '../lib/index.js'

function displayProductDetails(product) {
  separator('═')
  console.log('📦 PRODUCT DETAILS')
  separator('═')

  // Basic Info
  console.log('\n📌 BASIC INFO')
  console.log(`   ID: ${product.id}`)
  console.log(`   Name: ${product.name}`)
  if (product.shortDescription) {
    console.log(
      `   Short Desc: ${product.shortDescription.substring(0, 100)}${product.shortDescription.length > 100 ? '...' : ''}`
    )
  }
  if (product.description) {
    const desc = product.description.replace(/<[^>]*>/g, '').substring(0, 150)
    console.log(`   Description: ${desc}${product.description.length > 150 ? '...' : ''}`)
  }

  // Stock
  console.log('\n📊 STOCK')
  console.log(`   Total Stock: ${product.totalStock ?? 'N/A'}`)

  // Categories
  if (product.categories?.length) {
    console.log('\n📂 CATEGORIES')
    product.categories.forEach((cat) => {
      console.log(`   - ${cat.name} (${cat.id})`)
    })
  } else if (product.categoryIds?.length) {
    console.log('\n📂 CATEGORIES')
    console.log(`   IDs: ${product.categoryIds.join(', ')}`)
  }

  // Brand
  if (product.brand || product.brandId) {
    console.log('\n🏭 BRAND')
    if (product.brand) console.log(`   Name: ${product.brand.name} (${product.brand.id})`)
    else if (product.brandId) console.log(`   ID: ${product.brandId}`)
  }

  // Tags
  if (product.tags?.length) {
    console.log('\n🏷️  TAGS')
    const tagNames = product.tags.map((t) => (typeof t === 'string' ? t : t.name)).join(', ')
    console.log(`   ${tagNames}`)
  }

  // Variant Types
  if (product.productVariantTypes?.length) {
    console.log('\n🎨 VARIANT TYPES')
    product.productVariantTypes.forEach((vt) => {
      const values = vt.values?.map((v) => v.name).join(', ') || 'N/A'
      console.log(`   ${vt.name}: ${values}`)
    })
  }

  // Variants
  if (product.variants?.length) {
    console.log(`\n📦 VARIANTS (${product.variants.length} total)`)
    product.variants.slice(0, 3).forEach((v, i) => {
      console.log(`\n   Variant ${i + 1}:`)
      console.log(`     ID: ${v.id}`)
      console.log(`     SKU: ${v.sku || 'N/A'}`)
      console.log(`     Barcodes: ${v.barcodeList?.join(', ') || 'N/A'}`)
      console.log(`     Active: ${v.isActive}`)

      if (v.prices?.length) {
        console.log(`     Prices:`)
        v.prices.forEach((p) => {
          const currency = p.currency || 'TRY'
          const discount =
            p.discountPrice !== null && p.discountPrice !== undefined
              ? `, Discount: ${p.discountPrice}`
              : ''
          console.log(`       - Sell: ${p.sellPrice} ${currency}${discount}`)
        })
      }

      if (v.stocks?.length) {
        console.log(`     Stock by Location:`)
        v.stocks.forEach((s) => {
          console.log(`       - ${s.stockLocationId}: ${s.stockCount} units`)
        })
      }

      if (v.images?.length) {
        console.log(`     Images: ${v.images.length} image(s)`)
        v.images.slice(0, 2).forEach((img) => {
          const mainFlag = img.isMain ? ' ⭐' : ''
          console.log(`       - ${img.imageId}${mainFlag}`)
        })
      }
    })

    if (product.variants.length > 3) {
      console.log(`\n   ... and ${product.variants.length - 3} more variants`)
    }
  }

  // Timestamps
  console.log('\n📅 TIMESTAMPS')
  const createdDate = product.createdAt ? new Date(product.createdAt).toISOString() : 'N/A'
  const updatedDate = product.updatedAt ? new Date(product.updatedAt).toISOString() : 'N/A'
  console.log(`   Created: ${createdDate}`)
  console.log(`   Updated: ${updatedDate}`)

  separator('═')
}

async function main() {
  try {
    printHeader('🚀 IKAS Product Detail API Test')

    const token = await getToken()

    // Introspect to discover available fields
    console.log('\n🔍 Introspecting Product type fields...\n')
    const productFields = await introspectType(token, 'Product')
    console.log(
      '📋 Available Product fields:',
      productFields
        .map((f) => f.name)
        .slice(0, 10)
        .join(', '),
      '...'
    )

    // Get products from test category
    console.log(`\n📦 Fetching products from test category...\n`)
    const products = await fetchProducts(token, TEST_CATEGORIES.KOSEBENTLER_25X25, 5)

    if (products.length === 0) {
      console.log('❌ No products found in category')
      return
    }

    console.log(`Found ${products.length} products:`)
    products.forEach((p, i) => console.log(`   ${i + 1}. ${p.name}`))

    // Fetch full details for first product
    console.log(`\n🛍️  Fetching product detail for: ${products[0].name}\n`)
    const product = await fetchProductDetail(token, products[0].id)

    if (!product) {
      console.log('❌ Could not fetch product details')
      return
    }

    // Display formatted product details
    displayProductDetails(product)

    console.log('\n✅ Test completed successfully!')
  } catch (error) {
    console.error('\n❌ TEST FAILED')
    console.error('Error:', error.message)
    if (error.stack) {
      console.error('\nStack trace:')
      console.error(error.stack)
    }
    process.exit(1)
  }
}

main()
