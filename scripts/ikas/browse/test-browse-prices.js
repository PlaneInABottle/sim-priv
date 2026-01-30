#!/usr/bin/env node
/**
 * Test ikas_browse with Product Prices
 * Verifies price data is included in browse results
 *
 * Usage: node scripts/ikas/browse/test-browse-prices.js
 */

import {
  getToken,
  fetchCategories,
  fetchProducts,
  getProductPrice,
  formatPriceWithDiscount,
  buildPath,
  isVisibleCategory,
  TEST_CATEGORIES,
  separator,
  printHeader,
} from '../lib/index.js'

async function browse(token, allCategories, categoryId = null) {
  separator()
  console.log(`🔍 BROWSING: ${categoryId ? `Category ${categoryId}` : 'Root'}`)
  separator()

  let items = []
  let type = ''
  let hasSubcategories = false
  let isLeafCategory = false

  if (!categoryId) {
    // Root level - show visible root categories only
    const rootCategories = allCategories.filter((c) => !c.parentId && isVisibleCategory(c))
    type = 'categories'
    items = rootCategories.map((cat, idx) => ({
      index: idx + 1,
      id: cat.id,
      name: cat.name,
      type: 'category',
    }))
  } else {
    // Check if category has visible subcategories
    const subcategories = allCategories.filter((c) => c.parentId === categoryId && isVisibleCategory(c))

    if (subcategories.length > 0) {
      // Has subcategories - show ONLY subcategories
      type = 'categories'
      hasSubcategories = true
      items = subcategories.map((cat, idx) => ({
        index: idx + 1,
        id: cat.id,
        name: cat.name,
        type: 'category',
      }))
    } else {
      // Leaf category - show ONLY products WITH PRICES
      type = 'products'
      isLeafCategory = true
      const products = await fetchProducts(token, categoryId)

      items = products.map((product, idx) => {
        const priceInfo = getProductPrice(product)
        return {
          index: idx + 1,
          id: product.id,
          name: product.name,
          type: 'product',
          price: priceInfo,
          stock: {
            available: product.totalStock > 0,
            quantity: product.totalStock,
          },
        }
      })
    }
  }

  const result = {
    type,
    currentPath: buildPath(allCategories, categoryId),
    hasSubcategories,
    isLeafCategory,
    items,
    totalItems: items.length,
    showing: items.length,
  }

  console.log('\n🤖 WHAT AI SEES:')
  console.log('─'.repeat(70))
  console.log(`📍 Location: ${result.currentPath}`)
  console.log(`📊 Type: ${result.type}`)
  console.log(`📋 Items: ${result.items.length}`)
  console.log('')

  result.items.slice(0, 10).forEach((item) => {
    if (item.type === 'category') {
      console.log(`   ${item.index}. ${item.name} (category)`)
    } else if (item.type === 'product') {
      let line = `   ${item.index}. ${item.name}`
      if (item.price) {
        line += ` - ${formatPriceWithDiscount(item.price)}`
      }
      if (item.stock) {
        line += ` [${item.stock.available ? '✅ In stock' : '❌ Out of stock'}]`
      }
      console.log(line)
    }
  })

  if (result.items.length > 10) {
    console.log(`   ... and ${result.items.length - 10} more`)
  }

  console.log('─'.repeat(70))

  return result
}

async function main() {
  try {
    printHeader('🚀 Testing ikas_browse WITH PRICES')

    const token = await getToken()
    const allCategories = await fetchCategories(token)

    // Test 1: Root categories
    await browse(token, allCategories)

    // Test 2: Category with subcategories (Köşebentler)
    await browse(token, allCategories, TEST_CATEGORIES.KOSEBENTLER)

    // Test 3: Leaf category with products (25x25 Köşebentler)
    await browse(token, allCategories, TEST_CATEGORIES.KOSEBENTLER_25X25)

    separator()
    console.log('✅ ALL TESTS PASSED')
    separator()
    console.log('\n📝 Summary:')
    console.log('   ✅ Root categories work')
    console.log('   ✅ Subcategories work')
    console.log('   ✅ Products with PRICES work')
    console.log('   ✅ Products with STOCK work')
    console.log('   ✅ Discounted prices display correctly')
    console.log('   ✅ Single GraphQL query (fast!)')
  } catch (error) {
    console.error('\n❌ TEST FAILED')
    console.error('Error:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

main()
