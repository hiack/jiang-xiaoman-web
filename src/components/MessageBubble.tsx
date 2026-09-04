import { siteContent } from '../config/content'
import type { ChatMessage } from '../hooks/useChatSession'

interface MessageBubbleProps {
  message: ChatMessage
}

/**
 * Renders one message row with its avatar. The body is always a plain React
 * text node so model/user output can never be executed as HTML.
 */
export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  return (
    <li className={`message-row message-row--${message.role}`}>
      <img
        className="message-avatar"
        src={isUser ? siteContent.userAvatarUrl : siteContent.portraitUrl}
        alt={isUser ? '你' : '江小满'}
      />
      <div className="message-bubble" data-status={message.status}>
        {message.text}
      </div>
    </li>
  )
}
