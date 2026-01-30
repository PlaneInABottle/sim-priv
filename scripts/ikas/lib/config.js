/**
 * IKAS API Configuration
 * Shared constants for all IKAS tests
 */

export const IKAS_CONFIG = {
  // OAuth endpoints
  OAUTH_URL: 'https://kamatas.myikas.com/api/admin/oauth/token',
  GRAPHQL_URL: 'https://api.myikas.com/api/v1/admin/graphql',

  // Client credentials
  CLIENT_ID: '31adc972-1033-41bb-b23b-96b45238d6a2',
  CLIENT_SECRET: 's_5SFl7zDxObKLdJXjiKyccVev5fb666ee32be43558a8d7d9ad9484110',

  // Storefront URLs
  STOREFRONT_BASE: 'https://kamatas.com',
  PRODUCT_PATH_PREFIX: '/urun/',
  CATEGORY_PATH_PREFIX: '/',

  // API limits
  PRODUCTS_LIMIT: 30,
  REQUEST_TIMEOUT: 15000,
  MAX_DEPTH: 50,
  MAX_RETRIES: 1,
}

// Upstash Redis configuration (for token caching)
export const UPSTASH_CONFIG = {
  URL: 'https://legible-marmoset-35404.upstash.io',
  TOKEN: 'AYpMAAIncDFkNGU4NmRjNDYyNjA0OWE3YTJhZDhhMzNiMjdhZDI2ZXAxMzU0MDQ',
  TOKEN_CACHE_KEY: `ikas:token:${IKAS_CONFIG.CLIENT_ID}`,
  TOKEN_LOCK_KEY: `ikas:token:lock:${IKAS_CONFIG.CLIENT_ID}`,
  DEFAULT_TOKEN_TTL: 12600,
  LOCK_TTL: 10,
}

// Known category IDs for testing
export const TEST_CATEGORIES = {
  KOSEBENTLER: 'd83722a1-4e65-414f-83ed-74dcbc52e663',
  KOSEBENTLER_25X25: 'b89f80d8-93bc-431f-b2be-12b4bf9f195d',
  AKORDIYON_SINEKLIKLER: '518e27f0-4ad2-40bb-bce9-c8f1c7d80e1e',
  PILELI_PENCERE: 'aa30d082-5cd4-4860-bc3c-646a9da60fc5',
}

// Empty categories that should be filtered out
export const EMPTY_CATEGORIES = [
  'Double Kasalı Akordiyon Sineklikleri (Max 280x200)',
  '40x40 Köşebentler',
  '50x50 Köşebentler',
  'İçten Takma Akordiyon Pencere Sineklikleri',
  'Nobel Pencere Akordiyon Sineklikleri',
  'Nobel Kapı Akordiyon Sineklikleri',
  'Menteşeli sineklklerrr',
]
