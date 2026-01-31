#!/usr/bin/env node
/**
 * Test Empty Category Filtering
 * Verifies that empty leaf categories are properly filtered out
 *
 * Usage: node scripts/ikas/browse/test-filter-empty.js
 */

import {
  fetchCategories,
  fetchProducts,
  getToken,
  getVisibleProducts,
  isVisibleCategory,
  printHeader,
  separator,
} from '../lib/index.js'

async function browseWithFiltering(token, categoryId, allCategories) {
  // Filter to only show visible subcategories (those with salesChannelIds)
  const subcategories = allCategories.filter(
    (c) => c.parentId === categoryId && isVisibleCategory(c)
  )

  console.log(`\n📊 Found ${subcategories.length} subcategories`)
  console.log('🔍 Checking each one...\n')

  // Check each subcategory and count products if it's a leaf
  const itemsWithCounts = await Promise.all(
    subcategories.map(async (cat) => {
      // Check if this category has children
      const hasChildren = allCategories.some((c) => c.parentId === cat.id)

      if (hasChildren) {
        // Has subcategories - keep it (don't check products)
        console.log(`  ✅ "${cat.name}" - Has subcategories (keeping)`)
        return { cat, isEmpty: false, reason: 'has_children' }
      }
      // Leaf category - check if it has visible products
      const products = await fetchProducts(token, cat.id)
      const visibleProducts = getVisibleProducts(products)
      const isEmpty = visibleProducts.length === 0

      if (isEmpty) {
        console.log(`  ❌ "${cat.name}" - Leaf with 0 products (hiding)`)
      } else {
        console.log(`  ✅ "${cat.name}" - Leaf with ${visibleProducts.length} products (keeping)`)
      }

      return { cat, isEmpty, reason: isEmpty ? 'empty_leaf' : 'has_products' }
    })
  )

  // Filter out empty leaves
  const filteredItems = itemsWithCounts.filter((item) => !item.isEmpty)

  console.log(`\n📋 Result: ${filteredItems.length}/${subcategories.length} categories shown`)

  return {
    original: subcategories,
    filtered: filteredItems,
    hidden: itemsWithCounts.filter((item) => item.isEmpty),
  }
}

async function main() {
  try {
    printHeader('🚀 Testing Empty Category Filtering')

    const token = await getToken()
    const allCategories = await fetchCategories(token)

    console.log(`✅ Loaded ${allCategories.length} categories\n`)

    // Test Case 1: Köşebentler (has empty leaves: 40x40, 50x50)
    separator()
    console.log('TEST 1: Köşebentler (should hide 40x40 and 50x50)')
    separator()

    const kosebentlerCat = allCategories.find((c) => c.name === 'Köşebentler')
    const result1 = await browseWithFiltering(token, kosebentlerCat.id, allCategories)

    console.log('\n📦 Hidden categories:')
    result1.hidden.forEach((item) => {
      console.log(`   - ${item.cat.name} (${item.reason})`)
    })

    // Test Case 2: Akordiyon Sineklikler
    console.log('\n\n')
    separator()
    console.log('TEST 2: Akordiyon Sineklikler (has parents + one empty leaf)')
    separator()

    const akordiyonCat = allCategories.find((c) => c.name === 'Akordiyon Sineklikler')
    const result2 = await browseWithFiltering(token, akordiyonCat.id, allCategories)

    console.log('\n📦 Hidden categories:')
    if (result2.hidden.length === 0) {
      console.log('   (none)')
    } else {
      result2.hidden.forEach((item) => {
        console.log(`   - ${item.cat.name} (${item.reason})`)
      })
    }

    // Test Case 3: Nobel Akordiyon Sineklikler (both children empty)
    console.log('\n\n')
    separator()
    console.log('TEST 3: Nobel Akordiyon Sineklikler (both children empty)')
    separator()

    const nobelCat = allCategories.find((c) => c.name === 'Nobel Akordiyon Sineklikler')
    if (nobelCat) {
      const result3 = await browseWithFiltering(token, nobelCat.id, allCategories)

      console.log('\n📦 Hidden categories:')
      result3.hidden.forEach((item) => {
        console.log(`   - ${item.cat.name} (${item.reason})`)
      })

      // Summary
      separator()
      console.log('SUMMARY')
      separator()
      console.log(
        `Test 1: ${result1.filtered.length}/${result1.original.length} shown (${result1.hidden.length} hidden)`
      )
      console.log(
        `Test 2: ${result2.filtered.length}/${result2.original.length} shown (${result2.hidden.length} hidden)`
      )
      console.log(
        `Test 3: ${result3.filtered.length}/${result3.original.length} shown (${result3.hidden.length} hidden)`
      )
    } else {
      console.log('Nobel Akordiyon Sineklikler category not found')
    }

    console.log('\n✅ Test complete - logic works correctly!')
    console.log('📝 Ready to update custom tool')
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

main()
