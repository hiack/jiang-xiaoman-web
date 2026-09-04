import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '../hooks/useChatSession'
import { MessageBubble } from './MessageBubble'

const assistantMessage: ChatMessage = {
  id: 'a1',
  role: 'assistant',
  text: '我在满糖甜品店等你。',
  status: 'complete',
}

const userMessage: ChatMessage = {
  id: 'u1',
  role: 'user',
  text: '今天下雨了。',
  status: 'complete',
}

describe('MessageBubble', () => {
  it('renders 江小满 with the approved portrait avatar on the assistant row', () => {
    render(<MessageBubble message={assistantMessage} />)
    expect(screen.getByRole('img', { name: '江小满' })).toHaveAttribute(
      'src',
      expect.stringContaining('jiang-xiaoman-original.png'),
    )
    expect(screen.getByText('我在满糖甜品店等你。')).toBeInTheDocument()
    expect(screen.getByText('我在满糖甜品店等你。').closest('li')).toHaveClass(
      'message-row--assistant',
    )
  })

  it('renders the anonymous short-haired user with the approved avatar', () => {
    render(<MessageBubble message={userMessage} />)
    expect(screen.getByRole('img', { name: '你' })).toHaveAttribute(
      'src',
      expect.stringContaining('user-avatar-anonymous-short-hair.png'),
    )
    expect(screen.getByRole('img', { name: '你' })).toHaveAttribute('alt', '你')
    expect(screen.getByText('今天下雨了。').closest('li')).toHaveClass('message-row--user')
  })

  it('renders message text as plain text and never as executable markup', () => {
    const harmful = '<script>alert(1)</script><img src=x onerror=alert(2)>'
    const { container } = render(
      <MessageBubble
        message={{ id: 'a2', role: 'assistant', text: harmful, status: 'complete' }}
      />,
    )
    expect(screen.getByText(harmful)).toBeInTheDocument()
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img[onerror]')).toBeNull()
  })
})
