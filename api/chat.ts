/**
 * Vercel Node Function: secret-safe streaming proxy for the Dify chat app.
 *
 * PACKAGING RULE: this file must stay fully self-contained. Vercel's
 * zero-config Node builder compiles every `api/*.ts` file into its own
 * standalone lambda and does not bundle sibling TypeScript files into it.
 * With `"type": "module"` the emitted `/var/task/api/chat.js` runs as ESM,
 * where an extensionless relative import such as `./chat-core` cannot be
 * resolved (ERR_MODULE_NOT_FOUND) and crashes every request. Shared helpers
 * therefore live in this same file, and unit tests live in `api-tests/`
 * (never inside `api/`, where every `.ts` file would ship as a function).
 *
 * The handler validates origin/body, adds the server-side Dify bearer key
 * (`DIFY_API_KEY` lives only in Vercel's secret store), and streams only
 * allow-listed SSE fields. `@vercel/node` used to provide the request/
 * response types, but it was a type-only devDependency whose transitive
 * tree carried audit advisories, so the handler describes only the members
 * it reads and writes. The shape stays structurally assignable to a Vercel
 * `VercelApiHandler`.
 */
export interface ChatRequest {
  headers: { origin?: string | string[] | undefined }
  method?: string
  body: unknown
}

export interface ChatResponse {
  status(statusCode: number): ChatResponse
  json(body: unknown): ChatResponse
  setHeader(name: string, value: string | readonly string[]): void
  write(chunk: string): boolean
  flushHeaders(): void
  end(): void
}

// ---------------------------------------------------------------------------
// Validation and Dify request helpers (kept exported for `api-tests/`).
// ---------------------------------------------------------------------------

export const MAX_QUERY_LENGTH = 4000

export interface ValidatedChatBody {
  query: string
  user: string
  conversationId?: string
}

const ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/

export class ChatValidationError extends Error {
  constructor() {
    super('Invalid request body')
    this.name = 'ChatValidationError'
  }
}

/**
 * Exact allow-list matching for the Origin header. Requests without an
 * Origin (plain curl, server-to-server) are rejected on purpose.
 */
export function isAllowedOrigin(origin: string | undefined, allowed: string[]): boolean {
  if (!origin) return false
  return allowed.includes(origin)
}

/**
 * Validates and trims the client body. Only the fields the Dify API needs
 * are kept; anything else in the payload is discarded.
 */
export function validateBody(value: unknown): ValidatedChatBody {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ChatValidationError()
  }
  const record = value as Record<string, unknown>

  const query = record.query
  if (typeof query !== 'string') throw new ChatValidationError()
  const trimmedQuery = query.trim()
  if (trimmedQuery === '' || trimmedQuery.length > MAX_QUERY_LENGTH) {
    throw new ChatValidationError()
  }

  const user = record.user
  if (typeof user !== 'string' || !ID_PATTERN.test(user)) {
    throw new ChatValidationError()
  }

  const body: ValidatedChatBody = { query: trimmedQuery, user }

  const conversationId = record.conversation_id
  if (conversationId !== undefined && conversationId !== null) {
    if (typeof conversationId !== 'string' || !ID_PATTERN.test(conversationId)) {
      throw new ChatValidationError()
    }
    body.conversationId = conversationId
  }

  return body
}

/**
 * Builds the upstream Dify request. The api key only ever travels in the
 * Authorization header of this server-side request.
 */
export function createDifyRequest(body: ValidatedChatBody, apiKey: string): RequestInit {
  const payload: Record<string, unknown> = {
    inputs: {},
    response_mode: 'streaming',
    user: body.user,
    query: body.query,
  }
  if (body.conversationId) payload.conversation_id = body.conversationId

  return {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }
}

/**
 * Maps upstream status codes to short public copy. No error body, header or
 * key detail is ever forwarded.
 */
export function publicError(status: number): { status: number; message: string } {
  if (status === 401 || status === 403) {
    return { status, message: '对话服务配置异常，请稍后再试。' }
  }
  if (status === 429) {
    return { status, message: '现在来找江小满的人有点多，请稍后再试。' }
  }
  if (status === 404) {
    return { status, message: '对话服务地址无效，请稍后再试。' }
  }
  return { status, message: '对话服务暂时没有回应，请稍后再试。' }
}

// ---------------------------------------------------------------------------
// Proxy handler.
// ---------------------------------------------------------------------------

const DIFY_ENDPOINT = 'https://api.dify.ai/v1/chat-messages'
const ALLOWED_ORIGINS = [
  'https://hiack.github.io',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
]
const PUBLIC_STREAM_ERROR = '对话服务暂时没有回应，请稍后再试。'

const ALLOWED_EVENT_NAMES = new Set(['message', 'agent_message', 'message_end', 'error'])

function originOf(req: ChatRequest): string | undefined {
  const value = req.headers.origin
  return typeof value === 'string' ? value : undefined
}

function setCorsHeaders(res: ChatResponse, origin: string) {
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Vary', 'Origin')
}

/**
 * Rebuilds one SSE event from its raw text, keeping only the fields the
 * frontend needs. Token usage, prices and workflow internals never cross the
 * proxy, and upstream error text is replaced with fixed public copy.
 */
function normalizeEvent(rawEvent: string): string | null {
  const dataLines = rawEvent
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
  if (dataLines.length === 0) return null
  const payload = dataLines.join('\n')
  if (payload === '' || payload === '[DONE]') return null

  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

  const record = parsed as Record<string, unknown>
  const eventName = typeof record.event === 'string' ? record.event : ''
  if (!ALLOWED_EVENT_NAMES.has(eventName)) return null

  if (eventName === 'error') {
    return `data: ${JSON.stringify({ event: 'error', message: PUBLIC_STREAM_ERROR })}`
  }
  if (eventName === 'message' || eventName === 'agent_message') {
    const answer = typeof record.answer === 'string' ? record.answer : ''
    return `data: ${JSON.stringify({ event: eventName, answer })}`
  }
  // message_end: keep only the conversation id for continuation.
  const conversationId = typeof record.conversation_id === 'string' ? record.conversation_id : ''
  return `data: ${JSON.stringify({ event: 'message_end', conversation_id: conversationId })}`
}

async function pipeAllowedEvents(body: ReadableStream<Uint8Array>, res: ChatResponse) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '')
      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const rawEvent = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const forwarded = normalizeEvent(rawEvent)
        if (forwarded !== null) res.write(`${forwarded}\n\n`)
        boundary = buffer.indexOf('\n\n')
      }
    }
    const trailing = normalizeEvent(buffer)
    if (trailing !== null) res.write(`${trailing}\n\n`)
  } catch {
    // Client disconnected mid-stream: stop forwarding quietly.
  } finally {
    reader.releaseLock()
  }
}

export default async function handler(req: ChatRequest, res: ChatResponse) {
  const origin = originOf(req)
  if (!isAllowedOrigin(origin, ALLOWED_ORIGINS)) {
    res.status(403).json({ message: '来源不受支持。' })
    return
  }
  setCorsHeaders(res, origin as string)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' })
    return
  }
  if (!process.env.DIFY_API_KEY) {
    res.status(503).json({ message: '对话服务尚未完成配置。' })
    return
  }

  let body: ValidatedChatBody
  try {
    body = validateBody(req.body)
  } catch {
    res.status(400).json({ message: '请求内容无效。' })
    return
  }

  let upstream: Response
  try {
    upstream = await fetch(DIFY_ENDPOINT, createDifyRequest(body, process.env.DIFY_API_KEY))
  } catch {
    res.status(502).json(publicError(502))
    return
  }

  if (!upstream.ok) {
    const safe = publicError(upstream.status)
    res.status(safe.status).json(safe)
    return
  }
  if (!upstream.body) {
    res.status(502).json(publicError(502))
    return
  }

  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  await pipeAllowedEvents(upstream.body, res)
  res.end()
}
