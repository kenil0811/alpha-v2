// What the core sends goes compressed when it is large and the window can read it so (Kenil, 10 Nov).
import { Readable } from 'node:stream'
import { brotliDecompressSync, gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { compressed, compressedStream } from './compress.ts'

describe('what the core sends', () => {
  it('goes compressed when large, to a tenth of a table whose words repeat', () => {
    const big = JSON.stringify(
      Array.from({ length: 500 }, (_, i) => ({
        id: `r_${i}`,
        sources: { from: { kind: 'looked_up', words: 'Looked up' } },
      })),
    )
    const br = compressed(big, 'gzip, deflate, br', 'application/json; charset=utf-8')
    expect(br?.encoding).toBe('br')
    const body = br?.body as Buffer
    expect(brotliDecompressSync(body).toString()).toBe(big)
    expect(body.length).toBeLessThan(big.length / 10)
    const gz = compressed(big, 'gzip', 'application/json')
    expect(gunzipSync(gz?.body as Buffer).toString()).toBe(big)
    // nothing asked for, too small, or not words: as it is
    expect(compressed(big, '', 'application/json')).toBeNull()
    expect(compressed('{"ok":true}', 'br', 'application/json')).toBeNull()
    expect(compressed(big, 'br', 'image/png')).toBeNull()
  })

  it('streams the window’s own files compressed', async () => {
    const script = 'const a = 1;\n'.repeat(4000)
    const out = compressedStream(Readable.from([script]), 'gzip', 'text/javascript; charset=UTF-8')
    expect(out?.encoding).toBe('gzip')
    if (!out) throw new Error('not compressed')
    const parts: Buffer[] = []
    for await (const c of out.body) parts.push(c as Buffer)
    expect(gunzipSync(Buffer.concat(parts)).toString()).toBe(script)
    expect(compressedStream(Readable.from([script]), 'gzip', 'image/png')).toBeNull()
  })
})
