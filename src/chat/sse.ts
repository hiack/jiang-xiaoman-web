/**
 * Dependency-free SSE decoder for the Dify Chat Messages streaming API.
 *
 * Accumulates text until a blank-line event boundary, reads only `data:`
 * lines, ignores empty and `[DONE]` payloads, and never emits malformed
 * JSON. No HTML or script evaluation ever happens here.
 */
export async function* parseSseStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, unknown>> {
  const decoder = new TextDecoder()
  const reader = stream.getReader()
  let buffer = ''

  // Parse one SSE event block: only `data:` lines are meaningful here.
  const parseEvent = (rawEvent: string): Record<string, unknown> | null => {
    const dataLines = rawEvent
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
    if (dataLines.length === 0) return null
    const payload = dataLines.join('\n')
    if (payload === '' || payload === '[DONE]') return null
    try {
      const parsed: unknown = JSON.parse(payload)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      // Malformed payload: skip it without breaking the surrounding stream.
    }
    return null
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      // Strip CR immediately so CRLF split across chunks cannot hide a boundary.
      buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '')
      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const event = parseEvent(buffer.slice(0, boundary))
        buffer = buffer.slice(boundary + 2)
        if (event) yield event
        boundary = buffer.indexOf('\n\n')
      }
    }
    // Flush whatever remains without a trailing blank line.
    const trailing = parseEvent(buffer)
    if (trailing) yield trailing
  } finally {
    reader.releaseLock()
  }
}
