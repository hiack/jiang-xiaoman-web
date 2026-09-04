import { describe, expect, it } from 'vitest'
import {
  createDifyRequest,
  isAllowedOrigin,
  MAX_QUERY_LENGTH,
  publicError,
  validateBody,
} from './chat-core'

const FAKE_KEY = 'app-fake-key-abcdef0123456789-never-real'

const ALLOWED = [
  'https://hiack.github.io',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
]

describe('isAllowedOrigin', () => {
  it('matches allowed production and local origins exactly', () => {
    expect(isAllowedOrigin('https://hiack.github.io', ALLOWED)).toBe(true)
    expect(isAllowedOrigin('http://127.0.0.1:4173', ALLOWED)).toBe(true)
    expect(isAllowedOrigin('http://localhost:4173', ALLOWED)).toBe(true)
  })

  it('rejects unknown origins, prefixes, trailing slashes and missing headers', () => {
    expect(isAllowedOrigin('https://evil.example', ALLOWED)).toBe(false)
    expect(isAllowedOrigin('https://hiack.github.io.evil.example', ALLOWED)).toBe(false)
    expect(isAllowedOrigin('https://hiack.github.io/', ALLOWED)).toBe(false)
    expect(isAllowedOrigin('http://localhost:4173.evil.example', ALLOWED)).toBe(false)
    expect(isAllowedOrigin(undefined, ALLOWED)).toBe(false)
  })
})

describe('validateBody', () => {
  it('returns trimmed query, user and optional conversation id', () => {
    expect(validateBody({ query: '  你好呀  ', user: 'user-abc_1', conversation_id: 'conv-9' })).toEqual({
      query: '你好呀',
      user: 'user-abc_1',
      conversationId: 'conv-9',
    })
    expect(validateBody({ query: '在吗', user: 'u' })).toEqual({ query: '在吗', user: 'u' })
  })

  it('rejects non-object bodies and missing fields', () => {
    expect(() => validateBody(undefined)).toThrow()
    expect(() => validateBody(null)).toThrow()
    expect(() => validateBody('text')).toThrow()
    expect(() => validateBody([])).toThrow()
    expect(() => validateBody({ user: 'u' })).toThrow()
    expect(() => validateBody({ query: '', user: 'u' })).toThrow()
    expect(() => validateBody({ query: '   ', user: 'u' })).toThrow()
    expect(() => validateBody({ query: '嗨', user: 42 })).toThrow()
  })

  it('accepts a query at the length limit', () => {
    expect(validateBody({ query: '问'.repeat(MAX_QUERY_LENGTH), user: 'u' }).query.length).toBe(
      MAX_QUERY_LENGTH,
    )
  })

  it('rejects a query longer than the limit', () => {
    expect(() =>
      validateBody({ query: '问'.repeat(MAX_QUERY_LENGTH + 1), user: 'u' }),
    ).toThrow()
  })

  it('rejects invalid user and conversation identifiers', () => {
    expect(() => validateBody({ query: '嗨', user: '' })).toThrow()
    expect(() => validateBody({ query: '嗨', user: 'has space' })).toThrow()
    expect(() => validateBody({ query: '嗨', user: '有中文' })).toThrow()
    expect(() => validateBody({ query: '嗨', user: 'x'.repeat(65) })).toThrow()
    expect(() =>
      validateBody({ query: '嗨', user: 'u', conversation_id: 'bad id!' }),
    ).toThrow()
    expect(() =>
      validateBody({ query: '嗨', user: 'u', conversation_id: 'x'.repeat(65) }),
    ).toThrow()
  })
})

describe('createDifyRequest', () => {
  it('builds a streaming bearer request without exposing extra fields', () => {
    const request = createDifyRequest(
      { query: '你好', user: 'user-1', conversationId: 'conv-7' },
      FAKE_KEY,
    )
    expect(request.method).toBe('POST')
    const headers = request.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${FAKE_KEY}`)
    expect(headers['Content-Type']).toBe('application/json')
    const payload = JSON.parse(String(request.body))
    expect(payload).toEqual({
      inputs: {},
      response_mode: 'streaming',
      query: '你好',
      user: 'user-1',
      conversation_id: 'conv-7',
    })
  })

  it('omits conversation_id when no prior conversation exists', () => {
    const request = createDifyRequest({ query: '你好', user: 'user-1' }, FAKE_KEY)
    const payload = JSON.parse(String(request.body))
    expect(payload).not.toHaveProperty('conversation_id')
  })
})

describe('publicError', () => {
  it('maps auth and rate-limit failures to public copy', () => {
    expect(publicError(401)).toEqual({
      status: 401,
      message: '对话服务配置异常，请稍后再试。',
    })
    expect(publicError(403)).toEqual({
      status: 403,
      message: '对话服务配置异常，请稍后再试。',
    })
    expect(publicError(429)).toEqual({
      status: 429,
      message: '现在来找江小满的人有点多，请稍后再试。',
    })
    expect(publicError(502).status).toBe(502)
    expect(publicError(502).message).toContain('暂时没有回应')
  })

  it('never leaks the api key in serialized error responses', () => {
    for (const status of [400, 401, 403, 404, 429, 500, 502, 503]) {
      const serialized = JSON.stringify(publicError(status))
      expect(serialized).not.toContain(FAKE_KEY)
      expect(serialized).not.toMatch(/Bearer|sk-/)
    }
  })
})
