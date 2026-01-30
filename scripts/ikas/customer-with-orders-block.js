#!/usr/bin/env node
/**
 * IKAS Customer Fetch + Last 2 Orders Block
 *
 * Production-ready code block for fetching customer by phone number
 * and retrieving their last 2 orders in a single workflow execution.
 *
 * Features:
 * - OAuth token caching with Upstash Redis
 * - Automatic 401 retry with token refresh
 * - Searches customers by phone number using listCustomer API
 * - Fetches last 2 orders sorted by orderedAt (descending)
 * - Comprehensive error handling
 * - Unified response structure
 *
 * Usage in Sim workflow:
 *   Input: Phone number from <start.senderPhoneNumber> or similar variable
 *   Output: Customer data + their last 2 orders
 */

// ============================================================================
// CONFIGURATION (Replace with your actual credentials in production)
// ============================================================================

const CONFIG = {
  // IKAS OAuth
  OAUTH_URL: 'https://kamatas.myikas.com/api/admin/oauth/token',
  GRAPHQL_URL: 'https://api.myikas.com/api/v1/admin/graphql',
  CLIENT_ID: '31adc972-1033-41bb-b23b-96b45238d6a2',
  CLIENT_SECRET: 's_5SFl7zDxObKLdJXjiKyccVev5fb666ee32be43558a8d7d9ad9484110',

  // Upstash Redis for token caching
  UPSTASH_URL: 'https://legible-marmoset-35404.upstash.io',
  UPSTASH_TOKEN: 'AYpMAAIncDFkNGU4NmRjNDYyNjA0OWE3YTJhZDhhMzNiMjdhZDI2ZXAxMzU0MDQ',
  TOKEN_CACHE_KEY: 'ikas:token:31adc972-1033-41bb-b23b-96b45238d6a2',
  TOKEN_LOCK_KEY: 'ikas:token:lock:31adc972-1033-41bb-b23b-96b45238d6a2',
  DEFAULT_TOKEN_TTL: 12600, // ~3.5 hours
  LOCK_TTL: 10,

  // Request settings
  REQUEST_TIMEOUT: 15000,
  MAX_RETRIES: 1,
  ORDERS_LIMIT: 2,
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Fetch with timeout using Promise.race
 */
async function fetchWithTimeout(url, options, timeout = CONFIG.REQUEST_TIMEOUT) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout}ms`)
    }
    throw error
  }
}

/**
 * Acquire Redis lock for token refresh (prevents race conditions)
 */
async function acquireLock(lockKey, ttl = CONFIG.LOCK_TTL) {
  const lockValue = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  try {
    const response = await fetchWithTimeout(
      `${CONFIG.UPSTASH_URL}/set/${encodeURIComponent(lockKey)}/${encodeURIComponent(lockValue)}/EX/${ttl}/NX`,
      { headers: { Authorization: `Bearer ${CONFIG.UPSTASH_TOKEN}` } }
    )
    if (response.ok) {
      const data = await response.json()
      if (data.result === 'OK') return lockValue
    }
  } catch (error) {
    console.warn('Lock acquisition failed:', error.message)
  }
  return null
}

/**
 * Release Redis lock
 */
async function releaseLock(lockKey, lockValue) {
  const script = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`
  try {
    await fetchWithTimeout(`${CONFIG.UPSTASH_URL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CONFIG.UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['EVAL', script, 1, lockKey, lockValue]),
    })
  } catch (error) {
    console.warn('Lock release failed:', error.message)
  }
}

/**
 * Get fresh OAuth token from IKAS
 */
async function getFreshToken() {
  const params = new URLSearchParams()
  params.append('grant_type', 'client_credentials')
  params.append('client_id', CONFIG.CLIENT_ID)
  params.append('client_secret', CONFIG.CLIENT_SECRET)

  const response = await fetchWithTimeout(CONFIG.OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OAuth failed (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  return data.access_token
}

/**
 * Get token with Redis caching and distributed locking
 */
async function getCachedToken(forceRefresh = false) {
  // Skip cache check if force refresh
  if (!forceRefresh) {
    try {
      const cacheResponse = await fetchWithTimeout(
        `${CONFIG.UPSTASH_URL}/get/${encodeURIComponent(CONFIG.TOKEN_CACHE_KEY)}`,
        { headers: { Authorization: `Bearer ${CONFIG.UPSTASH_TOKEN}` } }
      )
      if (cacheResponse.ok) {
        const data = await cacheResponse.json()
        if (data.result) {
          return data.result
        }
      }
    } catch (error) {
      console.warn('Cache check failed:', error.message)
    }
  }

  // Acquire lock for token refresh
  const lockValue = await acquireLock(CONFIG.TOKEN_LOCK_KEY, CONFIG.LOCK_TTL)
  if (!lockValue) {
    // Wait and retry cache (another process might be refreshing)
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 500))
      try {
        const retryResponse = await fetchWithTimeout(
          `${CONFIG.UPSTASH_URL}/get/${encodeURIComponent(CONFIG.TOKEN_CACHE_KEY)}`,
          { headers: { Authorization: `Bearer ${CONFIG.UPSTASH_TOKEN}` } }
        )
        if (retryResponse.ok) {
          const retryData = await retryResponse.json()
          if (retryData.result) return retryData.result
        }
      } catch (error) {
        // Continue retrying
      }
    }
    throw new Error('Could not acquire lock and no cached token available')
  }

  try {
    // Double-check cache after acquiring lock
    if (!forceRefresh) {
      try {
        const doubleCheck = await fetchWithTimeout(
          `${CONFIG.UPSTASH_URL}/get/${encodeURIComponent(CONFIG.TOKEN_CACHE_KEY)}`,
          { headers: { Authorization: `Bearer ${CONFIG.UPSTASH_TOKEN}` } }
        )
        if (doubleCheck.ok) {
          const data = await doubleCheck.json()
          if (data.result) return data.result
        }
      } catch (error) {
        // Continue to fetch fresh token
      }
    }

    // Fetch fresh token
    const accessToken = await getFreshToken()

    // Cache the token
    try {
      await fetchWithTimeout(`${CONFIG.UPSTASH_URL}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CONFIG.UPSTASH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          'SETEX',
          CONFIG.TOKEN_CACHE_KEY,
          CONFIG.DEFAULT_TOKEN_TTL,
          accessToken,
        ]),
      })
    } catch (error) {
      console.warn('Token caching failed:', error.message)
    }

    return accessToken
  } finally {
    await releaseLock(CONFIG.TOKEN_LOCK_KEY, lockValue)
  }
}

/**
 * Execute GraphQL query with automatic 401 retry
 */
async function executeGraphQL(token, query, variables = {}, retryCount = 0) {
  const response = await fetchWithTimeout(CONFIG.GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  })

  // Handle 401 - token might be expired
  if (response.status === 401 && retryCount < CONFIG.MAX_RETRIES) {
    console.log('Token expired, refreshing...')
    const newToken = await getCachedToken(true) // Force refresh
    return executeGraphQL(newToken, query, variables, retryCount + 1)
  }

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`GraphQL request failed (${response.status}): ${errorText}`)
  }

  const data = await response.json()

  if (data.errors && data.errors.length > 0) {
    const errorMessages = data.errors.map((e) => e.message).join('; ')
    throw new Error(`GraphQL errors: ${errorMessages}`)
  }

  return data
}

// ============================================================================
// GRAPHQL QUERIES
// ============================================================================

/**
 * Query to find customer by phone number
 * Uses the search parameter which searches across customer fields
 */
const CUSTOMER_SEARCH_QUERY = `
  query SearchCustomerByPhone($search: String, $pagination: PaginationInput) {
    listCustomer(search: $search, pagination: $pagination) {
      count
      data {
        id
        email
        firstName
        lastName
        phone
        createdAt
        updatedAt
        customerSegmentIds
        isEmailVerified
        isPhoneVerified
        birthDate
        gender
        note
        addresses {
          id
          firstName
          lastName
          phone
          addressLine1
          addressLine2
          postalCode
          isDefault
          city {
            id
            name
          }
          district {
            id
            name
          }
          country {
            id
            name
          }
        }
      }
    }
  }
`

/**
 * Query to fetch customer's orders sorted by date (newest first)
 */
const CUSTOMER_ORDERS_QUERY = `
  query GetCustomerOrders($customerId: StringFilterInput, $pagination: PaginationInput, $sort: String) {
    listOrder(customerId: $customerId, pagination: $pagination, sort: $sort) {
      count
      data {
        id
        orderNumber
        status
        orderPaymentStatus
        orderPackageStatus
        orderedAt
        updatedAt
        totalFinalPrice
        currencyCode
        customer {
          id
          email
          firstName
          lastName
          phone
        }
        shippingAddress {
          firstName
          lastName
          phone
          addressLine1
          addressLine2
          postalCode
          city {
            name
          }
          district {
            name
          }
          country {
            name
          }
        }
        billingAddress {
          firstName
          lastName
          phone
          addressLine1
          addressLine2
          city {
            name
          }
          district {
            name
          }
          country {
            name
          }
        }
        orderLineItems {
          id
          quantity
          finalPrice
          variant {
            id
            name
            sku
            barcodeList
          }
        }
      }
    }
  }
`

// ============================================================================
// PHONE NUMBER UTILITIES
// ============================================================================

/**
 * Normalize phone number for comparison
 * Removes all non-digit characters and handles Turkish format
 */
function normalizePhone(phone) {
  if (!phone) return ''
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '')
  // Handle Turkish country code variants
  if (digits.startsWith('90')) {
    digits = digits.substring(2)
  } else if (digits.startsWith('0')) {
    digits = digits.substring(1)
  }
  return digits
}

/**
 * Check if two phone numbers match (flexible comparison)
 */
function phoneMatches(phone1, phone2) {
  const norm1 = normalizePhone(phone1)
  const norm2 = normalizePhone(phone2)
  if (!norm1 || !norm2) return false

  // Check exact match or one ends with the other (for partial matches)
  return norm1 === norm2 || norm1.endsWith(norm2) || norm2.endsWith(norm1)
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Find customer by phone number
 */
async function findCustomerByPhone(token, phoneNumber) {
  // Search using the phone number
  const result = await executeGraphQL(token, CUSTOMER_SEARCH_QUERY, {
    search: phoneNumber,
    pagination: { limit: 20, page: 1 },
  })

  const customers = result.data?.listCustomer?.data || []

  if (customers.length === 0) {
    return null
  }

  // Try exact match first
  const normalizedInput = normalizePhone(phoneNumber)
  const exactMatch = customers.find((c) => {
    const customerPhone = normalizePhone(c.phone)
    return customerPhone === normalizedInput
  })

  if (exactMatch) {
    return exactMatch
  }

  // Try flexible match
  const flexMatch = customers.find((c) => phoneMatches(c.phone, phoneNumber))

  if (flexMatch) {
    return flexMatch
  }

  // Also check addresses for phone matches
  for (const customer of customers) {
    if (customer.addresses) {
      for (const addr of customer.addresses) {
        if (phoneMatches(addr.phone, phoneNumber)) {
          return customer
        }
      }
    }
  }

  // If search returned results but no phone match, return first as best guess
  // (search might have matched on other fields)
  return customers[0]
}

/**
 * Fetch customer's last N orders
 */
async function fetchCustomerOrders(token, customerId, limit = CONFIG.ORDERS_LIMIT) {
  const result = await executeGraphQL(token, CUSTOMER_ORDERS_QUERY, {
    customerId: { eq: customerId },
    pagination: { limit, page: 1 },
    sort: '-orderedAt', // Descending by order date
  })

  const orders = result.data?.listOrder?.data || []
  const totalCount = result.data?.listOrder?.count || 0

  // Transform orders to simplified structure
  return {
    totalOrderCount: totalCount,
    orders: orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.orderPaymentStatus,
      packageStatus: order.orderPackageStatus,
      totalPrice: order.totalFinalPrice,
      currency: order.currencyCode,
      orderedAt: order.orderedAt,
      updatedAt: order.updatedAt,
      itemCount: order.orderLineItems?.length || 0,
      lineItems: (order.orderLineItems || []).map((item) => ({
        id: item.id,
        variantId: item.variant?.id,
        variantName: item.variant?.name,
        sku: item.variant?.sku,
        quantity: item.quantity,
        finalPrice: item.finalPrice,
      })),
      shippingAddress: order.shippingAddress
        ? {
            fullName: `${order.shippingAddress.firstName || ''} ${order.shippingAddress.lastName || ''}`.trim(),
            phone: order.shippingAddress.phone,
            address: order.shippingAddress.addressLine1,
            addressLine2: order.shippingAddress.addressLine2,
            city: order.shippingAddress.city?.name,
            district: order.shippingAddress.district?.name,
            country: order.shippingAddress.country?.name,
            postalCode: order.shippingAddress.postalCode,
          }
        : null,
      billingAddress: order.billingAddress
        ? {
            fullName: `${order.billingAddress.firstName || ''} ${order.billingAddress.lastName || ''}`.trim(),
            phone: order.billingAddress.phone,
            address: order.billingAddress.addressLine1,
            addressLine2: order.billingAddress.addressLine2,
            city: order.billingAddress.city?.name,
            district: order.billingAddress.district?.name,
            country: order.billingAddress.country?.name,
          }
        : null,
    })),
  }
}

/**
 * Main block execution function
 *
 * This is the main entry point that would be called in a Sim workflow block.
 * It takes a phone number and returns customer + orders data.
 *
 * @param {string} phoneNumber - The phone number to search for (e.g., from <start.senderPhoneNumber>)
 * @returns {Object} Result with customer data and their last 2 orders
 */
async function fetchCustomerWithOrders(phoneNumber) {
  // Input validation
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return {
      success: false,
      found: false,
      customer: null,
      orders: [],
      totalOrderCount: 0,
      message: 'Phone number is required',
      error: 'INVALID_INPUT',
    }
  }

  // Clean up phone number
  const cleanPhone = phoneNumber.trim()
  if (cleanPhone.length < 5) {
    return {
      success: false,
      found: false,
      customer: null,
      orders: [],
      totalOrderCount: 0,
      message: 'Phone number is too short',
      error: 'INVALID_INPUT',
    }
  }

  try {
    // Get OAuth token (cached)
    const token = await getCachedToken()

    // Step 1: Find customer by phone number
    const customer = await findCustomerByPhone(token, cleanPhone)

    if (!customer) {
      return {
        success: true,
        found: false,
        customer: null,
        orders: [],
        totalOrderCount: 0,
        message: `No customer found with phone number: ${cleanPhone}`,
        searchedPhone: cleanPhone,
      }
    }

    // Step 2: Fetch customer's last 2 orders
    let ordersResult = { orders: [], totalOrderCount: 0 }
    let ordersError = null

    try {
      ordersResult = await fetchCustomerOrders(token, customer.id, CONFIG.ORDERS_LIMIT)
    } catch (orderError) {
      console.error('Failed to fetch orders:', orderError.message)
      ordersError = orderError.message
    }

    // Build successful response
    return {
      success: true,
      found: true,
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        fullName: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
        phone: customer.phone,
        isEmailVerified: customer.isEmailVerified,
        isPhoneVerified: customer.isPhoneVerified,
        birthDate: customer.birthDate,
        gender: customer.gender,
        note: customer.note,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        addresses: (customer.addresses || []).map((addr) => ({
          id: addr.id,
          fullName: `${addr.firstName || ''} ${addr.lastName || ''}`.trim(),
          phone: addr.phone,
          address: addr.addressLine1,
          addressLine2: addr.addressLine2,
          city: addr.city?.name,
          district: addr.district?.name,
          country: addr.country?.name,
          postalCode: addr.postalCode,
          isDefault: addr.isDefault,
        })),
      },
      orders: ordersResult.orders,
      totalOrderCount: ordersResult.totalOrderCount,
      ordersError: ordersError, // Will be null if orders fetched successfully
      message: ordersError
        ? `Customer found but failed to fetch orders: ${ordersError}`
        : ordersResult.orders.length > 0
          ? `Found customer with ${ordersResult.totalOrderCount} total orders, returning last ${ordersResult.orders.length}`
          : 'Customer found but has no orders',
      searchedPhone: cleanPhone,
    }
  } catch (error) {
    console.error('Customer fetch failed:', error)
    return {
      success: false,
      found: false,
      customer: null,
      orders: [],
      totalOrderCount: 0,
      message: `Failed to fetch customer: ${error.message}`,
      error: error.message,
      searchedPhone: cleanPhone,
    }
  }
}

// ============================================================================
// EXPORT FOR SIM WORKFLOW BLOCK
// ============================================================================

// This would be the code block content in Sim Studio
// Input: phoneNumber from workflow variable like <start.senderPhoneNumber>
// The function is exported so it can be used as a code block

export {
  fetchCustomerWithOrders,
  findCustomerByPhone,
  fetchCustomerOrders,
  getCachedToken,
  executeGraphQL,
  CONFIG,
}

// ============================================================================
// TEST RUNNER (for standalone execution)
// ============================================================================

async function runTests() {
  console.log('=' .repeat(70))
  console.log('🧪 IKAS Customer + Orders Block Test')
  console.log('=' .repeat(70))

  // Test phone numbers (replace with actual test data)
  const testPhones = [
    '+90 555 123 4567', // Standard Turkish format
    '05551234567',      // Local format
    '5551234567',       // Without leading zero
  ]

  console.log('\n📞 Testing with sample phone lookup...\n')

  try {
    // First, get a real customer phone from the system
    const token = await getCachedToken()
    console.log('✅ Token acquired')

    // Get a sample customer to test with
    const sampleResult = await executeGraphQL(token, CUSTOMER_SEARCH_QUERY, {
      pagination: { limit: 5, page: 1 },
    })

    const customers = sampleResult.data?.listCustomer?.data || []
    const customerWithPhone = customers.find((c) => c.phone)

    if (customerWithPhone) {
      console.log(`\n📋 Found test customer: ${customerWithPhone.firstName} ${customerWithPhone.lastName}`)
      console.log(`   Phone: ${customerWithPhone.phone}`)
      console.log(`   Email: ${customerWithPhone.email || 'N/A'}`)

      console.log('\n🔍 Testing fetchCustomerWithOrders...\n')
      const result = await fetchCustomerWithOrders(customerWithPhone.phone)

      console.log('Result:')
      console.log(JSON.stringify(result, null, 2))

      console.log('\n' + '=' .repeat(70))
      console.log('📊 SUMMARY')
      console.log('=' .repeat(70))
      console.log(`Success: ${result.success}`)
      console.log(`Customer Found: ${result.found}`)
      if (result.customer) {
        console.log(`Customer Name: ${result.customer.fullName}`)
        console.log(`Customer Phone: ${result.customer.phone}`)
        console.log(`Total Orders: ${result.totalOrderCount}`)
      }
      if (result.orders.length > 0) {
        console.log('\nLast 2 Orders:')
        result.orders.forEach((order, idx) => {
          console.log(`  ${idx + 1}. Order #${order.orderNumber}`)
          console.log(`     Status: ${order.status} | Payment: ${order.paymentStatus}`)
          console.log(`     Total: ${order.totalPrice} ${order.currency}`)
          console.log(`     Date: ${new Date(order.orderedAt).toLocaleString()}`)
          console.log(`     Items: ${order.itemCount}`)
        })
      }
    } else {
      console.log('⚠️  No customers with phone numbers found in system')
      console.log('   Testing with invalid phone to verify error handling...\n')

      const result = await fetchCustomerWithOrders('+90 000 000 0000')
      console.log('Result:')
      console.log(JSON.stringify(result, null, 2))
    }

    console.log('\n✅ TEST COMPLETED')
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

// Run tests if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`
if (isMainModule) {
  runTests()
}
