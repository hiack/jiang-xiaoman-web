import { useState } from 'react'
import { ChatComposer } from './ChatComposer'
import { MessageBubble } from './MessageBubble'
import { siteContent } from '../config/content'
import { useChatSession } from '../hooks/useChatSession'
import { useNetworkStatus } from '../hooks/useNetworkStatus'

export interface ChatPanelProps {
  apiUrl?: string
}

/**
 * Branded conversation window. It talks only to the configured proxy URL and
 * never holds a Dify key. The original Dify page survives only as an
 * auxiliary fallback link.
 */
export function ChatPanel({ apiUrl }: ChatPanelProps = {}) {
  const isOnline = useNetworkStatus()
  const resolvedApiUrl = apiUrl ?? siteContent.chatApiUrl
  const isUnconfigured = resolvedApiUrl === ''
  const session = useChatSession(resolvedApiUrl)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const hasStreamingMessage = session.messages.some((message) => message.status === 'streaming')
  const showTyping = session.isSending && !hasStreamingMessage

  const confirmReset = () => {
    session.reset()
    setShowResetConfirm(false)
  }

  return (
    <section className="chat-panel" aria-label="江小满聊天区">
      <header className="chat-panel__header">
        <div className="chat-panel__identity">
          <img className="chat-panel__portrait" src={siteContent.portraitUrl} alt="" />
          <div>
            <strong>江小满</strong>
            <span className={isOnline ? 'is-online' : undefined}>
              <i aria-hidden="true" />
              正在满糖甜品店
            </span>
          </div>
        </div>
        <button
          type="button"
          className="chat-panel__restart"
          disabled={session.messages.length === 0 && !session.isSending}
          onClick={() => setShowResetConfirm(true)}
        >
          重新开始
        </button>
      </header>

      {showResetConfirm && (
        <div className="chat-panel__reset-confirm" role="alert">
          <p>确定要重新开始吗？只会清空本页显示的对话，不会影响已经发布的内容。</p>
          <div className="chat-panel__reset-actions">
            <button type="button" onClick={() => setShowResetConfirm(false)}>
              取消
            </button>
            <button type="button" onClick={confirmReset}>
              确定
            </button>
          </div>
        </div>
      )}

      <div className="chat-window">
        {isUnconfigured ? (
          <div className="chat-state" role="alert">
            <h2>对话服务尚未连接</h2>
            <p>江小满的对话代理还没有配置地址，等她准备好再来聊天吧。</p>
          </div>
        ) : !isOnline ? (
          <div className="chat-state" role="alert">
            <h2>现在没有网络连接</h2>
            <p>恢复联网后，可以和江小满继续聊天。</p>
          </div>
        ) : (
          <>
            {session.messages.length === 0 && session.error === '' ? (
              <p className="chat-window__welcome">和江小满说点什么吧，她会在满糖甜品店等你。</p>
            ) : null}

            <ol className="message-list" aria-live="polite">
              {session.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {showTyping ? (
                <li className="message-row message-row--assistant">
                  <img
                    className="message-avatar"
                    src={siteContent.portraitUrl}
                    alt="江小满"
                  />
                  <div className="message-bubble message-bubble--typing" aria-hidden="true">
                    <span className="typing-indicator">
                      <i />
                      <i />
                      <i />
                    </span>
                  </div>
                </li>
              ) : null}
            </ol>

            {session.error ? (
              <div className="chat-window__error" role="alert">
                <p>{session.error}</p>
                <button type="button" onClick={() => void session.retry()}>
                  重新发送
                </button>
              </div>
            ) : null}

            <ChatComposer
              draft={session.draft}
              isSending={session.isSending}
              onDraftChange={session.setDraft}
              onSend={() => void session.send()}
            />
          </>
        )}
      </div>

      <p className="chat-panel__disclosure">
        {siteContent.isAiDisclosure}
        {' · '}
        <a href={siteContent.chatFallbackUrl} target="_blank" rel="noreferrer">
          直接打开原对话
        </a>
      </p>
    </section>
  )
}
