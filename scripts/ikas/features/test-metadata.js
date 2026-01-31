#!/usr/bin/env node
/**
 * Test Product Metadata Retrieval
 * Verifies metadata fields are properly extracted
 *
 * Usage: node scripts/ikas/features/test-metadata.js
 */

import {
  constructCategoryUrl,
  constructProductUrl,
  executeGraphQL,
  getToken,
} from '../lib/index.js'

async function testMetadata() {
  const token = await getToken()
  console.log('✓ Token obtained\n')

  // Test product metadata
  const productQuery = `{
    listProduct(pagination: { limit: 2, page: 1 }) {
      data {
        id
        name
        metaData {
          slug
        }
      }
    }
  }`

  console.log('=== Testing Product Metadata (slug only) ===')
  const productData = await executeGraphQL(token, productQuery)

  if (productData.data?.listProduct?.data) {
    console.log(JSON.stringify(productData.data.listProduct.data, null, 2))

    // Construct URL from slug
    if (productData.data.listProduct.data[0]?.metaData?.slug) {
      const slug = productData.data.listProduct.data[0].metaData.slug
      const productUrl = constructProductUrl(slug)
      console.log('\n✅ Product URL:', productUrl)
    }
  } else {
    console.log('Error:', JSON.stringify(productData.errors, null, 2))
  }

  // Test category metadata
  const categoryQuery = `{
    listCategory {
      id
      name
      metaData {
        slug
      }
    }
  }`

  console.log('\n=== Testing Category Metadata (slug only) ===')
  const catData = await executeGraphQL(token, categoryQuery)

  if (catData.data?.listCategory?.[0]) {
    console.log('Sample category:', JSON.stringify(catData.data.listCategory[0], null, 2))

    if (catData.data.listCategory[0].metaData?.slug) {
      const slug = catData.data.listCategory[0].metaData.slug
      const categoryUrl = constructCategoryUrl(slug)
      console.log('\n✅ Category URL:', categoryUrl)
    }
  } else {
    console.log('Error:', JSON.stringify(catData.errors, null, 2))
  }
}

testMetadata().catch(console.error)
