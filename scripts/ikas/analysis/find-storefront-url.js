#!/usr/bin/env node
/**
 * Test Storefront URL Discovery
 * Determines the correct public URL for the store
 *
 * Usage: node scripts/ikas/analysis/find-storefront-url.js
 */

import { getToken, executeGraphQL } from '../lib/index.js'

async function findStorefront() {
  const token = await getToken()

  // Get a product with slug
  const productQuery = `{
    listProduct(pagination: { limit: 1, page: 1 }) {
      data {
        id
        name
        metaData {
          slug
        }
      }
    }
  }`

  const data = await executeGraphQL(token, productQuery)
  const slug = data.data?.listProduct?.data[0]?.metaData?.slug

  if (!slug) {
    console.log('No slug found')
    return
  }

  console.log('Testing different URL patterns for slug:', slug)
  console.log('')

  const urlsToTest = [
    `https://kamatas.myikas.com/urun/${slug}`,
    `https://kamatas.com/urun/${slug}`,
    `https://www.kamatas.com/urun/${slug}`,
    `https://kamatas.com.tr/urun/${slug}`,
    `https://www.kamatas.com.tr/urun/${slug}`,
  ]

  for (const url of urlsToTest) {
    try {
      const testResponse = await fetch(url, { method: 'HEAD', redirect: 'manual' })
      console.log(`${url}`)
      console.log(`  Status: ${testResponse.status}`)
      if (testResponse.status === 301 || testResponse.status === 302) {
        console.log(`  Redirects to: ${testResponse.headers.get('location')}`)
      }
      console.log('')
    } catch (e) {
      console.log(`${url} - Error: ${e.message}`)
      console.log('')
    }
  }
}

findStorefront().catch(console.error)
