import { describe, expect, it } from 'vitest'
import { resolvePagesBase } from './vite.config'

describe('resolvePagesBase', () => {
  it('keeps local dev and preview at the site root', () => {
    expect(resolvePagesBase({})).toBe('/')
    expect(resolvePagesBase({ PAGES_BASE_PATH: '/jiang-xiaoman-web' })).toBe('/')
  })

  it('uses the root base for the custom apex domain Pages reports', () => {
    // actions/configure-pages emits base_path "" for tangzhaochu.com, so the
    // artifact must reference /assets/... (the live apex 404s on
    // /jiang-xiaoman-web/assets/...).
    expect(resolvePagesBase({ GITHUB_ACTIONS: 'true', PAGES_BASE_PATH: '' })).toBe('/')
    expect(resolvePagesBase({ GITHUB_ACTIONS: 'true', PAGES_BASE_PATH: '/' })).toBe('/')
  })

  it('keeps the original github.io project URL working', () => {
    expect(
      resolvePagesBase({ GITHUB_ACTIONS: 'true', PAGES_BASE_PATH: '/jiang-xiaoman-web' }),
    ).toBe('/jiang-xiaoman-web/')
    expect(resolvePagesBase({ GITHUB_ACTIONS: 'true' })).toBe('/jiang-xiaoman-web/')
  })
})
