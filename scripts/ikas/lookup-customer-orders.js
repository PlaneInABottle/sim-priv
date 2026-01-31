#!/usr/bin/env node
/**
 * IKAS Customer Order Lookup Test Script
 *
 * This script implements the customer order lookup logic for testing before
 * integrating as a custom tool in Sim Studio.
 *
 * Supports lookup by:
 * - Order number (direct lookup)
 * - Email (customer lookup → orders)
 * - Phone (customer lookup → orders)
 *
 * Features:
 * - Input validation and normalization
 * - OAuth token caching with Upstash Redis
 * - Customer caching for repeated lookups
 * - Automatic 401 retry with token refresh
 * - Comprehensive error handling
 * - Structured response format for AI agents
 *
 * Usage: node scripts/ikas/lookup-customer-orders.js
 *
 * @module lookup-customer-orders
 */

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

/** Search type constants */
const SEARCH_TYPES = {
  ORDER_NUMBER: 'orderNumber',
  EMAIL: 'email',
  PHONE: 'phone',
}

/** Valid order status values */
const ORDER_STATUSES = ['CREATED', 'CANCELLED']

/** Valid payment status values */
const PAYMENT_STATUSES = ['PAID', 'REFUNDED', 'PARTIALLY_PAID', 'FAILED']

/** Valid package status values */
const PACKAGE_STATUSES = [
  'UNFULFILLED',
  'PARTIALLY_FULFILLED',
  'FULFILLED',
  'READY_FOR_SHIPMENT',
  'SHIPPED',
  'DELIVERED',
]

/** Cache TTL values in seconds */
const CACHE_TTL = {
  TOKEN: 3500, // ~58 minutes (tokens expire at 1 hour)
  CUSTOMER: 300, // 5 minutes for customer lookups
}

/** Request configuration */
const REQUEST_CONFIG = {
  TIMEOUT: 15000, // 15 seconds
  MAX_RETRIES: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
}

/** Cache key prefixes */
const CACHE_KEYS = {
  TOKEN: 'ikas:token',
  TOKEN_LOCK: 'ikas:token:lock',
  CUSTOMER: 'ikas:customer',
}

/** Environment-based configuration */
const CONFIG = {
  OAUTH_URL:
    process.env.KAMATAS_IKAS_OAUTH_URL || 'https://kamatas.myikas.com/api/admin/oauth/token',
  GRAPHQL_URL: process.env.IKAS_GRAPHQL_URL || 'https://api.myikas.com/api/v1/admin/graphql',
  CLIENT_ID: process.env.KAMATAS_IKAS_CLIENT_ID || '31adc972-1033-41bb-b23b-96b45238d6a2',
  CLIENT_SECRET:
    process.env.KAMATAS_IKAS_CLIENT_SECRET ||
    's_5SFl7zDxObKLdJXjiKyccVev5fb666ee32be43558a8d7d9ad9484110',
  UPSTASH_URL: process.env.UPSTASH_REDIS_REST_URL || 'https://legible-marmoset-35404.upstash.io',
  UPSTASH_TOKEN:
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    'AYpMAAIncDFkNGU4NmRjNDYyNjA0OWE3YTJhZDhhMzNiMjdhZDI2ZXAxMzU0MDQ',
}

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

/**
 * Log levels for structured logging
 * @enum {string}
 */
const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
}

/**
 * Structured log entry
 * @typedef {Object} LogEntry
 * @property {string} level - Log level
 * @property {string} message - Log message
 * @property {number} timestamp - Unix timestamp
 * @property {Object} [data] - Additional data
 */

/** Accumulated log entries for debugging */
const logs = []

/**
 * Creates a structured log entry
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} [data] - Additional data
 */
function log(level, message, data = undefined) {
  const entry = {
    level,
    message,
    timestamp: Date.now(),
    ...(data && { data }),
  }
  logs.push(entry)
}

/**
 * Gets all accumulated logs
 * @returns {LogEntry[]} Array of log entries
 */
function getLogs() {
  return [...logs]
}

/**
 * Clears accumulated logs
 */
function clearLogs() {
  logs.length = 0
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates search input based on search type
 *
 * @param {string} searchType - Type of search (orderNumber, email, phone)
 * @param {string} searchValue - Value to validate
 * @returns {{ valid: boolean, error?: string }} Validation result
 *
 * @example
 * validateSearchInput('email', 'user@example.com') // { valid: true }
 * validateSearchInput('email', 'invalid') // { valid: false, error: '...' }
 */
function validateSearchInput(searchType, searchValue) {
  // Check for empty/null values
  if (!searchValue || typeof searchValue !== 'string') {
    return { valid: false, error: 'Search value is required' }
  }

  const trimmedValue = searchValue.trim()

  if (trimmedValue.length === 0) {
    return { valid: false, error: 'Search value cannot be empty' }
  }

  switch (searchType) {
    case SEARCH_TYPES.ORDER_NUMBER: {
      // Order numbers are typically numeric strings
      // Accept alphanumeric to handle various formats
      if (!/^[a-zA-Z0-9-]+$/.test(trimmedValue)) {
        return {
          valid: false,
          error: 'Order number must contain only letters, numbers, and hyphens',
        }
      }
      if (trimmedValue.length < 1 || trimmedValue.length > 50) {
        return { valid: false, error: 'Order number must be between 1 and 50 characters' }
      }
      return { valid: true }
    }

    case SEARCH_TYPES.EMAIL: {
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(trimmedValue)) {
        return { valid: false, error: 'Invalid email format' }
      }
      if (trimmedValue.length > 254) {
        return { valid: false, error: 'Email address is too long' }
      }
      return { valid: true }
    }

    case SEARCH_TYPES.PHONE: {
      // Remove all non-digit characters for length check
      const digits = trimmedValue.replace(/\D/g, '')
      if (digits.length < 7) {
        return { valid: false, error: 'Phone number must have at least 7 digits' }
      }
      if (digits.length > 15) {
        return { valid: false, error: 'Phone number cannot exceed 15 digits' }
      }
      return { valid: true }
    }

    default:
      return { valid: false, error: `Invalid search type: ${searchType}` }
  }
}

/**
 * Normalizes search value for consistent lookups
 *
 * @param {string} searchType - Type of search
 * @param {string} value - Value to normalize
 * @returns {string} Normalized value
 *
 * @example
 * normalizeSearchValue('phone', '+90 (555) 123-4567') // '905551234567'
 * normalizeSearchValue('email', 'User@Example.COM') // 'user@example.com'
 */
function normalizeSearchValue(searchType, value) {
  if (!value) return ''

  const trimmedValue = value.trim()

  switch (searchType) {
    case SEARCH_TYPES.ORDER_NUMBER:
      // Preserve case for order numbers, just trim
      return trimmedValue

    case SEARCH_TYPES.EMAIL:
      // Lowercase email for consistent matching
      return trimmedValue.toLowerCase()

    case SEARCH_TYPES.PHONE: {
      // Remove all non-digit characters
      let digits = trimmedValue.replace(/\D/g, '')

      // Handle Turkish country code variants
      // Keep +90 prefix as '90' for international format consistency
      if (digits.startsWith('0090')) {
        digits = `90${digits.substring(4)}`
      } else if (digits.startsWith('090')) {
        digits = `90${digits.substring(3)}`
      } else if (digits.startsWith('0') && digits.length === 11) {
        // Turkish local format starting with 0
        digits = `90${digits.substring(1)}`
      }

      return digits
    }

    default:
      return trimmedValue
  }
}

// ============================================================================
// HTTP UTILITIES
// ============================================================================

/**
 * Fetch with timeout using AbortController
 *
 * @param {string} url - Request URL
 * @param {RequestInit} options - Fetch options
 * @param {number} [timeout] - Timeout in milliseconds
 * @returns {Promise<Response>} Fetch response
 * @throws {Error} On timeout or network error
 */
async function fetchWithTimeout(url, options, timeout = REQUEST_CONFIG.TIMEOUT) {
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

// ============================================================================
// REDIS CACHE UTILITIES
// ============================================================================

/**
 * Gets a value from Redis cache
 *
 * @param {string} key - Cache key
 * @returns {Promise<string|null>} Cached value or null
 */
async function getCacheValue(key) {
  try {
    const response = await fetchWithTimeout(
      `${CONFIG.UPSTASH_URL}/get/${encodeURIComponent(key)}`,
      { headers: { Authorization: `Bearer ${CONFIG.UPSTASH_TOKEN}` } }
    )

    if (response.ok) {
      const data = await response.json()
      return data.result || null
    }
    return null
  } catch (error) {
    log(LogLevel.WARN, 'Cache get failed', { key, error: error.message })
    return null
  }
}

/**
 * Sets a value in Redis cache with TTL
 *
 * @param {string} key - Cache key
 * @param {string} value - Value to cache
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<boolean>} Success status
 */
async function setCacheValue(key, value, ttl) {
  try {
    const response = await fetchWithTimeout(`${CONFIG.UPSTASH_URL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CONFIG.UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['SETEX', key, ttl, value]),
    })

    return response.ok
  } catch (error) {
    log(LogLevel.WARN, 'Cache set failed', { key, error: error.message })
    return false
  }
}

/**
 * Acquires a distributed lock in Redis
 *
 * @param {string} lockKey - Lock key
 * @param {number} [ttl=10] - Lock TTL in seconds
 * @returns {Promise<string|null>} Lock value if acquired, null otherwise
 */
async function acquireLock(lockKey, ttl = 10) {
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
    log(LogLevel.WARN, 'Lock acquisition failed', { lockKey, error: error.message })
  }

  return null
}

/**
 * Releases a distributed lock in Redis
 *
 * @param {string} lockKey - Lock key
 * @param {string} lockValue - Lock value to verify ownership
 * @returns {Promise<void>}
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
    log(LogLevel.WARN, 'Lock release failed', { lockKey, error: error.message })
  }
}

// ============================================================================
// OAUTH TOKEN MANAGEMENT
// ============================================================================

/**
 * Fetches a fresh OAuth token from IKAS
 *
 * @returns {Promise<string>} Access token
 * @throws {Error} On authentication failure
 */
async function fetchFreshToken() {
  log(LogLevel.INFO, 'Fetching fresh OAuth token')

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
  log(LogLevel.INFO, 'OAuth token obtained successfully')
  return data.access_token
}

/**
 * Gets a cached or refreshed OAuth token
 *
 * Implements distributed locking to prevent token refresh races in
 * concurrent environments.
 *
 * @param {boolean} [forceRefresh=false] - Force token refresh
 * @returns {Promise<string>} Access token
 * @throws {Error} On token acquisition failure
 */
async function getIkasToken(forceRefresh = false) {
  const tokenCacheKey = `${CACHE_KEYS.TOKEN}:${CONFIG.CLIENT_ID}`
  const lockKey = `${CACHE_KEYS.TOKEN_LOCK}:${CONFIG.CLIENT_ID}`

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cachedToken = await getCacheValue(tokenCacheKey)
    if (cachedToken) {
      log(LogLevel.DEBUG, 'Using cached OAuth token')
      return cachedToken
    }
  }

  // Acquire lock for token refresh
  const lockValue = await acquireLock(lockKey, 10)

  if (!lockValue) {
    // Another process is refreshing, wait and retry cache
    log(LogLevel.DEBUG, 'Lock not acquired, waiting for cache')

    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 500))
      const cachedToken = await getCacheValue(tokenCacheKey)
      if (cachedToken) return cachedToken
    }

    throw new Error('Could not acquire lock and no cached token available')
  }

  try {
    // Double-check cache after acquiring lock
    if (!forceRefresh) {
      const cachedToken = await getCacheValue(tokenCacheKey)
      if (cachedToken) return cachedToken
    }

    // Fetch fresh token
    const accessToken = await fetchFreshToken()

    // Cache the token
    await setCacheValue(tokenCacheKey, accessToken, CACHE_TTL.TOKEN)

    return accessToken
  } finally {
    await releaseLock(lockKey, lockValue)
  }
}

// ============================================================================
// GRAPHQL EXECUTION
// ============================================================================

/**
 * Executes a GraphQL query with automatic 401 retry
 *
 * @param {string} token - OAuth access token
 * @param {string} query - GraphQL query
 * @param {Object} [variables={}] - Query variables
 * @param {number} [retryCount=0] - Current retry count
 * @returns {Promise<Object>} GraphQL response data
 * @throws {Error} On query failure
 */
async function executeGraphQL(token, query, variables = {}, retryCount = 0) {
  log(LogLevel.DEBUG, 'Executing GraphQL query', { variables })

  const response = await fetchWithTimeout(CONFIG.GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  })

  // Handle 401 - token expired
  if (response.status === 401 && retryCount < REQUEST_CONFIG.MAX_RETRIES) {
    log(LogLevel.INFO, 'Token expired, refreshing')
    const newToken = await getIkasToken(true)
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

/** Customer search query by email or phone */
const CUSTOMER_SEARCH_QUERY = `
  query SearchCustomer($search: String, $email: StringFilterInput, $pagination: PaginationInput) {
    listCustomer(search: $search, email: $email, pagination: $pagination) {
      count
      data {
        id
        email
        firstName
        lastName
        phone
        createdAt
        updatedAt
        isEmailVerified
        isPhoneVerified
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
          city { name }
          district { name }
          country { name }
        }
      }
    }
  }
`

/** Orders query with filters */
const ORDERS_QUERY = `
  query GetOrders(
    $customerId: StringFilterInput
    $status: OrderStatusEnumInputFilter
    $pagination: PaginationInput
    $sort: String
  ) {
    listOrder(
      customerId: $customerId
      status: $status
      pagination: $pagination
      sort: $sort
    ) {
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
          city { name }
          district { name }
          country { name }
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

/** Single order query by order number */
const ORDER_BY_NUMBER_QUERY = `
  query GetOrderByNumber($orderNumber: StringFilterInput, $pagination: PaginationInput) {
    listOrder(orderNumber: $orderNumber, pagination: $pagination) {
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
          city { name }
          district { name }
          country { name }
        }
        billingAddress {
          firstName
          lastName
          phone
          addressLine1
          addressLine2
          city { name }
          district { name }
          country { name }
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
// LOOKUP FUNCTIONS
// ============================================================================

/**
 * Looks up a customer by email or phone identifier
 *
 * @param {string} token - OAuth access token
 * @param {string} searchType - Search type (email or phone)
 * @param {string} searchValue - Normalized search value
 * @returns {Promise<Object|null>} Customer object or null if not found
 */
async function lookupCustomerByIdentifier(token, searchType, searchValue) {
  log(LogLevel.INFO, 'Looking up customer', { searchType, searchValue })

  // Check customer cache first
  const cacheKey = `${CACHE_KEYS.CUSTOMER}:${searchType}:${searchValue}`
  const cachedCustomer = await getCacheValue(cacheKey)

  if (cachedCustomer) {
    log(LogLevel.DEBUG, 'Using cached customer data')
    return JSON.parse(cachedCustomer)
  }

  // Build query variables based on search type
  const variables = {
    pagination: { limit: 20, page: 1 },
  }

  if (searchType === SEARCH_TYPES.EMAIL) {
    // Use exact email filter for better precision
    variables.email = { eq: searchValue }
  } else {
    // Use search for phone (searches across customer fields)
    variables.search = searchValue
  }

  const result = await executeGraphQL(token, CUSTOMER_SEARCH_QUERY, variables)
  const customers = result.data?.listCustomer?.data || []

  if (customers.length === 0) {
    log(LogLevel.INFO, 'No customer found', { searchType, searchValue })
    return null
  }

  // For email, first result should be exact match
  if (searchType === SEARCH_TYPES.EMAIL) {
    const customer = customers[0]
    await setCacheValue(cacheKey, JSON.stringify(customer), CACHE_TTL.CUSTOMER)
    log(LogLevel.INFO, 'Customer found by email', { customerId: customer.id })
    return customer
  }

  // For phone, find exact match
  const normalizedSearch = searchValue
  let matchedCustomer = null

  // Try exact phone match
  matchedCustomer = customers.find((c) => {
    const customerPhone = normalizeSearchValue(SEARCH_TYPES.PHONE, c.phone)
    return (
      customerPhone === normalizedSearch ||
      customerPhone.endsWith(normalizedSearch) ||
      normalizedSearch.endsWith(customerPhone)
    )
  })

  // If no phone match on customer, check addresses
  if (!matchedCustomer) {
    for (const customer of customers) {
      if (customer.addresses) {
        for (const addr of customer.addresses) {
          const addrPhone = normalizeSearchValue(SEARCH_TYPES.PHONE, addr.phone)
          if (
            addrPhone === normalizedSearch ||
            addrPhone.endsWith(normalizedSearch) ||
            normalizedSearch.endsWith(addrPhone)
          ) {
            matchedCustomer = customer
            break
          }
        }
        if (matchedCustomer) break
      }
    }
  }

  // Fall back to first result if search returned results
  if (!matchedCustomer && customers.length > 0) {
    log(LogLevel.WARN, 'No exact phone match, using first result')
    matchedCustomer = customers[0]
  }

  if (matchedCustomer) {
    await setCacheValue(cacheKey, JSON.stringify(matchedCustomer), CACHE_TTL.CUSTOMER)
    log(LogLevel.INFO, 'Customer found', { customerId: matchedCustomer.id })
  }

  return matchedCustomer
}

/**
 * Looks up orders by customer ID with optional filters
 *
 * @param {string} token - OAuth access token
 * @param {string} customerId - Customer ID
 * @param {string} [orderStatus] - Optional order status filter
 * @param {number} [limit=10] - Maximum number of orders to return
 * @returns {Promise<{ orders: Object[], totalCount: number }>} Orders result
 */
async function lookupOrdersByCustomerId(
  token,
  customerId,
  orderStatus = null,
  limit = REQUEST_CONFIG.DEFAULT_LIMIT
) {
  log(LogLevel.INFO, 'Looking up orders', { customerId, orderStatus, limit })

  const variables = {
    customerId: { eq: customerId },
    pagination: { limit: Math.min(limit, REQUEST_CONFIG.MAX_LIMIT), page: 1 },
    sort: '-orderedAt', // Newest first
  }

  if (orderStatus && ORDER_STATUSES.includes(orderStatus)) {
    variables.status = { eq: orderStatus }
  }

  const result = await executeGraphQL(token, ORDERS_QUERY, variables)
  const orders = result.data?.listOrder?.data || []
  const totalCount = result.data?.listOrder?.count || 0

  log(LogLevel.INFO, 'Orders retrieved', { count: orders.length, totalCount })

  return { orders, totalCount }
}

/**
 * Looks up a single order by order number
 *
 * @param {string} token - OAuth access token
 * @param {string} orderNumber - Order number to look up
 * @returns {Promise<Object|null>} Order object or null if not found
 */
async function lookupOrderByNumber(token, orderNumber) {
  log(LogLevel.INFO, 'Looking up order by number', { orderNumber })

  const result = await executeGraphQL(token, ORDER_BY_NUMBER_QUERY, {
    orderNumber: { eq: orderNumber },
    pagination: { limit: 1, page: 1 },
  })

  const orders = result.data?.listOrder?.data || []

  if (orders.length === 0) {
    log(LogLevel.INFO, 'Order not found', { orderNumber })
    return null
  }

  log(LogLevel.INFO, 'Order found', { orderNumber, orderId: orders[0].id })
  return orders[0]
}

// ============================================================================
// RESPONSE FORMATTING
// ============================================================================

/**
 * Formats a customer object for response
 *
 * @param {Object} customer - Raw customer object
 * @returns {Object} Formatted customer
 */
function formatCustomer(customer) {
  if (!customer) return null

  return {
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    fullName: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || null,
    phone: customer.phone,
    isEmailVerified: customer.isEmailVerified,
    isPhoneVerified: customer.isPhoneVerified,
    note: customer.note,
    createdAt: customer.createdAt,
    addresses: (customer.addresses || []).map((addr) => ({
      id: addr.id,
      fullName: `${addr.firstName || ''} ${addr.lastName || ''}`.trim() || null,
      phone: addr.phone,
      address: addr.addressLine1,
      addressLine2: addr.addressLine2,
      city: addr.city?.name,
      district: addr.district?.name,
      country: addr.country?.name,
      postalCode: addr.postalCode,
      isDefault: addr.isDefault,
    })),
  }
}

/**
 * Formats an order object for response
 *
 * @param {Object} order - Raw order object
 * @returns {Object} Formatted order
 */
function formatOrder(order) {
  if (!order) return null

  return {
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
      barcode: item.variant?.barcodeList?.[0],
      quantity: item.quantity,
      price: item.finalPrice,
    })),
    shippingAddress: order.shippingAddress
      ? {
          fullName:
            `${order.shippingAddress.firstName || ''} ${order.shippingAddress.lastName || ''}`.trim() ||
            null,
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
          fullName:
            `${order.billingAddress.firstName || ''} ${order.billingAddress.lastName || ''}`.trim() ||
            null,
          phone: order.billingAddress.phone,
          address: order.billingAddress.addressLine1,
          addressLine2: order.billingAddress.addressLine2,
          city: order.billingAddress.city?.name,
          district: order.billingAddress.district?.name,
          country: order.billingAddress.country?.name,
        }
      : null,
    customer: order.customer
      ? {
          id: order.customer.id,
          email: order.customer.email,
          fullName:
            `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || null,
          phone: order.customer.phone,
        }
      : null,
  }
}

/**
 * Formats the complete lookup response for AI agent consumption
 *
 * @param {Object|null} customer - Customer object
 * @param {Object[]} orders - Array of order objects
 * @param {string} searchType - Search type used
 * @param {string} searchValue - Search value used
 * @param {number} [totalOrders] - Total orders count
 * @returns {Object} Formatted response
 */
function formatOrderResponse(customer, orders, searchType, searchValue, totalOrders = null) {
  const formattedOrders = orders.map(formatOrder)
  const orderCount = totalOrders ?? orders.length
  const hasMore = orderCount > orders.length

  // Build user-friendly message
  let message = ''

  if (searchType === SEARCH_TYPES.ORDER_NUMBER) {
    if (orders.length > 0) {
      const order = formattedOrders[0]
      message = `Sipariş #${order.orderNumber} bulundu. Durum: ${order.status}, Ödeme: ${order.paymentStatus}, Toplam: ${order.totalPrice} ${order.currency}`
    } else {
      message = `Sipariş numarası "${searchValue}" ile eşleşen sipariş bulunamadı.`
    }
  } else {
    const identifier = searchType === SEARCH_TYPES.EMAIL ? 'e-posta' : 'telefon'

    if (!customer) {
      message = `${identifier} "${searchValue}" ile eşleşen müşteri bulunamadı.`
    } else if (orders.length === 0) {
      message = `Müşteri bulundu (${customer.firstName} ${customer.lastName}), ancak sipariş kaydı yok.`
    } else {
      message = `Müşteri ${customer.firstName} ${customer.lastName} için ${orderCount} sipariş bulundu.${hasMore ? ` Son ${orders.length} sipariş gösteriliyor.` : ''}`
    }
  }

  return {
    success: true,
    searchType,
    searchValue,
    customer: formatCustomer(customer),
    orders: formattedOrders,
    summary: {
      totalOrders: orderCount,
      returnedOrders: orders.length,
      hasMore,
    },
    message,
  }
}

// ============================================================================
// MAIN LOOKUP FUNCTION
// ============================================================================

/**
 * Main customer order lookup function
 *
 * Performs a unified lookup by order number, email, or phone.
 * Handles validation, normalization, caching, and response formatting.
 *
 * @param {Object} params - Lookup parameters
 * @param {string} params.searchType - Type of search (orderNumber, email, phone)
 * @param {string} params.searchValue - Value to search for
 * @param {string} [params.orderStatus] - Optional order status filter
 * @param {number} [params.limit=10] - Maximum orders to return
 * @returns {Promise<Object>} Lookup result
 *
 * @example
 * // Lookup by order number
 * await lookupCustomerOrders({ searchType: 'orderNumber', searchValue: '1001' })
 *
 * // Lookup by email with status filter
 * await lookupCustomerOrders({
 *   searchType: 'email',
 *   searchValue: 'customer@example.com',
 *   orderStatus: 'CREATED',
 *   limit: 5
 * })
 */
async function lookupCustomerOrders({
  searchType,
  searchValue,
  orderStatus = null,
  limit = REQUEST_CONFIG.DEFAULT_LIMIT,
}) {
  // Clear previous logs
  clearLogs()
  log(LogLevel.INFO, 'Starting customer order lookup', {
    searchType,
    searchValue,
    orderStatus,
    limit,
  })

  try {
    // Validate input
    const validation = validateSearchInput(searchType, searchValue)
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        searchType,
        searchValue,
        customer: null,
        orders: [],
        summary: { totalOrders: 0, returnedOrders: 0, hasMore: false },
        message: validation.error,
      }
    }

    // Normalize search value
    const normalizedValue = normalizeSearchValue(searchType, searchValue)
    log(LogLevel.DEBUG, 'Normalized search value', {
      original: searchValue,
      normalized: normalizedValue,
    })

    // Get OAuth token
    const token = await getIkasToken()

    // Handle order number lookup (direct order query)
    if (searchType === SEARCH_TYPES.ORDER_NUMBER) {
      const order = await lookupOrderByNumber(token, normalizedValue)

      if (!order) {
        return formatOrderResponse(null, [], searchType, searchValue)
      }

      // Extract customer from order if available
      const customer = order.customer || null

      return formatOrderResponse(customer, [order], searchType, searchValue, 1)
    }

    // Handle email/phone lookup (customer → orders)
    const customer = await lookupCustomerByIdentifier(token, searchType, normalizedValue)

    if (!customer) {
      return formatOrderResponse(null, [], searchType, searchValue)
    }

    // Fetch orders for customer
    const { orders, totalCount } = await lookupOrdersByCustomerId(
      token,
      customer.id,
      orderStatus,
      limit
    )

    return formatOrderResponse(customer, orders, searchType, searchValue, totalCount)
  } catch (error) {
    log(LogLevel.ERROR, 'Lookup failed', { error: error.message })

    return {
      success: false,
      error: error.message,
      searchType,
      searchValue,
      customer: null,
      orders: [],
      summary: { totalOrders: 0, returnedOrders: 0, hasMore: false },
      message: `Arama sırasında hata oluştu: ${error.message}`,
      logs: getLogs(),
    }
  }
}

// ============================================================================
// TEST CASES
// ============================================================================

/**
 * Test result structure
 * @typedef {Object} TestResult
 * @property {string} name - Test name
 * @property {boolean} passed - Whether test passed
 * @property {Object} [result] - Test result data
 * @property {string} [error] - Error message if failed
 */

/**
 * Runs all test cases
 * @returns {Promise<void>}
 */
async function runTests() {
  const separator = '='.repeat(70)
  const testResults = []

  console.log(separator)
  console.log('🧪 IKAS Customer Order Lookup Test Suite')
  console.log(separator)

  // Helper to run and record test
  async function runTest(name, testFn) {
    console.log(`\n📋 ${name}`)
    console.log('-'.repeat(50))

    try {
      const result = await testFn()
      testResults.push({ name, passed: true, result })
      console.log('✅ PASSED')
      return result
    } catch (error) {
      testResults.push({ name, passed: false, error: error.message })
      console.log(`❌ FAILED: ${error.message}`)
      return null
    }
  }

  // Test 1: Get token first
  let testOrderNumber = null
  let testEmail = null
  let testPhone = null

  await runTest('Token Acquisition', async () => {
    const token = await getIkasToken()
    console.log(`   Token: ${token.substring(0, 20)}...`)
    return { token: `${token.substring(0, 20)}...` }
  })

  // Get sample data for tests
  console.log('\n📝 Fetching sample data for tests...')
  try {
    const token = await getIkasToken()

    // Get a sample order
    const orderResult = await executeGraphQL(
      token,
      ORDER_BY_NUMBER_QUERY.replace('$orderNumber: StringFilterInput,', '').replace(
        'orderNumber: $orderNumber,',
        ''
      ),
      {
        pagination: { limit: 5, page: 1 },
      }
    )

    const sampleOrders = orderResult.data?.listOrder?.data || []
    if (sampleOrders.length > 0) {
      testOrderNumber = sampleOrders[0].orderNumber
      console.log(`   Found sample order number: ${testOrderNumber}`)
    }

    // Get a sample customer with email and phone
    const customerResult = await executeGraphQL(token, CUSTOMER_SEARCH_QUERY, {
      pagination: { limit: 20, page: 1 },
    })

    const customers = customerResult.data?.listCustomer?.data || []
    const customerWithEmail = customers.find((c) => c.email)
    const customerWithPhone = customers.find((c) => c.phone)

    if (customerWithEmail) {
      testEmail = customerWithEmail.email
      console.log(`   Found sample email: ${testEmail}`)
    }
    if (customerWithPhone) {
      testPhone = customerWithPhone.phone
      console.log(`   Found sample phone: ${testPhone}`)
    }
  } catch (error) {
    console.log(`   ⚠️ Could not fetch sample data: ${error.message}`)
  }

  // Test 2: Lookup by order number (direct lookup)
  if (testOrderNumber) {
    await runTest('Test: Lookup by Order Number', async () => {
      const result = await lookupCustomerOrders({
        searchType: SEARCH_TYPES.ORDER_NUMBER,
        searchValue: testOrderNumber,
      })

      console.log(`   Success: ${result.success}`)
      console.log(`   Orders found: ${result.orders.length}`)
      if (result.orders.length > 0) {
        console.log(`   Order #: ${result.orders[0].orderNumber}`)
        console.log(`   Status: ${result.orders[0].status}`)
      }
      console.log(`   Message: ${result.message}`)

      if (!result.success || result.orders.length === 0) {
        throw new Error('Order lookup should have returned results')
      }

      return result
    })
  }

  // Test 3: Lookup by email
  if (testEmail) {
    await runTest('Test: Lookup by Email', async () => {
      const result = await lookupCustomerOrders({
        searchType: SEARCH_TYPES.EMAIL,
        searchValue: testEmail,
      })

      console.log(`   Success: ${result.success}`)
      console.log(`   Customer found: ${result.customer ? result.customer.fullName : 'No'}`)
      console.log(`   Orders found: ${result.summary.totalOrders}`)
      console.log(`   Message: ${result.message}`)

      if (!result.success) {
        throw new Error('Email lookup failed unexpectedly')
      }

      return result
    })
  }

  // Test 4: Lookup by phone
  if (testPhone) {
    await runTest('Test: Lookup by Phone', async () => {
      const result = await lookupCustomerOrders({
        searchType: SEARCH_TYPES.PHONE,
        searchValue: testPhone,
      })

      console.log(`   Success: ${result.success}`)
      console.log(`   Customer found: ${result.customer ? result.customer.fullName : 'No'}`)
      console.log(`   Orders found: ${result.summary.totalOrders}`)
      console.log(`   Message: ${result.message}`)

      if (!result.success) {
        throw new Error('Phone lookup failed unexpectedly')
      }

      return result
    })
  }

  // Test 5: Lookup with no results (non-existent order)
  await runTest('Test: No Results (Non-existent Order)', async () => {
    const result = await lookupCustomerOrders({
      searchType: SEARCH_TYPES.ORDER_NUMBER,
      searchValue: 'NONEXISTENT-99999999',
    })

    console.log(`   Success: ${result.success}`)
    console.log(`   Orders found: ${result.orders.length}`)
    console.log(`   Message: ${result.message}`)

    if (result.orders.length > 0) {
      throw new Error('Non-existent order should return empty results')
    }

    return result
  })

  // Test 6: Invalid input formats
  await runTest('Test: Invalid Email Format', async () => {
    const result = await lookupCustomerOrders({
      searchType: SEARCH_TYPES.EMAIL,
      searchValue: 'not-an-email',
    })

    console.log(`   Success: ${result.success}`)
    console.log(`   Error: ${result.error || 'None'}`)
    console.log(`   Message: ${result.message}`)

    if (result.success) {
      throw new Error('Invalid email should fail validation')
    }

    return result
  })

  await runTest('Test: Invalid Phone Format (too short)', async () => {
    const result = await lookupCustomerOrders({
      searchType: SEARCH_TYPES.PHONE,
      searchValue: '123',
    })

    console.log(`   Success: ${result.success}`)
    console.log(`   Error: ${result.error || 'None'}`)
    console.log(`   Message: ${result.message}`)

    if (result.success) {
      throw new Error('Short phone number should fail validation')
    }

    return result
  })

  // Test 7: Order status filter
  if (testEmail) {
    await runTest('Test: With Order Status Filter (CREATED)', async () => {
      const result = await lookupCustomerOrders({
        searchType: SEARCH_TYPES.EMAIL,
        searchValue: testEmail,
        orderStatus: 'CREATED',
      })

      console.log(`   Success: ${result.success}`)
      console.log(`   Customer found: ${result.customer ? result.customer.fullName : 'No'}`)
      console.log(`   Orders found: ${result.summary.totalOrders}`)
      console.log(`   Message: ${result.message}`)

      // All returned orders should have CREATED status
      const invalidOrders = result.orders.filter((o) => o.status !== 'CREATED')
      if (invalidOrders.length > 0) {
        throw new Error('Status filter should only return CREATED orders')
      }

      return result
    })
  }

  // Test 8: Custom limit
  if (testEmail) {
    await runTest('Test: With Custom Limit (2)', async () => {
      const result = await lookupCustomerOrders({
        searchType: SEARCH_TYPES.EMAIL,
        searchValue: testEmail,
        limit: 2,
      })

      console.log(`   Success: ${result.success}`)
      console.log(`   Total orders: ${result.summary.totalOrders}`)
      console.log(`   Returned orders: ${result.summary.returnedOrders}`)
      console.log(`   Has more: ${result.summary.hasMore}`)
      console.log(`   Message: ${result.message}`)

      if (result.orders.length > 2) {
        throw new Error('Should not return more than requested limit')
      }

      return result
    })
  }

  // Test 9: Phone normalization
  await runTest('Test: Phone Normalization', async () => {
    const testCases = [
      { input: '+90 555 123 4567', expected: '905551234567' },
      { input: '0555 123 4567', expected: '905551234567' },
      { input: '555-123-4567', expected: '5551234567' }, // No country code prefix without leading 0
      { input: '05551234567', expected: '905551234567' }, // Turkish local format (11 digits starting with 0)
      { input: '00905551234567', expected: '905551234567' }, // International dialing format
      { input: '0905551234567', expected: '905551234567' }, // Alternative format
    ]

    for (const tc of testCases) {
      const normalized = normalizeSearchValue(SEARCH_TYPES.PHONE, tc.input)
      console.log(`   "${tc.input}" → "${normalized}"`)
      if (normalized !== tc.expected) {
        throw new Error(`Expected "${tc.expected}" but got "${normalized}"`)
      }
    }

    return { passed: true }
  })

  // Test 10: Email normalization
  await runTest('Test: Email Normalization', async () => {
    const testCases = [
      { input: 'User@Example.COM', expected: 'user@example.com' },
      { input: '  TEST@test.com  ', expected: 'test@test.com' },
    ]

    for (const tc of testCases) {
      const normalized = normalizeSearchValue(SEARCH_TYPES.EMAIL, tc.input)
      console.log(`   "${tc.input}" → "${normalized}"`)
      if (normalized !== tc.expected) {
        throw new Error(`Expected "${tc.expected}" but got "${normalized}"`)
      }
    }

    return { passed: true }
  })

  // Summary
  console.log(`\n${separator}`)
  console.log('📊 TEST SUMMARY')
  console.log(separator)

  const passed = testResults.filter((t) => t.passed).length
  const failed = testResults.filter((t) => !t.passed).length

  console.log(`\n   Total: ${testResults.length}`)
  console.log(`   ✅ Passed: ${passed}`)
  console.log(`   ❌ Failed: ${failed}`)

  if (failed > 0) {
    console.log('\n   Failed tests:')
    testResults.filter((t) => !t.passed).forEach((t) => console.log(`   - ${t.name}: ${t.error}`))
  }

  console.log(`\n${separator}`)
  console.log(failed === 0 ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED')
  console.log(separator)

  process.exit(failed > 0 ? 1 : 0)
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Constants
  SEARCH_TYPES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PACKAGE_STATUSES,
  CACHE_TTL,
  REQUEST_CONFIG,
  // Validation functions
  validateSearchInput,
  normalizeSearchValue,
  // Token management
  getIkasToken,
  // Lookup functions
  lookupCustomerByIdentifier,
  lookupOrdersByCustomerId,
  lookupOrderByNumber,
  // Response formatting
  formatOrderResponse,
  formatCustomer,
  formatOrder,
  // Main function
  lookupCustomerOrders,
  // Logging
  getLogs,
  clearLogs,
}

// ============================================================================
// RUN TESTS IF EXECUTED DIRECTLY
// ============================================================================

const isMainModule = import.meta.url === `file://${process.argv[1]}`
if (isMainModule) {
  runTests()
}
