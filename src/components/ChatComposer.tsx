import type { KeyboardEvent } from 'react'
import { siteContent } from '../config/content'

export interface ChatComposerProps {
  draft: string
  isSending: boolean
  onDraftChange(value: string): void
  onSend(): void
}

/**
 * Input + send control. Enter sends, Shift+Enter inserts a newline, and
 * whitespace-only or in-flight messages cannot be sent.
 */
export function ChatComposer({ draft, isSending, onDraftChange, onSend }: ChatComposerProps) {
  const canSend = draft.trim().length > 0 && !isSending

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      if (canSend) onSend()
    }
  }

  return (
    <div className="chat-composer">
      <textarea
        aria-label="和江小满聊天"
        rows={2}
        placeholder={siteContent.inputHint}
        value={draft}
        disabled={isSending}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        className="chat-composer__send"
        disabled={!canSend}
        onClick={onSend}
      >
        发送
      </button>
    </div>
  )
}
