import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatPanel } from './ChatPanel'

describe('ChatPanel', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('renders the exact Dify URL and accessible title', () => {
    render(<ChatPanel />)
    const frame = screen.getByTitle('与江小满对话')
    expect(frame).toHaveAttribute('src', 'https://udify.app/chat/pNigFJHwFSH5pgcY')
  })

  it('shows a fallback after the load timeout', () => {
    render(<ChatPanel />)
    act(() => vi.advanceTimersByTime(12000))
    expect(screen.getByRole('alert')).toHaveTextContent('暂时没有加载出来')
    expect(screen.getByRole('link', { name: '直接打开原对话' })).toHaveAttribute(
      'href',
      'https://udify.app/chat/pNigFJHwFSH5pgcY',
    )
  })

  it('hides the loading state when the iframe loads', () => {
    render(<ChatPanel />)
    fireEvent.load(screen.getByTitle('与江小满对话'))
    expect(screen.queryByText('正在推开满糖的门…')).not.toBeInTheDocument()
  })
})
