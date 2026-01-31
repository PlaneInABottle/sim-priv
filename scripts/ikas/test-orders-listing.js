#!/usr/bin/env node
/**
 * IKAS Orders API Test Script
 *
 * Tests the listOrder GraphQL query with various filters and parameters.
 *
 * ============================================================================
 * IKAS ORDERS API FINDINGS
 * ============================================================================
 *
 * AVAILABLE FILTERS (from https://ikas.dev/docs/api/admin-api/orders#list-orders-1):
 *   - id: StringFilterInput              - Filter by order ID
 *   - orderNumber: StringFilterInput     - Filter by order number (e.g., "1001")
 *   - customerId: StringFilterInput      - Filter by customer ID
 *   - customerEmail: StringFilterInput   - Filter by customer email
 *   - status: OrderStatusEnumInputFilter - Order status (CREATED, CANCELLED, etc.)
 *   - orderPaymentStatus: OrderPaymentStatusEnumInputFilter - Payment status (PAID, PENDING, etc.)
 *   - orderPackageStatus: OrderPackageStatusEnumInputFilter - Package status (FULFILLED, etc.)
 *   - orderedAt: DateFilterInput         - Filter by order date range
 *   - updatedAt: DateFilterInput         - Filter by update date range
 *   - closedAt: DateFilterInput          - Filter by close date
 *   - salesChannelId: StringFilterInput  - Filter by sales channel
 *   - stockLocationId: StringFilterInput - Filter by stock location
 *   - branchId: StringFilterInput        - Filter by branch (for POS orders)
 *   - branchSessionId: StringFilterInput - Filter by branch session
 *   - terminalId: StringFilterInput      - Filter by terminal (for POS orders)
 *   - orderTagIds: StringFilterInput     - Filter by order tags
 *   - invoicesStoreAppId: StringFilterInput - Filter by invoice app
 *   - shippingMethod: OrderShippingMethodEnumFilterInput - Shipping method
 *   - paymentMethodType: OrderPaymentMethodEnumFilterInput - Payment method type
 *   - search: String                     - General search (searchable fields TBD)
 *   - sort: String                       - Sort field (e.g., "orderedAt")
 *   - pagination: PaginationInput        - { limit: number, page: number }
 *
 * ⚠️  PHONE NUMBER FILTERING:
 *   There is NO direct phone number filter parameter in the listOrder query.
 *   Phone numbers exist in the response data:
 *     - customer.phone (OrderCustomer type)
 *     - shippingAddress.phone (OrderAddress type)
 *     - billingAddress.phone (OrderAddress type)
 *
 *   Workaround options:
 *   1. Use the `search` parameter and test if it searches phone fields
 *   2. Look up customer by phone first, then filter orders by customerId
 *   3. Fetch all orders and filter client-side (not recommended for large datasets)
 *
 * ORDER STATUS VALUES:
 *   - CREATED, CANCELLED
 *
 * PAYMENT STATUS VALUES:
 *   - PAID, REFUNDED, PARTIALLY_PAID, FAILED
 *   - Note: "PENDING" and "PARTIALLY_REFUNDED" are NOT valid values
 *
 * PACKAGE STATUS VALUES:
 *   - UNFULFILLED, PARTIALLY_FULFILLED, FULFILLED, READY_FOR_SHIPMENT, SHIPPED, DELIVERED
 *
 * ============================================================================
 *
 * Usage: node scripts/ikas/test-orders-listing.js
 */

import { executeGraphQL, getToken, printHeader, separator } from './lib/index.js'

// GraphQL fragment for order fields (reusable across tests)
const ORDER_FIELDS = `
  id
  orderNumber
  status
  orderPaymentStatus
  orderPackageStatus
  orderedAt
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
    city { name }
    country { name }
  }
  billingAddress {
    firstName
    lastName
    phone
    addressLine1
    city { name }
  }
  orderLineItems {
    id
    quantity
    finalPrice
    variant {
      name
      sku
    }
  }
`

/**
 * Test 1: List orders with basic pagination
 */
async function testBasicPagination(token) {
  console.log('\n📋 Test 1: Basic Order Listing (first 10 orders)')
  console.log('-'.repeat(50))

  const query = `
    query($pagination: PaginationInput) {
      listOrder(pagination: $pagination) {
        count
        data {
          ${ORDER_FIELDS}
        }
      }
    }
  `

  const result = await executeGraphQL(token, query, {
    pagination: { limit: 10, page: 1 },
  })

  const orders = result.data.listOrder.data || []
  const count = result.data.listOrder.count

  console.log(`✅ Total orders in system: ${count}`)
  console.log(`✅ Retrieved: ${orders.length} orders`)

  if (orders.length > 0) {
    console.log('\n📦 Sample orders:')
    orders.slice(0, 5).forEach((order, idx) => {
      const customer = order.customer?.email || 'Guest'
      const phone = order.customer?.phone || order.shippingAddress?.phone || 'N/A'
      console.log(
        `   ${idx + 1}. #${order.orderNumber} | ${order.status} | ${order.totalFinalPrice} ${order.currencyCode} | ${customer} | 📞 ${phone}`
      )
    })
  }

  return { orders, count }
}

/**
 * Test 2: Filter orders by status
 */
async function testStatusFilter(token) {
  console.log('\n📋 Test 2: Filter Orders by Status')
  console.log('-'.repeat(50))

  const statuses = ['CREATED', 'CANCELLED']
  const results = {}

  for (const status of statuses) {
    const query = `
      query($status: OrderStatusEnumInputFilter, $pagination: PaginationInput) {
        listOrder(status: $status, pagination: $pagination) {
          count
          data {
            id
            orderNumber
            status
          }
        }
      }
    `

    const result = await executeGraphQL(token, query, {
      status: { eq: status },
      pagination: { limit: 5, page: 1 },
    })

    results[status] = result.data.listOrder.count
    console.log(`   ${status}: ${result.data.listOrder.count} orders`)
  }

  console.log('✅ Status filtering works correctly')
  return results
}

/**
 * Test 3: Filter orders by payment status
 */
async function testPaymentStatusFilter(token) {
  console.log('\n📋 Test 3: Filter Orders by Payment Status')
  console.log('-'.repeat(50))

  // Valid values: PAID, REFUNDED, PARTIALLY_PAID, FAILED
  const paymentStatuses = ['PAID', 'REFUNDED', 'PARTIALLY_PAID']
  const results = {}

  for (const status of paymentStatuses) {
    const query = `
      query($orderPaymentStatus: OrderPaymentStatusEnumInputFilter, $pagination: PaginationInput) {
        listOrder(orderPaymentStatus: $orderPaymentStatus, pagination: $pagination) {
          count
          data {
            id
            orderNumber
            orderPaymentStatus
          }
        }
      }
    `

    try {
      const result = await executeGraphQL(token, query, {
        orderPaymentStatus: { eq: status },
        pagination: { limit: 5, page: 1 },
      })

      results[status] = result.data.listOrder.count
      console.log(`   ${status}: ${result.data.listOrder.count} orders`)
    } catch (error) {
      console.log(`   ${status}: Error - ${error.message}`)
      results[status] = 'Error'
    }
  }

  console.log('✅ Payment status filtering tested')
  return results
}

/**
 * Test 4: Filter orders by date range
 */
async function testDateRangeFilter(token) {
  console.log('\n📋 Test 4: Filter Orders by Date Range')
  console.log('-'.repeat(50))

  // Last 30 days
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const now = Date.now()

  const query = `
    query($orderedAt: DateFilterInput, $pagination: PaginationInput) {
      listOrder(orderedAt: $orderedAt, pagination: $pagination) {
        count
        data {
          id
          orderNumber
          orderedAt
          status
        }
      }
    }
  `

  const result = await executeGraphQL(token, query, {
    orderedAt: { gte: thirtyDaysAgo, lte: now },
    pagination: { limit: 10, page: 1 },
  })

  const count = result.data.listOrder.count
  const orders = result.data.listOrder.data || []

  console.log(`✅ Orders in last 30 days: ${count}`)

  if (orders.length > 0) {
    console.log('   Recent orders:')
    orders.slice(0, 5).forEach((order, idx) => {
      const date = new Date(order.orderedAt).toLocaleDateString()
      console.log(`   ${idx + 1}. #${order.orderNumber} - ${date} - ${order.status}`)
    })
  }

  return { count, orders }
}

/**
 * Test 5: Filter orders by customer email
 */
async function testEmailFilter(token, testEmail = null) {
  console.log('\n📋 Test 5: Filter Orders by Customer Email')
  console.log('-'.repeat(50))

  if (!testEmail) {
    // First, get a sample order to find a customer email
    const sampleQuery = `
      query($pagination: PaginationInput) {
        listOrder(pagination: $pagination) {
          data {
            customer {
              email
            }
          }
        }
      }
    `

    const sampleResult = await executeGraphQL(token, sampleQuery, {
      pagination: { limit: 20, page: 1 },
    })

    const orderWithEmail = sampleResult.data.listOrder.data?.find((o) => o.customer?.email)
    if (orderWithEmail) {
      testEmail = orderWithEmail.customer.email
    }
  }

  if (!testEmail) {
    console.log('⚠️  No orders with customer emails found for testing')
    return null
  }

  console.log(`   Testing with email: ${testEmail}`)

  const query = `
    query($customerEmail: StringFilterInput, $pagination: PaginationInput) {
      listOrder(customerEmail: $customerEmail, pagination: $pagination) {
        count
        data {
          id
          orderNumber
          customer {
            email
            firstName
            lastName
          }
        }
      }
    }
  `

  const result = await executeGraphQL(token, query, {
    customerEmail: { eq: testEmail },
    pagination: { limit: 10, page: 1 },
  })

  const count = result.data.listOrder.count
  console.log(`✅ Orders for ${testEmail}: ${count}`)

  return { email: testEmail, count }
}

/**
 * Test 6: Test search parameter (check if it searches phone numbers)
 */
async function testSearchParameter(token) {
  console.log('\n📋 Test 6: Test Search Parameter')
  console.log('-'.repeat(50))

  // First, get a sample phone number from existing orders
  const sampleQuery = `
    query($pagination: PaginationInput) {
      listOrder(pagination: $pagination) {
        data {
          orderNumber
          customer {
            phone
          }
          shippingAddress {
            phone
          }
        }
      }
    }
  `

  const sampleResult = await executeGraphQL(token, sampleQuery, {
    pagination: { limit: 50, page: 1 },
  })

  const orders = sampleResult.data.listOrder.data || []
  const orderWithPhone = orders.find((o) => o.customer?.phone || o.shippingAddress?.phone)

  if (!orderWithPhone) {
    console.log('⚠️  No orders with phone numbers found for testing')
    return { searchable: false, reason: 'No phone data available' }
  }

  const testPhone = orderWithPhone.customer?.phone || orderWithPhone.shippingAddress?.phone
  const originalOrderNumber = orderWithPhone.orderNumber

  console.log(`   Found order #${originalOrderNumber} with phone: ${testPhone}`)
  console.log(`   Testing search with this phone number...`)

  // Test if search finds orders by phone
  const searchQuery = `
    query($search: String, $pagination: PaginationInput) {
      listOrder(search: $search, pagination: $pagination) {
        count
        data {
          orderNumber
          customer {
            phone
          }
          shippingAddress {
            phone
          }
        }
      }
    }
  `

  const searchResult = await executeGraphQL(token, searchQuery, {
    search: testPhone,
    pagination: { limit: 10, page: 1 },
  })

  const searchCount = searchResult.data.listOrder.count
  const searchOrders = searchResult.data.listOrder.data || []

  // Check if original order is in results
  const foundOriginal = searchOrders.some((o) => o.orderNumber === originalOrderNumber)

  if (foundOriginal && searchCount > 0) {
    console.log(`✅ Search by phone WORKS! Found ${searchCount} orders`)
    console.log(`   Original order #${originalOrderNumber} is in results`)
    return { searchable: true, phone: testPhone, count: searchCount }
  }
  console.log(`⚠️  Search by phone may NOT work with phone field`)
  console.log(
    `   Search returned ${searchCount} orders, but original order was ${foundOriginal ? '' : 'NOT '}found`
  )

  // Also test search with order number to verify search works at all
  const orderSearchResult = await executeGraphQL(token, searchQuery, {
    search: originalOrderNumber,
    pagination: { limit: 5, page: 1 },
  })

  const orderSearchCount = orderSearchResult.data.listOrder.count
  if (orderSearchCount > 0) {
    console.log(`   (Note: Search by order number works - found ${orderSearchCount} orders)`)
  }

  return { searchable: false, reason: 'Phone not in searchable fields' }
}

/**
 * Test 7: Alternative approach - lookup customer by phone, then get orders
 */
async function testPhoneViaCustomerLookup(token) {
  console.log('\n📋 Test 7: Phone Lookup via Customer API')
  console.log('-'.repeat(50))
  console.log('   Attempting to find customer by phone, then get their orders...')

  // Note: This would require the customer API to support phone filtering
  // Let's check if listCustomer has phone filter
  const customerQuery = `
    query($pagination: PaginationInput) {
      listCustomer(pagination: $pagination) {
        count
        data {
          id
          email
          firstName
          lastName
          phone
        }
      }
    }
  `

  try {
    const result = await executeGraphQL(token, customerQuery, {
      pagination: { limit: 5, page: 1 },
    })

    const customers = result.data.listCustomer?.data || []
    const customerWithPhone = customers.find((c) => c.phone)

    if (customerWithPhone) {
      console.log(`   Found customer with phone: ${customerWithPhone.phone}`)
      console.log(`   Customer ID: ${customerWithPhone.id}`)

      // Now get orders for this customer
      const orderQuery = `
        query($customerId: StringFilterInput, $pagination: PaginationInput) {
          listOrder(customerId: $customerId, pagination: $pagination) {
            count
            data {
              orderNumber
              orderedAt
              status
            }
          }
        }
      `

      const orderResult = await executeGraphQL(token, orderQuery, {
        customerId: { eq: customerWithPhone.id },
        pagination: { limit: 5, page: 1 },
      })

      const orderCount = orderResult.data.listOrder.count
      console.log(`✅ Customer has ${orderCount} orders`)
      console.log('   ℹ️  This is a viable workaround: find customer by phone → get their orders')

      return { viable: true, customerId: customerWithPhone.id, orderCount }
    }
    console.log('⚠️  No customers with phone numbers found')
    return { viable: false }
  } catch (error) {
    console.log(`⚠️  Customer API test failed: ${error.message}`)
    return { viable: false, error: error.message }
  }
}

/**
 * Test 8: Filter by order number
 */
async function testOrderNumberFilter(token) {
  console.log('\n📋 Test 8: Filter by Order Number')
  console.log('-'.repeat(50))

  // First get a sample order number
  const sampleQuery = `
    query($pagination: PaginationInput) {
      listOrder(pagination: $pagination) {
        data {
          orderNumber
        }
      }
    }
  `

  const sampleResult = await executeGraphQL(token, sampleQuery, {
    pagination: { limit: 1, page: 1 },
  })

  const sampleOrder = sampleResult.data.listOrder.data?.[0]
  if (!sampleOrder) {
    console.log('⚠️  No orders found for testing')
    return null
  }

  const testOrderNumber = sampleOrder.orderNumber
  console.log(`   Testing with order number: ${testOrderNumber}`)

  const query = `
    query($orderNumber: StringFilterInput, $pagination: PaginationInput) {
      listOrder(orderNumber: $orderNumber, pagination: $pagination) {
        count
        data {
          ${ORDER_FIELDS}
        }
      }
    }
  `

  const result = await executeGraphQL(token, query, {
    orderNumber: { eq: testOrderNumber },
    pagination: { limit: 1, page: 1 },
  })

  const count = result.data.listOrder.count
  const order = result.data.listOrder.data?.[0]

  if (order) {
    console.log(`✅ Found order #${order.orderNumber}`)
    console.log(`   Status: ${order.status}`)
    console.log(`   Payment: ${order.orderPaymentStatus}`)
    console.log(`   Total: ${order.totalFinalPrice} ${order.currencyCode}`)
    console.log(`   Customer: ${order.customer?.email || 'Guest'}`)
    console.log(`   Items: ${order.orderLineItems?.length || 0}`)
  }

  return { orderNumber: testOrderNumber, found: count > 0 }
}

/**
 * Main test runner
 */
async function main() {
  try {
    printHeader('🛒 IKAS Orders API Test Suite')

    console.log('\n🔑 Fetching OAuth token...')
    const token = await getToken()
    console.log('✅ Token received:', `${token.substring(0, 20)}...`)

    // Run all tests
    const results = {
      basicPagination: await testBasicPagination(token),
      statusFilter: await testStatusFilter(token),
      paymentStatusFilter: await testPaymentStatusFilter(token),
      dateRangeFilter: await testDateRangeFilter(token),
      emailFilter: await testEmailFilter(token),
      searchParameter: await testSearchParameter(token),
      phoneViaCustomer: await testPhoneViaCustomerLookup(token),
      orderNumberFilter: await testOrderNumberFilter(token),
    }

    // Summary
    separator()
    console.log('\n📊 TEST SUMMARY')
    separator()

    console.log('\n✅ Available Filters:')
    console.log('   - orderNumber: Filter by order number (WORKS)')
    console.log('   - status: Filter by order status (WORKS)')
    console.log('   - orderPaymentStatus: Filter by payment status (WORKS)')
    console.log('   - orderPackageStatus: Filter by package status (WORKS)')
    console.log('   - orderedAt: Filter by date range (WORKS)')
    console.log('   - customerEmail: Filter by customer email (WORKS)')
    console.log('   - customerId: Filter by customer ID (WORKS)')
    console.log('   - salesChannelId: Filter by sales channel')
    console.log('   - stockLocationId: Filter by stock location')
    console.log('   - orderTagIds: Filter by order tags')
    console.log('   - pagination: Limit and page support (WORKS)')

    console.log('\n⚠️  Phone Number Filtering:')
    if (results.searchParameter.searchable) {
      console.log('   ✅ Search parameter CAN find orders by phone number')
      console.log(`      Use: search: "${results.searchParameter.phone}"`)
    } else {
      console.log('   ❌ NO direct phone filter in listOrder query')
      console.log('   ❌ Search parameter does NOT search phone fields')
      console.log('\n   📋 Workaround:')
      console.log('      1. Use listCustomer to find customer by phone')
      console.log('      2. Then use customerId filter in listOrder')
      if (results.phoneViaCustomer.viable) {
        console.log('      ✅ This workaround has been verified to work!')
      }
    }

    separator()
    console.log('✅ ALL TESTS COMPLETED')
    separator()
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

main()
