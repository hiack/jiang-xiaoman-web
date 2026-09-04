import { describe, expect, it } from 'vitest'
import { siteContent } from './content'

describe('siteContent', () => {
  it('uses the approved Dify app and fixed identity copy', () => {
    expect(siteContent.chatUrl).toBe('https://udify.app/chat/pNigFJHwFSH5pgcY')
    expect(siteContent.brand).toBe('满糖 · 江小满')
    expect(siteContent.isAiDisclosure).toContain('Dify')
  })

  it('does not contain secrets or local paths', () => {
    const serialized = JSON.stringify(siteContent)
    expect(serialized).not.toMatch(/api[_-]?key/i)
    expect(serialized).not.toContain('F:\\')
  })
})
