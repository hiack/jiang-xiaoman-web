import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendChatMessage } from '../chat/chatClient'
import { useChatSession } from './useChatSession'

vi.mock('../chat/chatClient', () => ({
  sendChatMessage: vi.fn(),
}))

const sendChatMessageMock = vi.mocked(sendChatMessage)

const USER_KEY = 'jiang-xiaoman-user-v1'
const CONVERSATION_KEY = 'jiang-xiaoman-conversation-v1'

async function flush() {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  window.localStorage.clear()
  sendChatMessageMock.mockReset()
})

afterEach(() => {
  window.localStorage.clear()
})

describe('useChatSession', () => {
  it('optimistically renders the user message and concatenates the assistant stream', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    sendChatMessageMock.mockImplementationOnce(async function* () {
      yield { event: 'delta', answer: '你' }
      await gate
      yield { event: 'delta', answer: '好' }
      yield { event: 'done', conversationId: 'conv-stream' }
    })

    const { result } = renderHook(() => useChatSession())

    let sending: Promise<void> | undefined
    act(() => {
      result.current.setDraft('最近好吗')
      sending = result.current.send()
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]).toMatchObject({ role: 'user', text: '最近好吗' })

    await flush()
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[1]).toMatchObject({
      role: 'assistant',
      text: '你',
      status: 'streaming',
    })
    expect(result.current.isSending).toBe(true)

    await act(async () => {
      release()
      await sending
    })

    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[1]).toMatchObject({
      role: 'assistant',
      text: '你好',
      status: 'complete',
    })
    expect(result.current.draft).toBe('')
    expect(result.current.isSending).toBe(false)
    expect(window.localStorage.getItem(CONVERSATION_KEY)).toBe('conv-stream')
  })

  it('locks sending while a request is streaming', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    sendChatMessageMock.mockImplementationOnce(async function* () {
      yield { event: 'delta', answer: '在' }
      await gate
      yield { event: 'done', conversationId: 'conv-lock' }
    })

    const { result } = renderHook(() => useChatSession())
    let first: Promise<void> | undefined
    act(() => {
      result.current.setDraft('一')
      first = result.current.send()
    })
    await flush()

    act(() => {
      result.current.setDraft('二')
      void result.current.send()
    })
    expect(sendChatMessageMock).toHaveBeenCalledTimes(1)
    expect(result.current.messages.filter((message) => message.role === 'user')).toHaveLength(1)

    await act(async () => {
      release()
      await first
    })
  })

  it('keeps the composer text when a send fails before any reply', async () => {
    sendChatMessageMock.mockImplementationOnce(async function* () {
      throw new Error('网络似乎断开了，请稍后再试。')
    })

    const { result } = renderHook(() => useChatSession())
    act(() => result.current.setDraft('你好呀'))
    await act(async () => {
      await result.current.send()
    })

    expect(result.current.messages).toHaveLength(0)
    expect(result.current.draft).toBe('你好呀')
    expect(result.current.error).toBe('网络似乎断开了，请稍后再试。')
    expect(result.current.isSending).toBe(false)
  })

  it('keeps partial assistant content and exposes retry when a stream errors midway', async () => {
    sendChatMessageMock.mockImplementationOnce(async function* () {
      yield { event: 'delta', answer: '前面半句' }
      yield { event: 'error', message: '回复中断了，请稍后再试。' }
    })

    const { result } = renderHook(() => useChatSession())
    act(() => result.current.setDraft('问一句'))
    await act(async () => {
      await result.current.send()
    })

    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[1]).toMatchObject({
      role: 'assistant',
      text: '前面半句',
      status: 'error',
    })
    expect(result.current.error).toBe('回复中断了，请稍后再试。')
    expect(result.current.isSending).toBe(false)
  })

  it('retry resends the last query after a failure', async () => {
    sendChatMessageMock
      .mockImplementationOnce(async function* () {
        throw new Error('断了')
      })
      .mockImplementationOnce(async function* () {
        yield { event: 'delta', answer: '在的' }
        yield { event: 'done', conversationId: 'conv-retry' }
      })

    const { result } = renderHook(() => useChatSession())
    act(() => result.current.setDraft('还在吗'))
    await act(async () => {
      await result.current.send()
    })
    expect(result.current.error).toBe('断了')

    await act(async () => {
      await result.current.retry()
    })
    expect(sendChatMessageMock).toHaveBeenCalledTimes(2)
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[1]).toMatchObject({
      role: 'assistant',
      text: '在的',
      status: 'complete',
    })
  })

  it('persists a stable anonymous user id and the conversation id', async () => {
    sendChatMessageMock.mockImplementation(async function* () {
      yield { event: 'done', conversationId: 'conv-user' }
    })

    const { result: first } = renderHook(() => useChatSession())
    act(() => first.current.setDraft('嗨'))
    await act(async () => {
      await first.current.send()
    })

    const storedUser = window.localStorage.getItem(USER_KEY)
    expect(storedUser).toBeTruthy()
    expect(sendChatMessageMock.mock.calls[0]?.[0].user).toBe(storedUser)

    const { result: second } = renderHook(() => useChatSession())
    act(() => second.current.setDraft('在吗'))
    await act(async () => {
      await second.current.send()
    })

    expect(sendChatMessageMock.mock.calls[1]?.[0].user).toBe(storedUser)
    expect(sendChatMessageMock.mock.calls[1]?.[0].conversationId).toBe('conv-user')
  })

  it('ignores whitespace-only messages', async () => {
    const { result } = renderHook(() => useChatSession())
    act(() => result.current.setDraft('   '))
    await act(async () => {
      await result.current.send()
    })
    expect(sendChatMessageMock).not.toHaveBeenCalled()
    expect(result.current.messages).toHaveLength(0)
  })

  it('reset clears the local session but keeps the anonymous user id', async () => {
    sendChatMessageMock.mockImplementation(async function* () {
      yield { event: 'delta', answer: '好' }
      yield { event: 'done', conversationId: 'conv-reset' }
    })

    const { result } = renderHook(() => useChatSession())
    act(() => result.current.setDraft('在吗'))
    await act(async () => {
      await result.current.send()
    })
    expect(result.current.messages).toHaveLength(2)

    act(() => result.current.reset())

    expect(result.current.messages).toEqual([])
    expect(result.current.draft).toBe('')
    expect(result.current.error).toBe('')
    expect(result.current.isSending).toBe(false)
    expect(window.localStorage.getItem(CONVERSATION_KEY)).toBeNull()
    expect(window.localStorage.getItem(USER_KEY)).toBeTruthy()
  })
})
