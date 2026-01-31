#!/usr/bin/env node
/**
 * Kamatas Catalog Explorer
 * Comprehensive mapping of the entire catalog structure
 *
 * Usage: node scripts/ikas/analysis/explore-catalog.js
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

function buildCategoryTree(categories) {
  const tree = {}
  // Only include visible root categories
  const rootCategories = categories.filter((c) => !c.parentId && isVisibleCategory(c))

  for (const root of rootCategories) {
    tree[root.name] = {
      id: root.id,
      subcategories: {},
    }

    // Only include visible subcategories
    const subcats = categories.filter((c) => c.parentId === root.id && isVisibleCategory(c))
    for (const sub of subcats) {
      tree[root.name].subcategories[sub.name] = {
        id: sub.id,
        subcategories: {},
      }

      // Check for visible sub-subcategories
      const subSubcats = categories.filter((c) => c.parentId === sub.id && isVisibleCategory(c))
      for (const subsub of subSubcats) {
        tree[root.name].subcategories[sub.name].subcategories[subsub.name] = {
          id: subsub.id,
        }
      }
    }
  }

  return tree
}

async function exploreCategory(token, categoryId, categoryName, allCategories, depth = 0) {
  const indent = '  '.repeat(depth)
  console.log(`${indent}📂 ${categoryName}`)

  // Check if has visible subcategories
  const subcategories = allCategories.filter(
    (c) => c.parentId === categoryId && isVisibleCategory(c)
  )

  if (subcategories.length > 0) {
    console.log(`${indent}  └─ ${subcategories.length} visible subcategories`)
    return { type: 'parent', count: subcategories.length }
  }
  // Leaf category - fetch products
  const products = await fetchProducts(token, categoryId, 50)
  const visibleProducts = getVisibleProducts(products)
  console.log(`${indent}  └─ ${visibleProducts.length} products`)
  return { type: 'leaf', count: visibleProducts.length, products: visibleProducts }
}

async function main() {
  printHeader('🔍 KAMATAS CATALOG EXPLORER')

  const token = await getToken()
  console.log('✅ Authenticated\n')

  const allCategories = await fetchCategories(token)
  console.log(`📊 Total categories: ${allCategories.length}\n`)

  const tree = buildCategoryTree(allCategories)

  separator()
  console.log('CATALOG STRUCTURE')
  separator()
  console.log()

  const catalogData = {}
  let totalProducts = 0

  // Explore each root category
  for (const [rootName, rootData] of Object.entries(tree)) {
    console.log(`\n🏷️  ${rootName}`)
    catalogData[rootName] = { id: rootData.id, subcategories: {} }

    if (Object.keys(rootData.subcategories).length > 0) {
      for (const [subName, subData] of Object.entries(rootData.subcategories)) {
        const result = await exploreCategory(token, subData.id, subName, allCategories, 1)
        catalogData[rootName].subcategories[subName] = result

        if (result.type === 'leaf') {
          totalProducts += result.count
        }

        // If sub has more subcategories
        if (Object.keys(subData.subcategories).length > 0) {
          for (const [subSubName, subSubData] of Object.entries(subData.subcategories)) {
            const subSubResult = await exploreCategory(
              token,
              subSubData.id,
              subSubName,
              allCategories,
              2
            )
            catalogData[rootName].subcategories[subName].subcategories =
              catalogData[rootName].subcategories[subName].subcategories || {}
            catalogData[rootName].subcategories[subName].subcategories[subSubName] = subSubResult

            if (subSubResult.type === 'leaf') {
              totalProducts += subSubResult.count
            }
          }
        }
      }
    } else {
      // Root is a leaf
      const result = await exploreCategory(token, rootData.id, rootName, allCategories, 0)
      catalogData[rootName] = result
      if (result.type === 'leaf') {
        totalProducts += result.count
      }
    }
  }

  separator()
  console.log('SUMMARY')
  separator()
  console.log(`Total Root Categories: ${Object.keys(tree).length}`)
  console.log(`Total Products (visible): ${totalProducts}`)

  // Explore Sineklikler in detail
  separator()
  console.log('DETAILED EXPLORATION: SINEKLIKLER')
  separator()

  const sinekliklerCat = allCategories.find((c) => c.name === 'Sineklikler')
  if (sinekliklerCat) {
    const sineklikSubcats = allCategories.filter((c) => c.parentId === sinekliklerCat.id)
    console.log(`\nSineklikler has ${sineklikSubcats.length} subcategories:\n`)

    for (const subcat of sineklikSubcats) {
      console.log(`\n📦 ${subcat.name}`)
      const products = await fetchProducts(token, subcat.id, 50)
      const visibleProducts = getVisibleProducts(products)

      if (visibleProducts.length > 0) {
        console.log(`   ${visibleProducts.length} products:`)
        visibleProducts.slice(0, 5).forEach((p, i) => {
          const variant = p.variants?.find((v) => v.isActive)
          const price = variant?.prices?.[0]
          const priceStr = price
            ? price.discountPrice && price.discountPrice < price.sellPrice
              ? `${price.discountPrice} TRY (was ${price.sellPrice})`
              : `${price.sellPrice} TRY`
            : 'No price'
          console.log(`   ${i + 1}. ${p.name} - ${priceStr}`)
        })
        if (visibleProducts.length > 5) {
          console.log(`   ... and ${visibleProducts.length - 5} more`)
        }
      } else {
        console.log('   No visible products')
      }
    }
  }

  console.log('\n✅ Exploration complete\n')
}

main().catch(console.error)
