import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AllowedStreamEvent } from './types'
import { ChatConfigError, sendChatMessage, type SendChatInput } from './chatClient'

const fetchMock = vi.fn()

function sseResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

async function consume(input: SendChatInput): Promise<AllowedStreamEvent[]> {
  const events: AllowedStreamEvent[] = []
  for await (const event of sendChatMessage(input)) events.push(event)
  return events
}

describe('sendChatMessage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('posts JSON to the proxy endpoint and maps message events to deltas', async () => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValueOnce(
      sseResponse('data: {"event":"message","answer":"你好"}\n\ndata: {"event":"message_end","conversation_id":"conv-1"}\n\n'),
    )
    const events = await consume({ apiUrl: 'https://proxy.example.com', query: '你好', user: 'user-1' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://proxy.example.com/api/chat')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ query: '你好', user: 'user-1' })
    expect(events).toEqual([
      { event: 'delta', answer: '你好' },
      { event: 'done', conversationId: 'conv-1' },
    ])
  })

  it('normalizes a trailing slash and sends agent_message as delta with conversation_id', async () => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValueOnce(
      sseResponse('data: {"event":"agent_message","answer":"我在呢"}\n\ndata: {"event":"message_end","conversation_id":"conv-2"}\n\n'),
    )
    const events = await consume({
      apiUrl: 'https://proxy.example.com/',
      query: 'hi',
      user: 'user-2',
      conversationId: 'conv-1',
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://proxy.example.com/api/chat')
    expect(JSON.parse(String(init.body))).toEqual({
      query: 'hi',
      user: 'user-2',
      conversation_id: 'conv-1',
    })
    expect(events).toEqual([
      { event: 'delta', answer: '我在呢' },
      { event: 'done', conversationId: 'conv-2' },
    ])
  })

  it('throws a typed configuration error for an empty proxy URL', async () => {
    const iterator = sendChatMessage({ apiUrl: '', query: 'hi', user: 'u' })
    await expect(iterator.next()).rejects.toBeInstanceOf(ChatConfigError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps non-OK proxy responses to the safe public error message', async () => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: '现在来找江小满的人有点多，请稍后再试。' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const events = await consume({ apiUrl: 'https://proxy.example.com', query: 'hi', user: 'u' })
    expect(events).toEqual([{ event: 'error', message: '现在来找江小满的人有点多，请稍后再试。' }])
  })

  it('never forwards upstream error details to the UI', async () => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValueOnce(
      sseResponse('data: {"event":"error","message":"workflow internal failure #42","status":500}\n\n'),
    )
    const events = await consume({ apiUrl: 'https://proxy.example.com', query: 'hi', user: 'u' })
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('error')
    if (events[0].event === 'error') {
      expect(events[0].message).not.toContain('internal')
      expect(events[0].message).not.toContain('#42')
    }
  })

  it('maps bodyless 5xx responses to a generic retry hint', async () => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValueOnce(new Response('boom', { status: 502 }))
    const events = await consume({ apiUrl: 'https://proxy.example.com', query: 'hi', user: 'u' })
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('error')
    if (events[0].event === 'error') {
      expect(events[0].message.length).toBeGreaterThan(0)
    }
  })

  it('ignores token, workflow and ping events from the upstream stream', async () => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValueOnce(
      sseResponse([
        'data: {"event":"ping"}\n\n',
        'data: {"event":"node_finished","node_id":"x","outputs":{"answer":"ignored"}}\n\n',
        'data: {"event":"message","answer":"只有这句可见"}\n\n',
        'data: {"event":"message_end","conversation_id":"conv-3","usage":{"tokens":99}}\n\n',
      ].join('')),
    )
    const events = await consume({ apiUrl: 'https://proxy.example.com', query: 'hi', user: 'u' })
    expect(events).toEqual([
      { event: 'delta', answer: '只有这句可见' },
      { event: 'done', conversationId: 'conv-3' },
    ])
  })
})
