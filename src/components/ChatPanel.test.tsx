import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChatPanel } from './ChatPanel'

const fetchMock = vi.fn()

function sseResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

async function flush() {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  })
}

function typeAndSend(text: string) {
  const input = screen.getByLabelText('和江小满聊天')
  fireEvent.change(input, { target: { value: text } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
  window.localStorage.clear()
})

describe('ChatPanel', () => {
  it('replaces the Dify iframe with the approved two-avatar conversation', async () => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValueOnce(
      sseResponse('data: {"event":"message","answer":"我在呢。"}\n\ndata: {"event":"message_end","conversation_id":"conv-panel"}\n\n'),
    )
    render(<ChatPanel apiUrl="https://proxy.test" />)

    typeAndSend('你好')
    expect(await screen.findByText('我在呢。')).toBeInTheDocument()

    expect(screen.queryByTitle('与江小满对话')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: '江小满' })).toHaveAttribute(
      'src',
      expect.stringContaining('jiang-xiaoman-original.png'),
    )
    expect(screen.getByRole('img', { name: '你' })).toHaveAttribute(
      'src',
      expect.stringContaining('user-avatar-anonymous-short-hair.png'),
    )
    expect(screen.queryByText(/Token|耗时|点赞|Dify 测试替身/)).not.toBeInTheDocument()
  })

  it('disables the composer while streaming and re-enables it on completion', async () => {
    const encoder = new TextEncoder()
    let finishStream!: () => void
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"event":"message","answer":"正"}\n\n'))
        finishStream = () => {
          controller.enqueue(
            encoder.encode('data: {"event":"message","answer":"在"}\n\ndata: {"event":"message_end","conversation_id":"conv-live"}\n\n'),
          )
          controller.close()
        }
      },
    })
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValueOnce(
      new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    )
    render(<ChatPanel apiUrl="https://proxy.test" />)

    typeAndSend('在吗')
    await screen.findByText('正')
    const input = screen.getByLabelText('和江小满聊天')
    expect(screen.getByRole('button', { name: '发送' })).toBeDisabled()
    expect(input).toBeDisabled()

    act(() => finishStream())
    await flush()
    expect(await screen.findByText('正在')).toBeInTheDocument()
    expect(input).toBeEnabled()
    fireEvent.change(input, { target: { value: '再来' } })
    expect(screen.getByRole('button', { name: '发送' })).toBeEnabled()
  })

  it('asks for confirmation before resetting the local conversation', async () => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue(
      sseResponse('data: {"event":"message","answer":"好呀"}\n\ndata: {"event":"message_end","conversation_id":"conv-reset-panel"}\n\n'),
    )
    render(<ChatPanel apiUrl="https://proxy.test" />)

    typeAndSend('你好')
    expect(await screen.findByText('好呀')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '重新开始' }))
    expect(screen.getByText(/确定要重新开始吗/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '确定' }))
    expect(screen.queryByText('好呀')).not.toBeInTheDocument()
    const input = screen.getByLabelText('和江小满聊天')
    expect(input).toBeEnabled()
    fireEvent.change(input, { target: { value: '在吗' } })
    expect(screen.getByRole('button', { name: '发送' })).toBeEnabled()
  })

  it('keeps the draft and lets the user retry after a proxy failure', async () => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: '对话服务暂时没有回应，请稍后再试。' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        sseResponse('data: {"event":"message","answer":"好了"}\n\ndata: {"event":"message_end","conversation_id":"conv-retry-panel"}\n\n'),
      )
    render(<ChatPanel apiUrl="https://proxy.test" />)

    typeAndSend('再问一次')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('对话服务暂时没有回应')

    fireEvent.click(screen.getByRole('button', { name: '重新发送' }))
    expect(await screen.findByText('好了')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('renders model output as plain text without executing markup', async () => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValueOnce(
      sseResponse('data: {"event":"message","answer":"<script>alert(1)</script>"}\n\ndata: {"event":"message_end","conversation_id":"conv-safe"}\n\n'),
    )
    const { container } = render(<ChatPanel apiUrl="https://proxy.test" />)

    typeAndSend('测试')
    expect(await screen.findByText('<script>alert(1)</script>')).toBeInTheDocument()
    expect(container.querySelector('script')).toBeNull()
  })

  it('shows the unconfigured notice and the fallback link when no proxy URL exists', () => {
    render(<ChatPanel />)
    expect(screen.getByText('对话服务尚未连接')).toBeInTheDocument()
    expect(screen.queryByLabelText('和江小满聊天')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '直接打开原对话' })).toHaveAttribute(
      'href',
      'https://udify.app/chat/pNigFJHwFSH5pgcY',
    )
  })
})
