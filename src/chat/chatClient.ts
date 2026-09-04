import type { AllowedStreamEvent } from './types'
import { parseSseStream } from './sse'

export interface SendChatInput {
  apiUrl: string
  query: string
  user: string
  conversationId?: string
  signal?: AbortSignal
}

const GENERIC_ERROR_MESSAGE = '对话服务暂时没有回应，请稍后再试。'
const BUSY_ERROR_MESSAGE = '现在来找江小满的人有点多，请稍后再试。'
const CONFIG_ERROR_MESSAGE = '对话服务配置异常，请稍后再试。'

export class ChatConfigError extends Error {
  constructor(message = '对话服务尚未连接。') {
    super(message)
    this.name = 'ChatConfigError'
  }
}

export class ChatRequestError extends Error {
  constructor(message = '网络似乎断开了，请稍后再试。') {
    super(message)
    this.name = 'ChatRequestError'
  }
}

function messageFromBody(value: unknown): string {
  if (value && typeof value === 'object' && 'message' in value) {
    const candidate = (value as { message?: unknown }).message
    if (typeof candidate === 'string' && candidate.length > 0) return candidate
  }
  return ''
}

/**
 * Sends one user turn to the configurable proxy endpoint and normalizes the
 * Dify stream into the small set of events the UI is allowed to see. Token
 * usage, prices and internal workflow events never leave this function.
 */
export async function* sendChatMessage(
  input: SendChatInput,
): AsyncGenerator<AllowedStreamEvent> {
  const apiUrl = input.apiUrl.trim().replace(/\/+$/, '')
  if (!apiUrl) throw new ChatConfigError()

  let response: Response
  try {
    response = await fetch(`${apiUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        query: input.query,
        user: input.user,
        ...(input.conversationId ? { conversation_id: input.conversationId } : {}),
      }),
      signal: input.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new ChatRequestError()
  }

  if (!response.ok) {
    let message = ''
    try {
      message = messageFromBody(await response.json())
    } catch {
      // Non-JSON error body: fall through to a status-based public message.
    }
    if (!message) {
      if (response.status === 401 || response.status === 403) message = CONFIG_ERROR_MESSAGE
      else if (response.status === 429) message = BUSY_ERROR_MESSAGE
      else message = GENERIC_ERROR_MESSAGE
    }
    yield { event: 'error', message }
    return
  }

  if (!response.body) {
    yield { event: 'error', message: GENERIC_ERROR_MESSAGE }
    return
  }

  for await (const raw of parseSseStream(response.body)) {
    const eventName = typeof raw.event === 'string' ? raw.event : ''
    if (eventName === 'message' || eventName === 'agent_message') {
      const answer = typeof raw.answer === 'string' ? raw.answer : ''
      if (answer.length > 0) yield { event: 'delta', answer }
    } else if (eventName === 'message_end') {
      const conversationId = typeof raw.conversation_id === 'string' ? raw.conversation_id : ''
      yield { event: 'done', conversationId }
    } else if (eventName === 'error') {
      // Upstream error payloads may contain workflow internals: never pass them on.
      yield { event: 'error', message: GENERIC_ERROR_MESSAGE }
    }
    // ping / node_finished / workflow events are intentionally dropped.
  }
}
