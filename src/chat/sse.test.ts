import { describe, expect, it } from 'vitest'
import { parseSseStream } from './sse'

function streamFrom(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

async function collect(chunks: string[]): Promise<Record<string, unknown>[]> {
  const events: Record<string, unknown>[] = []
  for await (const event of parseSseStream(streamFrom(chunks))) events.push(event)
  return events
}

describe('parseSseStream', () => {
  it('parses Dify data events split across chunk boundaries and skips ping', async () => {
    const events = await collect([
      'data: {"event":"message","answer":"你',
      '好"}\n\n',
      'event: ping\n\n',
      'data: {"event":"message_end","conversation_id":"conv-1"}\n\n',
    ])
    expect(events).toEqual([
      { event: 'message', answer: '你好' },
      { event: 'message_end', conversation_id: 'conv-1' },
    ])
  })

  it('separates events that arrive together in one chunk', async () => {
    const events = await collect([
      'data: {"event":"message","answer":"a"}\n\ndata: {"event":"message","answer":"b"}\n\n',
    ])
    expect(events).toEqual([
      { event: 'message', answer: 'a' },
      { event: 'message', answer: 'b' },
    ])
  })

  it('ignores empty payloads and the [DONE] sentinel', async () => {
    const events = await collect([
      'data: \n\n',
      'data: [DONE]\n\n',
      'data: {"event":"message","answer":"好的"}\n\n',
    ])
    expect(events).toEqual([{ event: 'message', answer: '好的' }])
  })

  it('isolates malformed JSON without emitting it', async () => {
    const events = await collect([
      'data: not-json\n\n',
      'data: {"event":"message","answer":"继续"}\n\n',
    ])
    expect(events).toEqual([{ event: 'message', answer: '继续' }])
  })

  it('flushes the final partial event at stream end', async () => {
    const events = await collect(['data: {"event":"message_end","conversation_id":"conv-2"}'])
    expect(events).toEqual([{ event: 'message_end', conversation_id: 'conv-2' }])
  })

  it('accepts CRLF line endings used by some servers', async () => {
    const events = await collect(['data: {"event":"message","answer":"嗯"}\r\n\r\n'])
    expect(events).toEqual([{ event: 'message', answer: '嗯' }])
  })
})
