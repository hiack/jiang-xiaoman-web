import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('combines the hero, custom chat and safety information', () => {
    render(<App />)
    expect(screen.getByRole('main', { name: '江小满对话空间' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '“……你来了呀。”' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '江小满聊天区' })).toBeInTheDocument()
    expect(screen.getByText('对话服务尚未连接')).toBeInTheDocument()
    expect(screen.getByText('关于江小满与隐私')).toBeInTheDocument()
  })
})
