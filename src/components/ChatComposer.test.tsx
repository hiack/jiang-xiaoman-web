import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChatComposer, type ChatComposerProps } from './ChatComposer'

function renderComposer(overrides: Partial<ChatComposerProps> = {}) {
  const props: ChatComposerProps = {
    draft: '',
    isSending: false,
    onDraftChange: vi.fn(),
    onSend: vi.fn(),
    ...overrides,
  }
  const view = render(
    <ChatComposer
      draft={props.draft}
      isSending={props.isSending}
      onDraftChange={props.onDraftChange}
      onSend={props.onSend}
    />,
  )
  return { ...view, props }
}

describe('ChatComposer', () => {
  it('sends on Enter and keeps Shift+Enter as a newline', () => {
    const { props } = renderComposer({ draft: '你好' })
    const input = screen.getByLabelText('和江小满聊天')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(props.onSend).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(props.onSend).toHaveBeenCalledTimes(1)
  })

  it('blocks whitespace-only messages', () => {
    const { props } = renderComposer({ draft: '   ' })
    const input = screen.getByLabelText('和江小满聊天')
    expect(screen.getByRole('button', { name: '发送' })).toBeDisabled()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(props.onSend).not.toHaveBeenCalled()
  })

  it('disables the input and the send button while a reply is streaming', () => {
    const { props } = renderComposer({ draft: '在吗', isSending: true })
    const input = screen.getByLabelText('和江小满聊天')
    expect(input).toBeDisabled()
    expect(screen.getByRole('button', { name: '发送' })).toBeDisabled()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(props.onSend).not.toHaveBeenCalled()
  })

  it('reports typing changes and enables send only for real content', () => {
    const { props } = renderComposer()
    const input = screen.getByLabelText('和江小满聊天')
    expect(screen.getByRole('button', { name: '发送' })).toBeDisabled()
    fireEvent.change(input, { target: { value: '嗨' } })
    expect(props.onDraftChange).toHaveBeenCalledWith('嗨')
  })
})
