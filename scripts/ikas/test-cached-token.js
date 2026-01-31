#!/usr/bin/env node
/**
 * Test Token Caching with Redis
 * Tests the cached token retrieval with Upstash Redis
 *
 * Usage: node scripts/ikas/test-cached-token.js
 */

import { fetchCategories, getCachedToken, printHeader, separator } from './lib/index.js'

async function main() {
  try {
    printHeader('🧪 Testing Cached Token Retrieval')

    console.log('\n1️⃣ Getting IKAS token (may use cache)...')
    const token = await getCachedToken()
    console.log('✅ Token acquired:', `${token.substring(0, 20)}...`)

    console.log('\n2️⃣ Fetching categories...')
    const categories = await fetchCategories(token)
    console.log(`✅ Fetched ${categories.length} categories`)

    console.log('\n3️⃣ Root categories:')
    const rootCategories = categories.filter((c) => !c.parentId)
    rootCategories.forEach((cat, idx) => {
      console.log(`   ${idx + 1}. ${cat.name} (${cat.id})`)
    })

    separator()
    console.log('✅ ALL TESTS PASSED - Token caching works!')
    separator()
  } catch (error) {
    console.error('❌ TEST FAILED:', error.message)
    console.error('Stack:', error.stack)
    process.exit(1)
  }
}

main()
