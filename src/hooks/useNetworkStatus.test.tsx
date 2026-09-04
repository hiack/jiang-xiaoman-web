import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useNetworkStatus } from './useNetworkStatus'

describe('useNetworkStatus', () => {
  it('reacts to browser offline and online events', () => {
    const { result } = renderHook(() => useNetworkStatus())
    act(() => window.dispatchEvent(new Event('offline')))
    expect(result.current).toBe(false)
    act(() => window.dispatchEvent(new Event('online')))
    expect(result.current).toBe(true)
  })
})
