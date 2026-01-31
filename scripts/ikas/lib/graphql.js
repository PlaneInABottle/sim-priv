/**
 * IKAS GraphQL Utilities
 * Shared GraphQL queries and execution helpers
 */

import { fetchWithTimeout } from './auth.js'
import { IKAS_CONFIG } from './config.js'

/**
 * Execute a GraphQL query
 */
export async function executeGraphQL(token, query, variables = {}) {
  const response = await fetchWithTimeout(IKAS_CONFIG.GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    throw new Error(`GraphQL failed: ${response.status}`)
  }

  const data = await response.json()

  if (data.errors && data.errors.length > 0) {
    throw new Error(`GraphQL errors: ${data.errors.map((e) => e.message).join('; ')}`)
  }

  return data
}

/**
 * Fetch all categories
 * Includes salesChannelIds for visibility filtering
 */
export async function fetchCategories(token) {
  const query = `{
    listCategory {
      id
      name
      parentId
      categoryPath
      salesChannelIds
      metaData {
        slug
      }
    }
  }`

  const data = await executeGraphQL(token, query)
  return data.data.listCategory || []
}

/**
 * Fetch products for a category
 */
export async function fetchProducts(token, categoryId, limit = IKAS_CONFIG.PRODUCTS_LIMIT) {
  const query = `query($categoryIds: CategoryFilterInput, $pagination: PaginationInput) {
    listProduct(categoryIds: $categoryIds, pagination: $pagination) {
      data {
        id
        name
        categoryIds
        totalStock
        salesChannelIds
        metaData {
          slug
        }
        variants {
          id
          isActive
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
    pagination: { limit, page: 1 },
  })

  return data.data.listProduct.data || []
}

/**
 * Fetch detailed product information
 */
export async function fetchProductDetail(token, productId) {
  const query = `query($id: StringFilterInput, $pagination: PaginationInput) {
    listProduct(id: $id, pagination: $pagination) {
      data {
        id
        name
        shortDescription
        description
        totalStock
        categoryIds
        categories {
          id
          name
        }
        brandId
        brand {
          id
          name
        }
        tagIds
        tags {
          id
          name
        }
        metaData {
          slug
        }
        productVariantTypes {
          id
          name
          values {
            id
            name
          }
        }
        variants {
          id
          sku
          barcodeList
          isActive
          weight
          sellIfOutOfStock
          prices {
            sellPrice
            buyPrice
            discountPrice
            currency
          }
          stocks {
            stockCount
            stockLocationId
          }
          images {
            imageId
            fileName
            isMain
            isVideo
            order
          }
        }
        createdAt
        updatedAt
      }
    }
  }`

  const data = await executeGraphQL(token, query, {
    id: { eq: productId },
    pagination: { limit: 1, page: 1 },
  })

  return data.data.listProduct.data?.[0] || null
}

/**
 * Introspect a GraphQL type
 */
export async function introspectType(token, typeName) {
  const query = `{
    __type(name: "${typeName}") {
      name
      fields {
        name
        type {
          name
          kind
          ofType {
            name
            kind
          }
        }
      }
    }
  }`

  const data = await executeGraphQL(token, query)
  return data.data.__type?.fields || []
}
