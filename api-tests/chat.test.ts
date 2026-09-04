import { afterEach, describe, expect, it, vi } from 'vitest'
import handler, {
  createDifyRequest,
  isAllowedOrigin,
  MAX_QUERY_LENGTH,
  publicError,
  validateBody,
  type ChatRequest,
  type ChatResponse,
} from '../api/chat'

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

// ---------------------------------------------------------------------------
// Handler regression tests. The deployed function crashed with
// ERR_MODULE_NOT_FOUND on every request when api/chat.ts imported a sibling
// './chat-core' module (Vercel compiles each api/*.ts into its own ESM
// lambda, where extensionless relative imports cannot resolve). These tests
// pin the module-load surface and the request routing of the self-contained
// handler so that regression would surface here first.
// ---------------------------------------------------------------------------

const ALLOWED_ORIGIN = 'https://hiack.github.io'

interface ResponseDouble {
  statusCode: number
  body: unknown
  headers: Record<string, string | readonly string[]>
  written: string[]
  ended: boolean
  status(statusCode: number): this
  json(payload: unknown): void
  setHeader(name: string, value: string | readonly string[]): void
  write(chunk: string): boolean
  flushHeaders(): void
  end(): void
}

function makeResponse(): ResponseDouble {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    written: [],
    ended: false,
    status(statusCode) {
      this.statusCode = statusCode
      return this
    },
    json(payload: unknown) {
      this.body = payload
    },
    setHeader(name, value) {
      this.headers[name] = value
    },
    write(chunk) {
      this.written.push(chunk)
      return true
    },
    flushHeaders() {
      // No-op: the double records headers on setHeader.
    },
    end() {
      this.ended = true
    },
  }
}

function makeRequest(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    headers: { origin: ALLOWED_ORIGIN },
    method: 'POST',
    body: { query: '你好', user: 'user-abc_1' },
    ...overrides,
  }
}

function asHandlerResponse(double: ResponseDouble): ChatResponse {
  return double as unknown as ChatResponse
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.DIFY_API_KEY
})

describe('handler routing', () => {
  it('rejects requests without an allowed Origin header', async () => {
    const res = makeResponse()
    const req = makeRequest({ headers: { origin: 'https://evil.example' } })
    await handler(req, asHandlerResponse(res))
    expect(res.statusCode).toBe(403)
    expect(res.body).toEqual({ message: '来源不受支持。' })
    expect(res.ended).toBe(false)
  })

  it('answers OPTIONS preflight from an allowed origin with 204 and CORS headers', async () => {
    const res = makeResponse()
    await handler(makeRequest({ method: 'OPTIONS' }), asHandlerResponse(res))
    expect(res.statusCode).toBe(204)
    expect(res.headers['Access-Control-Allow-Origin']).toBe(ALLOWED_ORIGIN)
    expect(res.ended).toBe(true)
  })

  it('rejects non-POST methods with 405', async () => {
    const res = makeResponse()
    await handler(makeRequest({ method: 'GET' }), asHandlerResponse(res))
    expect(res.statusCode).toBe(405)
    expect(res.body).toEqual({ message: 'Method not allowed' })
  })

  it('returns 503 when the DIFY_API_KEY secret is not configured', async () => {
    const res = makeResponse()
    await handler(makeRequest(), asHandlerResponse(res))
    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({ message: '对话服务尚未完成配置。' })
  })

  it('returns 400 for an invalid body before any upstream call', async () => {
    process.env.DIFY_API_KEY = FAKE_KEY
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const res = makeResponse()
    await handler(
      makeRequest({ body: { query: '', user: 'user-abc_1' } }),
      asHandlerResponse(res),
    )
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: '请求内容无效。' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('maps upstream auth failures to public copy without leaking details', async () => {
    process.env.DIFY_API_KEY = FAKE_KEY
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"message":"unauthorized"}', { status: 401 })),
    )
    const res = makeResponse()
    await handler(makeRequest(), asHandlerResponse(res))
    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({
      status: 401,
      message: '对话服务配置异常，请稍后再试。',
    })
    expect(JSON.stringify(res.body)).not.toContain('unauthorized')
    expect(JSON.stringify(res.body)).not.toContain(FAKE_KEY)
  })

  it('streams only normalized SSE chunks on a successful upstream response', async () => {
    process.env.DIFY_API_KEY = FAKE_KEY
    const sse = [
      'event: agent_message',
      'data: {"event":"agent_message","answer":"你好呀","task_id":"t-1","message_id":"m-1"}',
      '',
      '',
      'event: message_end',
      'data: {"event":"message_end","conversation_id":"conv-9","task_id":"t-1"}',
      '',
      '',
    ].join('\n')
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sse))
        controller.close()
      },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(stream, { status: 200 })),
    )
    const res = makeResponse()
    await handler(makeRequest(), asHandlerResponse(res))
    expect(res.statusCode).toBe(200)
    expect(res.headers['Content-Type']).toBe('text/event-stream; charset=utf-8')
    expect(res.headers['Cache-Control']).toBe('no-store')
    expect(res.ended).toBe(true)
    const forwarded = res.written.join('')
    expect(forwarded).toContain('{"event":"agent_message","answer":"你好呀"}')
    expect(forwarded).toContain('{"event":"message_end","conversation_id":"conv-9"}')
    expect(forwarded).not.toContain('task_id')
    expect(forwarded).not.toContain('message_id')
    expect(forwarded).not.toContain(FAKE_KEY)
  })
})
