// The per-install token is never in an address the window makes or keeps: the page drops it from its
// own as it loads, and nothing the window builds (a picture, a file, a socket) carries it.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { withoutToken } from './api.ts'

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return sources(p)
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : []
  })
}

describe('the token', () => {
  it('leaves the address, which keeps its place', () => {
    expect(withoutToken('http://127.0.0.1:4700/?t=abc123#/table/t_1')).toBe(
      'http://127.0.0.1:4700/#/table/t_1',
    )
    expect(withoutToken('http://127.0.0.1:4700/?x=1&t=abc123')).toBe('http://127.0.0.1:4700/?x=1')
    expect(withoutToken('http://127.0.0.1:4700/#/')).toBeNull()
  })

  it('is in no address the window builds', () => {
    const found = sources(import.meta.dirname).filter((f) =>
      /[?&]t=\$\{/.test(readFileSync(f, 'utf8')),
    )
    expect(found).toEqual([])
  })
})
