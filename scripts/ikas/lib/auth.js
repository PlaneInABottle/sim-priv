/**
 * IKAS Authentication Utilities
 * Handles OAuth token retrieval and caching
 */

import { IKAS_CONFIG, UPSTASH_CONFIG } from './config.js'

/**
 * Simple OAuth token retrieval (no caching)
 */
export async function getToken() {
  const params = new URLSearchParams()
  params.append('grant_type', 'client_credentials')
  params.append('client_id', IKAS_CONFIG.CLIENT_ID)
  params.append('client_secret', IKAS_CONFIG.CLIENT_SECRET)

  const response = await fetch(IKAS_CONFIG.OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    throw new Error(`OAuth failed: ${response.status}`)
  }

  const data = await response.json()
  return data.access_token
}

/**
 * Promise.race based timeout for fetch requests
 */
export async function fetchWithTimeout(url, options, timeout = IKAS_CONFIG.REQUEST_TIMEOUT) {
  const timeoutPromise = new Promise((_, reject) => {
    const timeoutError = new Error(`Request timed out after ${timeout}ms`)
    timeoutError.name = 'TimeoutError'
    setTimeout(() => reject(timeoutError), timeout)
  })

  try {
    return await Promise.race([fetch(url, options), timeoutPromise])
  } catch (error) {
    if (error.name === 'TimeoutError') {
      throw new Error(`API request timed out (${timeout / 1000} seconds)`)
    }
    throw error
  }
}

/**
 * Acquire Redis lock for token refresh
 */
async function acquireLock(lockKey, ttl = UPSTASH_CONFIG.LOCK_TTL) {
  const lockValue = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const response = await fetchWithTimeout(
    `${UPSTASH_CONFIG.URL}/set/${encodeURIComponent(lockKey)}/${encodeURIComponent(lockValue)}/EX/${ttl}/NX`,
    { headers: { Authorization: `Bearer ${UPSTASH_CONFIG.TOKEN}` } }
  )
  if (response.ok) {
    const data = await response.json()
    if (data.result === 'OK') return lockValue
  }
  return null
}

/**
 * Release Redis lock
 */
async function releaseLock(lockKey, lockValue) {
  const script = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`
  await fetchWithTimeout(`${UPSTASH_CONFIG.URL}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_CONFIG.TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(['EVAL', script, 1, lockKey, lockValue]),
  })
}

/**
 * Get token with Redis caching and locking
 */
export async function getCachedToken() {
  // Check cache first
  const cacheResponse = await fetchWithTimeout(
    `${UPSTASH_CONFIG.URL}/get/${encodeURIComponent(UPSTASH_CONFIG.TOKEN_CACHE_KEY)}`,
    { headers: { Authorization: `Bearer ${UPSTASH_CONFIG.TOKEN}` } }
  )
  if (cacheResponse.ok) {
    const data = await cacheResponse.json()
    if (data.result) return data.result
  }

  // Acquire lock for token refresh
  const lockValue = await acquireLock(UPSTASH_CONFIG.TOKEN_LOCK_KEY, UPSTASH_CONFIG.LOCK_TTL)
  if (!lockValue) {
    // Wait and retry cache
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 500))
      const retryResponse = await fetchWithTimeout(
        `${UPSTASH_CONFIG.URL}/get/${encodeURIComponent(UPSTASH_CONFIG.TOKEN_CACHE_KEY)}`,
        { headers: { Authorization: `Bearer ${UPSTASH_CONFIG.TOKEN}` } }
      )
      if (retryResponse.ok) {
        const retryData = await retryResponse.json()
        if (retryData.result) return retryData.result
      }
    }
    throw new Error('Could not acquire lock and no cached token')
  }

  try {
    // Double-check cache after acquiring lock
    const doubleCheck = await fetchWithTimeout(
      `${UPSTASH_CONFIG.URL}/get/${encodeURIComponent(UPSTASH_CONFIG.TOKEN_CACHE_KEY)}`,
      { headers: { Authorization: `Bearer ${UPSTASH_CONFIG.TOKEN}` } }
    )
    if (doubleCheck.ok) {
      const data = await doubleCheck.json()
      if (data.result) return data.result
    }

    // Fetch new token
    const accessToken = await getToken()

    // Cache the token
    await fetchWithTimeout(`${UPSTASH_CONFIG.URL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_CONFIG.TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        'SETEX',
        UPSTASH_CONFIG.TOKEN_CACHE_KEY,
        UPSTASH_CONFIG.DEFAULT_TOKEN_TTL,
        accessToken,
      ]),
    })

    return accessToken
  } finally {
    await releaseLock(UPSTASH_CONFIG.TOKEN_LOCK_KEY, lockValue)
  }
}
