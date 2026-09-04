import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('combines the hero, chat and safety information', () => {
    render(<App />)
    expect(screen.getByRole('main', { name: '江小满对话空间' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '“……你来了呀。”' })).toBeInTheDocument()
    expect(screen.getByTitle('与江小满对话')).toBeInTheDocument()
    expect(screen.getByText('关于江小满与隐私')).toBeInTheDocument()
  })
})
