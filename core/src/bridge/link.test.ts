// A pairing link: an Alpha elsewhere over https alone; plain http only for this computer's own
// (a PC whose Alpha runs inside it).
import { linkOf } from '@alpha/bridge'
import { describe, expect, it } from 'vitest'

describe('a pairing link', () => {
  it('takes an Alpha elsewhere over https', () => {
    expect(linkOf('https://alpha.example.com/?pair=abc')).toEqual({
      alpha: 'https://alpha.example.com',
      code: 'abc',
    })
  })
  it('takes this computer’s own Alpha over plain http', () => {
    expect(linkOf('http://127.0.0.1:4700/?pair=abc').alpha).toBe('http://127.0.0.1:4700')
    expect(linkOf('http://localhost:4700/?pair=abc').alpha).toBe('http://localhost:4700')
  })
  it('refuses plain http to anywhere else', () => {
    expect(() => linkOf('http://alpha.example.com/?pair=abc')).toThrow(/not a pairing link/)
    expect(() => linkOf('http://192.168.1.20:4700/?pair=abc')).toThrow(/not a pairing link/)
  })
})
