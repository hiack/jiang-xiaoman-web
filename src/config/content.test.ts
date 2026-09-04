import { describe, expect, it } from 'vitest'
import { siteContent } from './content'

describe('siteContent', () => {
  it('points to the approved anonymous user avatar asset', () => {
    expect(siteContent.userAvatarUrl).toContain('images/user-avatar-anonymous-short-hair.png')
  })

  it('keeps the original Dify app only as the auxiliary fallback link', () => {
    expect(siteContent.chatFallbackUrl).toBe('https://udify.app/chat/pNigFJHwFSH5pgcY')
  })

  it('reads the proxy URL from the environment and defaults to empty', () => {
    expect(typeof siteContent.chatApiUrl).toBe('string')
    expect(siteContent.chatApiUrl).toBe('')
  })

  it('keeps the approved brand and identity copy', () => {
    expect(siteContent.brand).toBe('满糖 · 江小满')
    expect(siteContent.isAiDisclosure).toContain('Dify')
  })

  it('does not contain secrets or local paths', () => {
    const serialized = JSON.stringify(siteContent)
    expect(serialized).not.toMatch(/api[_-]?key/i)
    expect(serialized).not.toContain('F:\\')
  })
})
