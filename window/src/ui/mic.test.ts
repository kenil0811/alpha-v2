import { describe, expect, it } from 'vitest'
import { joined } from './mic.tsx'

describe('voice input', () => {
  it('writes what is heard after what is typed, one space between', () => {
    expect(joined('', ' hello ')).toBe('hello')
    expect(joined('Find deals', 'under LOI')).toBe('Find deals under LOI')
    expect(joined('First line\n', 'second')).toBe('First line\nsecond')
    expect(joined('typed', '')).toBe('typed')
  })
})
