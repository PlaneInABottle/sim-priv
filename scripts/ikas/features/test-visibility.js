#!/usr/bin/env node
/**
 * Check Product Visibility
 * Analyzes salesChannelIds to understand product visibility
 *
 * Usage: node scripts/ikas/features/test-visibility.js [category-id]
 */

import {
  getToken,
  executeGraphQL,
  getProductPrice,
  TEST_CATEGORIES,
  separator,
  printHeader,
} from '../lib/index.js'

async function fetchProductsDetailed(token, categoryId) {
  const query = `query($categoryIds: CategoryFilterInput, $pagination: PaginationInput) {
    listProduct(categoryIds: $categoryIds, pagination: $pagination) {
      data {
        id
        name
        categoryIds
        totalStock
        salesChannelIds
        hiddenSalesChannelIds
        type
        variants {
          id
          isActive
          sku
          prices {
            sellPrice
            discountPrice
            currency
          }
        }
      }
    }
  }`

  const data = await executeGraphQL(token, query, {
    categoryIds: { in: [categoryId] },
    pagination: { limit: 100, page: 1 },
  })

  return data.data?.listProduct?.data || []
}

async function checkVisibility(categoryId) {
  printHeader('🔍 Checking Product Visibility')

  console.log(`Category ID: ${categoryId}\n`)

  const token = await getToken()
  const products = await fetchProductsDetailed(token, categoryId)

  // Filter for products matching keyword (dikey in this case)
  const filteredProducts = products.filter((p) => p.name.toLowerCase().includes('dikey'))

  console.log(`✅ Found ${filteredProducts.length} "Dikey" products\n`)

  filteredProducts.forEach((p, idx) => {
    separator('━')
    console.log(`${idx + 1}. ${p.name}`)
    console.log(`   ID: ${p.id}`)
    console.log(`   Type: ${p.type}`)

    const price = getProductPrice(p)
    if (price) {
      const priceStr =
        price.discounted && price.discounted < price.regular
          ? `${price.discounted} ${price.currency} (was ${price.regular})`
          : `${price.regular} ${price.currency}`
      console.log(`   💰 Price: ${priceStr}`)
    }

    console.log(`   📦 Total Stock: ${p.totalStock}`)
    console.log(`   🏪 Sales Channels: ${p.salesChannelIds?.length || 0} channel(s)`)
    if (p.salesChannelIds && p.salesChannelIds.length > 0) {
      console.log(`      ${p.salesChannelIds.join(', ')}`)
    }
    console.log(`   🚫 Hidden Sales Channels: ${p.hiddenSalesChannelIds?.length || 0} channel(s)`)
    if (p.hiddenSalesChannelIds && p.hiddenSalesChannelIds.length > 0) {
      console.log(`      ${p.hiddenSalesChannelIds.join(', ')}`)
    }

    console.log(`   🎯 Variants: ${p.variants?.length || 0}`)
    p.variants?.slice(0, 2).forEach((v, vidx) => {
      console.log(`      ${vidx + 1}. Variant ${v.id.substring(0, 8)}...`)
      console.log(`         Active: ${v.isActive ? '✅' : '❌'}`)
      console.log(`         SKU: ${v.sku || 'N/A'}`)
      if (v.prices && v.prices.length > 0) {
        const vPrice = v.prices[0]
        console.log(`         Price: ${vPrice.discountPrice || vPrice.sellPrice} ${vPrice.currency}`)
      }
    })
    console.log('')
  })

  separator()
  console.log('📊 SUMMARY:')
  console.log(`   Total matching products: ${filteredProducts.length}`)

  const withHiddenChannels = filteredProducts.filter(
    (p) => p.hiddenSalesChannelIds && p.hiddenSalesChannelIds.length > 0
  )
  console.log(`   Products with hidden channels: ${withHiddenChannels.length}`)

  const inactiveVariants = filteredProducts.filter(
    (p) => p.variants && p.variants.some((v) => !v.isActive)
  )
  console.log(`   Products with inactive variants: ${inactiveVariants.length}`)

  const suspiciouslyLowPriced = filteredProducts.filter((p) => {
    const price = getProductPrice(p)
    return price && (price.regular < 20 || (price.discounted && price.discounted < 20))
  })
  console.log(
    `   ⚠️  Products with suspiciously low prices (<20 TRY): ${suspiciouslyLowPriced.length}`
  )

  if (suspiciouslyLowPriced.length > 0) {
    console.log('\n⚠️  POSSIBLE PRICING ERROR DETECTED:')
    suspiciouslyLowPriced.forEach((p) => {
      const price = getProductPrice(p)
      console.log(`   - ${p.name}: ${price.regular} TRY`)
    })
  }
  separator()
}

async function main() {
  try {
    const categoryId = process.argv[2] || TEST_CATEGORIES.PILELI_PENCERE
    await checkVisibility(categoryId)
  } catch (error) {
    console.error('❌ Error:', error)
    if (error.stack) console.error(error.stack)
    process.exit(1)
  }
}

main()
