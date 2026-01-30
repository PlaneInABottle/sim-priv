/**
 * IKAS Test Helpers
 * Shared utility functions for test scripts
 */

import { IKAS_CONFIG } from './config.js'

/**
 * Get product price from active variant
 */
export function getProductPrice(product) {
  const activeVariant = product.variants?.find((v) => v.isActive)
  if (!activeVariant || !activeVariant.prices || activeVariant.prices.length === 0) {
    return null
  }

  const price = activeVariant.prices[0]
  return {
    regular: price.sellPrice,
    discounted: price.discountPrice,
    currency: price.currency || 'TRY',
  }
}

/**
 * Format price for display
 */
export function formatPrice(price, currency = 'TRY') {
  return `${price} ${currency}`
}

/**
 * Format price with discount info
 */
export function formatPriceWithDiscount(priceInfo) {
  if (!priceInfo) return 'Price not available'

  if (priceInfo.discounted && priceInfo.discounted < priceInfo.regular) {
    return `${formatPrice(priceInfo.discounted, priceInfo.currency)} (was ${formatPrice(priceInfo.regular, priceInfo.currency)})`
  }
  return formatPrice(priceInfo.regular, priceInfo.currency)
}

/**
 * Build breadcrumb path for category
 */
export function buildPath(categories, categoryId) {
  if (!categoryId) return 'Ana Sayfa'

  const path = []
  let currentId = categoryId
  const visited = new Set()
  let depth = 0

  while (currentId && depth < IKAS_CONFIG.MAX_DEPTH) {
    if (visited.has(currentId)) break
    visited.add(currentId)
    const cat = categories.find((c) => c.id === currentId)
    if (!cat) break
    path.unshift(cat.name)
    currentId = cat.parentId
    depth++
  }

  return `Ana Sayfa > ${path.join(' > ')}`
}

/**
 * Construct product URL from slug
 */
export function constructProductUrl(slug) {
  return slug ? `${IKAS_CONFIG.STOREFRONT_BASE}${IKAS_CONFIG.PRODUCT_PATH_PREFIX}${slug}` : null
}

/**
 * Construct category URL from slug
 */
export function constructCategoryUrl(slug) {
  return slug ? `${IKAS_CONFIG.STOREFRONT_BASE}${IKAS_CONFIG.CATEGORY_PATH_PREFIX}${slug}` : null
}

/**
 * Get root categories
 */
export function getRootCategories(categories) {
  return categories.filter((c) => !c.parentId)
}

/**
 * Get subcategories for a parent
 */
export function getSubcategories(categories, parentId) {
  return categories.filter((c) => c.parentId === parentId)
}

/**
 * Check if category is a leaf (no subcategories)
 */
export function isLeafCategory(categories, categoryId) {
  return !categories.some((c) => c.parentId === categoryId)
}

/**
 * Filter visible products (assigned to sales channels)
 */
export function getVisibleProducts(products) {
  return products.filter((p) => p.salesChannelIds && p.salesChannelIds.length > 0)
}

/**
 * Check if a category is visible (assigned to sales channels)
 * Categories without salesChannelIds are hidden from the storefront
 */
export function isVisibleCategory(category) {
  return category.salesChannelIds && category.salesChannelIds.length > 0
}

/**
 * Filter visible categories (assigned to sales channels)
 */
export function getVisibleCategories(categories) {
  return categories.filter(isVisibleCategory)
}

/**
 * Calculate category tree depth
 */
export function getTreeDepth(categories, categoryId, depth = 0) {
  const children = categories.filter((c) => c.parentId === categoryId)
  if (children.length === 0) return depth
  return Math.max(...children.map((c) => getTreeDepth(categories, c.id, depth + 1)))
}

/**
 * Build hierarchical category tree
 */
export function buildCategoryTree(categories, parentId = null) {
  return categories
    .filter((cat) => cat.parentId === parentId)
    .map((cat) => {
      const children = buildCategoryTree(categories, cat.id)
      return {
        id: cat.id,
        name: cat.name,
        slug: cat.metaData?.slug,
        url: constructCategoryUrl(cat.metaData?.slug),
        hasSubcategories: children.length > 0,
        children: children.length > 0 ? children : undefined,
      }
    })
}

/**
 * Print separator line
 */
export function separator(char = '=', length = 70) {
  console.log(char.repeat(length))
}

/**
 * Print header with separators
 */
export function printHeader(title) {
  separator()
  console.log(title)
  separator()
}
