#!/usr/bin/env node
/**
 * Test OpenRouter Model Capabilities
 * Checks which models support tools and structured outputs
 *
 * Usage: node scripts/ikas/analysis/test-openrouter-capabilities.js
 */

let modelCapabilitiesCache = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

async function fetchModelCapabilities() {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      console.error('Failed to fetch OpenRouter model capabilities', {
        status: response.status,
      })
      return new Map()
    }

    const data = await response.json()
    const capabilities = new Map()

    for (const model of data.data ?? []) {
      const supportedParams = model.supported_parameters ?? []
      capabilities.set(model.id, {
        supportsStructuredOutputs: supportedParams.includes('structured_outputs'),
        supportsTools: supportedParams.includes('tools'),
      })
    }

    console.log('✅ Cached OpenRouter model capabilities')
    console.log(`   Total models: ${capabilities.size}`)
    console.log(
      `   With structured outputs: ${Array.from(capabilities.values()).filter((c) => c.supportsStructuredOutputs).length}`
    )
    console.log(
      `   With tools: ${Array.from(capabilities.values()).filter((c) => c.supportsTools).length}`
    )

    return capabilities
  } catch (error) {
    console.error('❌ Error fetching OpenRouter model capabilities:', error.message)
    return new Map()
  }
}

async function getOpenRouterModelCapabilities(modelId) {
  const now = Date.now()

  if (!modelCapabilitiesCache || now - cacheTimestamp > CACHE_TTL_MS) {
    modelCapabilitiesCache = await fetchModelCapabilities()
    cacheTimestamp = now
  }

  const normalizedId = modelId.replace(/^openrouter\//, '')
  return modelCapabilitiesCache.get(normalizedId) ?? null
}

// TEST
async function test() {
  console.log('🧪 Testing getOpenRouterModelCapabilities...\n')

  const testModels = [
    'openrouter/google/gemini-3-flash-preview',
    'google/gemini-3-flash-preview',
    'openrouter/openai/gpt-4o',
    'openai/gpt-4o',
  ]

  for (const modelId of testModels) {
    console.log(`\n📋 Model: ${modelId}`)
    const capabilities = await getOpenRouterModelCapabilities(modelId)

    if (capabilities) {
      console.log(`   ✅ Found capabilities:`)
      console.log(`      - supportsTools: ${capabilities.supportsTools}`)
      console.log(`      - supportsStructuredOutputs: ${capabilities.supportsStructuredOutputs}`)
      console.log(
        `      - canCombine: ${capabilities.supportsTools && capabilities.supportsStructuredOutputs}`
      )
    } else {
      console.log(`   ❌ No capabilities found (model not in OpenRouter list)`)
    }
  }

  // Show all Gemini models
  console.log('\n\n📋 All Gemini models in OpenRouter:')
  for (const [modelId, caps] of modelCapabilitiesCache.entries()) {
    if (modelId.includes('gemini')) {
      console.log(`   - ${modelId}`)
      console.log(`     tools: ${caps.supportsTools}, structured: ${caps.supportsStructuredOutputs}`)
    }
  }
}

test().catch(console.error)
