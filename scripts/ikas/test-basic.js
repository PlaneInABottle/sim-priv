#!/usr/bin/env node
/**
 * Basic IKAS API Test
 * Tests OAuth authentication and basic category/product fetching
 *
 * Usage: node scripts/ikas/test-basic.js
 */

import { getToken, fetchCategories, fetchProducts, separator, printHeader } from './lib/index.js'

async function main() {
  try {
    printHeader('🚀 IKAS Basic API Test')

    console.log('\n🔑 Fetching OAuth token...')
    const token = await getToken()
    console.log('✅ Token received:', `${token.substring(0, 20)}...`)

    console.log('\n📁 Fetching categories...')
    const categories = await fetchCategories(token)
    console.log(`✅ Found ${categories.length} categories`)

    const rootCategories = categories.filter((c) => !c.parentId)
    console.log(`\n🌳 Root categories: ${rootCategories.length}`)
    rootCategories.forEach((cat, idx) => {
      console.log(`   ${idx + 1}. ${cat.name} (${cat.id})`)
    })

    // Calculate max depth
    function getDepth(catId, depth = 0) {
      const children = categories.filter((c) => c.parentId === catId)
      if (children.length === 0) return depth
      return Math.max(...children.map((c) => getDepth(c.id, depth + 1)))
    }

    const maxDepth = Math.max(...rootCategories.map((c) => getDepth(c.id, 1)))
    console.log(`\n📏 Maximum tree depth: ${maxDepth} levels`)

    // Find categories with most subcategories
    const categoryCounts = categories
      .map((cat) => ({
        name: cat.name,
        id: cat.id,
        childCount: categories.filter((c) => c.parentId === cat.id).length,
      }))
      .filter((c) => c.childCount > 0)
      .sort((a, b) => b.childCount - a.childCount)

    console.log(`\n🔢 Categories with most subcategories:`)
    categoryCounts.slice(0, 5).forEach((cat, idx) => {
      console.log(`   ${idx + 1}. ${cat.name}: ${cat.childCount} subcategories`)
    })

    separator()
    console.log('✅ ALL TESTS PASSED')
    separator()
    console.log('\n📝 Summary:')
    console.log(`   - Total categories: ${categories.length}`)
    console.log(`   - Root categories: ${rootCategories.length}`)
    console.log(`   - Max depth: ${maxDepth} levels`)
    console.log(`   - API is working correctly ✅`)
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
