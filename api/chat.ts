import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  createDifyRequest,
  isAllowedOrigin,
  publicError,
  validateBody,
  type ValidatedChatBody,
} from './chat-core'

const DIFY_ENDPOINT = 'https://api.dify.ai/v1/chat-messages'
const ALLOWED_ORIGINS = [
  'https://hiack.github.io',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
]
const PUBLIC_STREAM_ERROR = '对话服务暂时没有回应，请稍后再试。'

const ALLOWED_EVENT_NAMES = new Set(['message', 'agent_message', 'message_end', 'error'])

function originOf(req: VercelRequest): string | undefined {
  const value = req.headers.origin
  return typeof value === 'string' ? value : undefined
}

function setCorsHeaders(res: VercelResponse, origin: string) {
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

async function pipeAllowedEvents(body: ReadableStream<Uint8Array>, res: VercelResponse) {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
