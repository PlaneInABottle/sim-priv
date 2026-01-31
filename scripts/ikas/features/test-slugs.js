#!/usr/bin/env node
/**
 * Test Slug Retrieval and URL Construction
 * Verifies slug data is available for categories and products
 *
 * Usage: node scripts/ikas/features/test-slugs.js
 */

import {
  constructCategoryUrl,
  constructProductUrl,
  fetchCategories,
  fetchProducts,
  getToken,
  printHeader,
  separator,
} from '../lib/index.js'

async function testCategorySlugs(token, categories) {
  console.log('\n=== Testing Category Slugs ===\n')
  console.log(`Found ${categories.length} categories\n`)

  // Test first 5 categories
  const testCategories = categories.slice(0, 5)

  for (const cat of testCategories) {
    const slug = cat.metaData?.slug
    const url = constructCategoryUrl(slug)

    console.log(`Category: ${cat.name}`)
    console.log(`  ID: ${cat.id}`)
    console.log(`  Slug: ${slug || 'MISSING'}`)
    console.log(`  URL: ${url || 'NO URL'}`)
    console.log()
  }

  return categories
}

async function testProductSlugs(token, categoryId) {
  console.log('\n=== Testing Product Slugs ===\n')

  const products = await fetchProducts(token, categoryId, 5)
  console.log(`Found ${products.length} products\n`)

  for (const product of products) {
    const slug = product.metaData?.slug
    const url = constructProductUrl(slug)

    const activeVariant = product.variants?.find((v) => v.isActive)
    const price = activeVariant?.prices?.[0]

    console.log(`Product: ${product.name}`)
    console.log(`  ID: ${product.id}`)
    console.log(`  Slug: ${slug || 'MISSING'}`)
    console.log(`  URL: ${url || 'NO URL'}`)
    console.log(`  Price: ${price?.sellPrice || 'N/A'} ${price?.currency || 'TRY'}`)
    console.log(`  Stock: ${product.totalStock || 0}`)
    console.log()
  }

  return products
}

async function main() {
  try {
    printHeader('🔗 Testing IKAS Slug Logic')

    console.log('Getting IKAS token...')
    const token = await getToken()
    console.log('✓ Token obtained')

    // Test categories
    const categories = await fetchCategories(token)
    await testCategorySlugs(token, categories)

    // Find a category with products (not a parent category)
    const leafCategory = categories.find((cat) => !categories.some((c) => c.parentId === cat.id))

    if (leafCategory) {
      console.log(`\nUsing leaf category: ${leafCategory.name} (${leafCategory.id})`)
      await testProductSlugs(token, leafCategory.id)
    }

    // Test URL construction functions
    separator()
    console.log('Testing URL Construction Functions')
    separator()

    const testSlug =
      'antrasit-aluminyum-dikey-karavan-sineklik-ve-perde-istedigin-olcude-max-100x60'
    console.log(`\nProduct URL: ${constructProductUrl(testSlug)}`)
    console.log(`Category URL: ${constructCategoryUrl('kosebentler-1')}`)

    separator()
    console.log('✓ All tests completed successfully!')
    separator()
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

main()
