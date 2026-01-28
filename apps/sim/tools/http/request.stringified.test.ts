import { beforeAll, describe, expect, it } from 'vitest'
import { requestTool } from '@/tools/http/request'
import type { RequestParams } from '@/tools/http/types'

beforeAll(() => {
  // Set required env var for tests
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
})

describe('HTTP Request Tool - Stringified Params Fix', () => {
  it('should handle stringified params from UI storage', () => {
    const stringifiedParams = JSON.stringify([
      { id: 'test-1', cells: { Key: 'id', Value: '311861947611' } },
      { id: 'test-2', cells: { Key: 'language', Value: 'tr' } },
    ])

    const stringifiedHeaders = JSON.stringify([
      { id: 'test-3', cells: { Key: 'Authorization', Value: 'Bearer token' } },
    ])

    const params = {
      url: 'https://api.example.com/tracking',
      method: 'GET' as const,
      params: stringifiedParams,
      headers: stringifiedHeaders,
    }

    // Test URL construction with stringified params
    const url = (requestTool.request.url as (params: RequestParams) => string)(params)
    expect(url).toBe('https://api.example.com/tracking?id=311861947611&language=tr')

    // Test headers construction with stringified headers
    const headers = (
      requestTool.request.headers as (params: RequestParams) => Record<string, string>
    )(params)
    expect(headers.Authorization).toBe('Bearer token')
  })

  it('should still handle normal array params', () => {
    const params = {
      url: 'https://api.example.com/tracking',
      method: 'GET' as const,
      params: [
        { id: 'test-1', cells: { Key: 'id', Value: '311861947611' } },
        { id: 'test-2', cells: { Key: 'language', Value: 'tr' } },
      ],
      headers: [{ id: 'test-3', cells: { Key: 'Authorization', Value: 'Bearer token' } }],
    }

    const url = (requestTool.request.url as (params: RequestParams) => string)(params)
    expect(url).toBe('https://api.example.com/tracking?id=311861947611&language=tr')

    const headers = (
      requestTool.request.headers as (params: RequestParams) => Record<string, string>
    )(params)
    expect(headers.Authorization).toBe('Bearer token')
  })

  it('should handle null and undefined params gracefully', () => {
    const params = {
      url: 'https://api.example.com/test',
      method: 'GET' as const,
    }

    const url = (requestTool.request.url as (params: RequestParams) => string)(params)
    expect(url).toBe('https://api.example.com/test')

    const headers = (
      requestTool.request.headers as (params: RequestParams) => Record<string, string>
    )(params)
    expect(headers).toBeDefined()
  })
})
