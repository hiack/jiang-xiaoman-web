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
