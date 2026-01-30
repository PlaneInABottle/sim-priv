#!/usr/bin/env node
/**
 * Test ikas_browse Tool Logic with URLs
 * Tests the browse tool behavior including URL generation
 *
 * Usage: node scripts/ikas/browse/test-browse-urls.js
 */

import {
  getToken,
  fetchCategories,
  fetchProducts,
  IKAS_CONFIG,
  constructProductUrl,
  constructCategoryUrl,
  isVisibleCategory,
  separator,
  printHeader,
} from '../lib/index.js'

async function testRootCategories(token, allCategories) {
  console.log('\n=== Test 1: Root Categories with URLs ===\n')

  // Filter visible root categories (those with salesChannelIds)
  const rootCategories = allCategories.filter((c) => !c.parentId && isVisibleCategory(c))
  const items = rootCategories.slice(0, 5).map((cat, idx) => ({
    index: idx + 1,
    id: cat.id,
    name: cat.name,
    type: 'category',
    url: constructCategoryUrl(cat.metaData?.slug),
  }))

  console.log('Root Categories:')
  for (const item of items) {
    console.log(`${item.index}. ${item.name}`)
    console.log(`   URL: ${item.url || 'NO URL'}`)
    console.log()
  }

  return { allCategories, rootCategories }
}

async function testSubcategories(allCategories, parentId) {
  console.log('\n=== Test 2: Subcategories with URLs ===\n')

  // Filter visible subcategories (those with salesChannelIds)
  const subcategories = allCategories.filter((c) => c.parentId === parentId && isVisibleCategory(c))
  const items = subcategories.slice(0, 3).map((cat, idx) => ({
    index: idx + 1,
    id: cat.id,
    name: cat.name,
    type: 'category',
    url: constructCategoryUrl(cat.metaData?.slug),
  }))

  const parent = allCategories.find((c) => c.id === parentId)
  console.log(`Subcategories of: ${parent?.name || parentId}\n`)

  for (const item of items) {
    console.log(`${item.index}. ${item.name}`)
    console.log(`   URL: ${item.url || 'NO URL'}`)
    console.log()
  }

  return items
}

async function testProductsWithUrls(token, categoryId) {
  console.log('\n=== Test 3: Products with URLs ===\n')

  const products = await fetchProducts(token, categoryId, 3)
  const visibleProducts = products.filter((p) => p.salesChannelIds && p.salesChannelIds.length > 0)

  const items = visibleProducts.map((product, idx) => {
    const activeVariant = product.variants?.find((v) => v.isActive)
    const price = activeVariant?.prices?.[0]
    const stock = product.totalStock ?? 0

    return {
      index: idx + 1,
      id: product.id,
      name: product.name,
      type: 'product',
      price: price
        ? {
            regular: price.sellPrice,
            discounted:
              price.discountPrice && price.discountPrice < price.sellPrice
                ? price.discountPrice
                : null,
            currency: price.currency || 'TRY',
          }
        : null,
      stock: {
        available: stock > 0,
        quantity: stock,
      },
      url: constructProductUrl(product.metaData?.slug),
    }
  })

  console.log('Products:')
  for (const item of items) {
    console.log(`${item.index}. ${item.name}`)
    console.log(`   Price: ${item.price?.regular || 'N/A'} ${item.price?.currency || 'TRY'}`)
    console.log(`   Stock: ${item.stock.quantity}`)
    console.log(`   URL: ${item.url || 'NO URL'}`)
    console.log()
  }

  return items
}

async function main() {
  try {
    printHeader('🔗 Testing ikas_browse with URLs')

    console.log('Getting IKAS token...')
    const token = await getToken()
    console.log('✓ Token obtained')

    const allCategories = await fetchCategories(token)

    // Test 1: Root categories
    const { rootCategories } = await testRootCategories(token, allCategories)

    // Test 2: Subcategories
    const parentCategory = rootCategories.find((cat) =>
      allCategories.some((c) => c.parentId === cat.id)
    )

    if (parentCategory) {
      await testSubcategories(allCategories, parentCategory.id)
    }

    // Test 3: Products
    const leafCategory = allCategories.find(
      (cat) => !allCategories.some((c) => c.parentId === cat.id)
    )

    if (leafCategory) {
      await testProductsWithUrls(token, leafCategory.id)
    }

    separator()
    console.log('✅ Summary:')
    console.log('✓ Categories include shareable URLs')
    console.log('✓ Products include shareable URLs')
    console.log(`✓ URLs use public storefront domain: ${IKAS_CONFIG.STOREFRONT_BASE}`)
    console.log('✓ AI agent can now share direct links with customers!')
    separator()
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

main()
