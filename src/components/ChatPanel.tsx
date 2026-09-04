import { useEffect, useState } from 'react'
import { siteContent } from '../config/content'
import { useNetworkStatus } from '../hooks/useNetworkStatus'

type FrameStatus = 'loading' | 'ready' | 'timeout'

export function ChatPanel() {
  const isOnline = useNetworkStatus()
  const [status, setStatus] = useState<FrameStatus>('loading')
  const [frameKey, setFrameKey] = useState(0)

  useEffect(() => {
    if (!isOnline || status !== 'loading') return
    const timer = window.setTimeout(() => setStatus('timeout'), 12000)
    return () => window.clearTimeout(timer)
  }, [isOnline, status, frameKey])

  const retry = () => {
    setStatus('loading')
    setFrameKey((key) => key + 1)
  }

  return (
    <section className="chat-panel" aria-label="江小满聊天区">
      <header className="chat-panel__header">
        <div className="chat-panel__identity">
          <img src={siteContent.portraitUrl} alt="" />
          <div>
            <strong>江小满</strong>
            <span><i aria-hidden="true" />正在满糖甜品店</span>
          </div>
        </div>
        <a href={siteContent.chatUrl} target="_blank" rel="noreferrer">新窗口打开</a>
      </header>

      <div className="chat-panel__body">
        {!isOnline && (
          <div className="chat-state" role="alert">
            <h2>现在没有网络连接</h2>
            <p>恢复联网后，江小满的对话会重新加载。</p>
          </div>
        )}

        {isOnline && status === 'loading' && (
          <div className="chat-state" aria-live="polite">正在推开满糖的门…</div>
        )}

        {isOnline && status === 'timeout' && (
          <div className="chat-state" role="alert">
            <h2>江小满的对话暂时没有加载出来</h2>
            <p>可以重试，或者直接打开原始 Dify 对话。</p>
            <div className="chat-state__actions">
              <button type="button" onClick={retry}>重新加载</button>
              <a href={siteContent.chatUrl} target="_blank" rel="noreferrer">直接打开原对话</a>
            </div>
          </div>
        )}

        {isOnline && (
          <iframe
            key={frameKey}
            className={status === 'ready' ? 'chat-frame chat-frame--ready' : 'chat-frame'}
            src={siteContent.chatUrl}
            title="与江小满对话"
            onLoad={() => setStatus('ready')}
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
      </div>
      <p className="chat-panel__disclosure">{siteContent.isAiDisclosure}</p>
    </section>
  )
}
