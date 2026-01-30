#!/usr/bin/env node
/**
 * Check Specific Category Products
 * Investigates Akordiyon Sineklikler category in detail
 *
 * Usage: node scripts/ikas/features/test-category-check.js [category-id]
 */

import {
  getToken,
  fetchCategories,
  fetchProducts,
  getProductPrice,
  formatPriceWithDiscount,
  isVisibleCategory,
  TEST_CATEGORIES,
  separator,
  printHeader,
} from '../lib/index.js'

async function checkCategory(categoryId) {
  printHeader(`🔍 Checking Category: ${categoryId}`)

  const token = await getToken()
  const categories = await fetchCategories(token)

  const category = categories.find((c) => c.id === categoryId)
  if (!category) {
    console.log(`❌ Category not found: ${categoryId}`)
    return
  }

  console.log(`\n📂 Category: ${category.name}`)
  console.log(`   ID: ${category.id}`)
  console.log(`   Visible: ${isVisibleCategory(category) ? '✅ Yes' : '❌ No (no salesChannelIds)'}`)

  // Check for visible subcategories
  const subcategories = categories.filter((c) => c.parentId === categoryId && isVisibleCategory(c))

  if (subcategories.length > 0) {
    console.log(`\n📁 Subcategories (${subcategories.length}):`)
    for (const subcat of subcategories) {
      console.log(`   - ${subcat.name} (ID: ${subcat.id})`)
    }

    // Fetch products from each subcategory
    for (const subcat of subcategories) {
      console.log(`\n🛒 Products in "${subcat.name}":`)
      const products = await fetchProducts(token, subcat.id, 100)

      if (products.length === 0) {
        console.log('   (No products)')
      } else {
        products.slice(0, 5).forEach((p, idx) => {
          const price = getProductPrice(p)
          const stock = p.totalStock > 0 ? '✅ In stock' : '❌ Out of stock'
          console.log(`   ${idx + 1}. ${p.name}`)
          console.log(`      Price: ${formatPriceWithDiscount(price)}`)
          console.log(`      Stock: ${stock}`)
        })
        if (products.length > 5) {
          console.log(`   ... and ${products.length - 5} more`)
        }
      }
    }
  } else {
    // Leaf category - fetch products directly
    console.log('\n📦 This is a leaf category (no subcategories)')
    console.log('\n🛒 Products:')
    const products = await fetchProducts(token, categoryId, 100)

    if (products.length === 0) {
      console.log('   ❌ No products found!')
    } else {
      console.log(`\n✅ Found ${products.length} products:\n`)
      products.slice(0, 10).forEach((p, idx) => {
        const price = getProductPrice(p)
        const stock = p.totalStock > 0 ? '✅ In stock' : '❌ Out of stock'
        console.log(`${idx + 1}. ${p.name}`)
        console.log(`   💰 ${formatPriceWithDiscount(price)}`)
        console.log(`   📦 ${stock}`)
        console.log(`   🔗 ID: ${p.id}\n`)
      })
      if (products.length > 10) {
        console.log(`   ... and ${products.length - 10} more`)
      }
    }
  }

  // Search for keywords
  console.log('\n🔍 Searching for "Pileli/Plise/Dikey" keywords...')
  const allProducts = await fetchProducts(token, categoryId, 100)
  const matchingProducts = allProducts.filter(
    (p) =>
      p.name.toLowerCase().includes('pileli') ||
      p.name.toLowerCase().includes('plise') ||
      p.name.toLowerCase().includes('dikey')
  )

  if (matchingProducts.length > 0) {
    console.log(`\n✅ Found ${matchingProducts.length} matching products:`)
    matchingProducts.forEach((p) => {
      const price = getProductPrice(p)
      console.log(`\n   📦 ${p.name}`)
      console.log(`      💰 ${formatPriceWithDiscount(price)}`)
      console.log(`      📦 Stock: ${p.totalStock > 0 ? 'In stock' : 'Out of stock'}`)
      console.log(`      🔗 ID: ${p.id}`)
    })
  } else {
    console.log('\n❌ No products with "Pileli", "Plise", or "Dikey" keywords found')
  }
}

async function main() {
  try {
    const categoryId = process.argv[2] || TEST_CATEGORIES.AKORDIYON_SINEKLIKLER
    await checkCategory(categoryId)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

main()
