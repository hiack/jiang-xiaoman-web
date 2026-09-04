import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CharacterHero } from './CharacterHero'

describe('CharacterHero', () => {
  it('renders the approved character, scene and greeting', () => {
    render(<CharacterHero />)
    expect(screen.getByRole('img', { name: '江小满站在雨天的满糖甜品店门口' })).toHaveAttribute(
      'src',
      '/images/jiang-xiaoman-original.png',
    )
    expect(screen.getByText('雾城 · 傍晚五点半 · 小雨')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '“……你来了呀。”' })).toBeInTheDocument()
  })
})
