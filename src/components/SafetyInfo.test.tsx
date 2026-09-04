import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SafetyInfo } from './SafetyInfo'

describe('SafetyInfo', () => {
  it('states the AI, privacy and emergency boundaries', () => {
    render(<SafetyInfo />)
    expect(screen.getByText(/AI 角色/)).toBeInTheDocument()
    expect(screen.getByText(/不直接读取或保存聊天记录/)).toBeInTheDocument()
    expect(screen.getByText(/现实危险/)).toBeInTheDocument()
  })
})
