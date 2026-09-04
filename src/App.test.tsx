import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the Jiang Xiaoman experience shell', () => {
    render(<App />)
    expect(screen.getByRole('main', { name: '江小满对话空间' })).toBeInTheDocument()
  })
})
