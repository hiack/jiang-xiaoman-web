import { useEffect, useRef, useState } from 'react'
import { sendChatMessage } from '../chat/chatClient'
import { siteContent } from '../config/content'

const USER_KEY = 'jiang-xiaoman-user-v1'
const CONVERSATION_KEY = 'jiang-xiaoman-conversation-v1'

export interface ChatMessage {
  id: string
  role: 'assistant' | 'user'
  text: string
  status: 'complete' | 'streaming' | 'error'
}

export interface ChatSession {
  messages: ChatMessage[]
  draft: string
  isSending: boolean
  error: string
  setDraft(value: string): void
  send(): Promise<void>
  retry(): Promise<void>
  reset(): void
}

function createId(): string {
  const globalObject = globalThis as { crypto?: { randomUUID?: () => string } }
  if (globalObject.crypto?.randomUUID) return globalObject.crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Private mode or quota: session still works without persistence.
  }
}

function removeStored(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Ignore storage failures.
  }
}

/**
 * Owns the message list, the anonymous user id and the Dify conversation id.
 * Nothing is ever sent to Dify directly and no API key lives here. Message
 * contents are kept only in memory; localStorage holds just the identifiers.
 */
export function useChatSession(): ChatSession {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraftState] = useState('')
  const [isSending, setIsSendingState] = useState(false)
  const [error, setError] = useState('')

  const draftRef = useRef('')
  const sendingRef = useRef(false)
  const lastQueryRef = useRef('')
  const abortRef = useRef<AbortController | null>(null)
  const conversationIdRef = useRef<string | null>(readStored(CONVERSATION_KEY))
  const userIdRef = useRef<string>('')
  if (userIdRef.current === '') {
    const existing = readStored(USER_KEY)
    const userId = existing ?? createId()
    if (!existing) writeStored(USER_KEY, userId)
    userIdRef.current = userId
  }

  const setDraft = (value: string) => {
    draftRef.current = value
    setDraftState(value)
  }

  const setSending = (value: boolean) => {
    sendingRef.current = value
    setIsSendingState(value)
  }

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const runQuery = async (query: string): Promise<void> => {
    if (sendingRef.current) return
    const text = query.trim()
    if (!text) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    lastQueryRef.current = text
    draftRef.current = ''
    setDraftState('')
    setError('')
    setSending(true)

    const userMessageId = createId()
    setMessages((current) => [
      ...current,
      { id: userMessageId, role: 'user', text, status: 'complete' },
    ])

    let assistantId: string | null = null
    let assistantText = ''
    try {
      for await (const event of sendChatMessage({
        apiUrl: siteContent.chatApiUrl,
        query: text,
        user: userIdRef.current,
        conversationId: conversationIdRef.current ?? undefined,
        signal: controller.signal,
      })) {
        if (event.event === 'delta') {
          assistantText += event.answer
          if (assistantId === null) {
            assistantId = createId()
            setMessages((current) => [
              ...current,
              {
                id: assistantId as string,
                role: 'assistant',
                text: assistantText,
                status: 'streaming',
              },
            ])
          } else {
            const id = assistantId
            setMessages((current) =>
              current.map((message) =>
                message.id === id ? { ...message, text: assistantText } : message,
              ),
            )
          }
        } else if (event.event === 'done') {
          if (event.conversationId) {
            conversationIdRef.current = event.conversationId
            writeStored(CONVERSATION_KEY, event.conversationId)
          }
          if (assistantId !== null) {
            const id = assistantId
            setMessages((current) =>
              current.map((message) =>
                message.id === id ? { ...message, status: 'complete' } : message,
              ),
            )
          }
          return
        } else if (event.event === 'error') {
          throw new Error(event.message)
        }
      }
      // Stream ended without an explicit done event.
      if (assistantId !== null) {
        const id = assistantId
        setMessages((current) =>
          current.map((message) =>
            message.id === id ? { ...message, status: 'complete' } : message,
          ),
        )
      }
    } catch (caught) {
      const err = caught as Error
      if (err && err.name === 'AbortError') return
      if (assistantId === null) {
        // Nothing streamed back yet: undo the optimistic bubble and keep the text.
        setMessages((current) => current.filter((message) => message.id !== userMessageId))
        draftRef.current = text
        setDraftState(text)
        setError(err && err.message ? err.message : '对话服务暂时没有回应，请稍后再试。')
      } else {
        const id = assistantId
        setMessages((current) =>
          current.map((message) =>
            message.id === id ? { ...message, text: assistantText, status: 'error' } : message,
          ),
        )
        setError(err && err.message ? err.message : '回复中断了，可以重新发送。')
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setSending(false)
      }
    }
  }

  const send = (): Promise<void> => runQuery(draftRef.current)

  const retry = (): Promise<void> => runQuery(lastQueryRef.current)

  const reset = () => {
    abortRef.current?.abort()
    abortRef.current = null
    conversationIdRef.current = null
    removeStored(CONVERSATION_KEY)
    lastQueryRef.current = ''
    draftRef.current = ''
    setDraftState('')
    setError('')
    setSending(false)
    setMessages([])
  }

  return { messages, draft, isSending, error, setDraft, send, retry, reset }
}
