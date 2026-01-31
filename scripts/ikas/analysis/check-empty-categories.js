#!/usr/bin/env node
/**
 * Check Empty Categories
 * Identifies categories without products or sales channels
 *
 * Usage: node scripts/ikas/analysis/check-empty-categories.js
 */

import { EMPTY_CATEGORIES, executeGraphQL, getToken, printHeader, separator } from '../lib/index.js'

async function fetchCategoriesWithChannels(token) {
  const query = `{
    listCategory {
      id
      name
      parentId
      salesChannelIds
    }
  }`

  const data = await executeGraphQL(token, query)
  return data.data.listCategory || []
}

async function main() {
  printHeader('🔍 Checking Empty Categories')

  const token = await getToken()
  const categories = await fetchCategoriesWithChannels(token)

  console.log()

  for (const name of EMPTY_CATEGORIES) {
    const cat = categories.find((c) => c.name === name)
    if (cat) {
      console.log(`✅ "${name}"`)
      console.log(`   ID: ${cat.id}`)
      console.log(`   Parent ID: ${cat.parentId || 'ROOT'}`)
      console.log(`   Sales Channels: ${cat.salesChannelIds?.length || 0}`)
      if (cat.salesChannelIds && cat.salesChannelIds.length > 0) {
        console.log(`      ${cat.salesChannelIds.join(', ')}`)
      } else {
        console.log(`      ⚠️  NOT ASSIGNED TO ANY SALES CHANNEL`)
      }
      console.log()
    } else {
      console.log(`❌ "${name}" - NOT FOUND\n`)
    }
  }

  // Summary
  const emptyCatsWithNoChannels = categories.filter(
    (c) =>
      EMPTY_CATEGORIES.includes(c.name) && (!c.salesChannelIds || c.salesChannelIds.length === 0)
  )

  separator()
  console.log('📊 SUMMARY:')
  console.log(
    `   Empty categories found: ${EMPTY_CATEGORIES.filter((n) => categories.find((c) => c.name === n)).length}`
  )
  console.log(`   Empty + No sales channels: ${emptyCatsWithNoChannels.length}`)
  separator()
}

main().catch(console.error)
