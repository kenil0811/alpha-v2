// What the core sends the window, compressed when it is large (Kenil, 10 Nov: a table of 900 mails
// took seconds over the internet). A table's words repeat from row to row, so it shrinks to a tenth
// or less, and costs the core a few milliseconds.
import type { Readable } from 'node:stream'
import {
  brotliCompressSync,
  constants,
  createBrotliCompress,
  createGzip,
  gzipSync,
} from 'node:zlib'

const AT_LEAST = 2048 // smaller than this goes as it is
const KINDS = /json|text|javascript|css|html|svg|xml/

export function compressed(
  payload: unknown,
  accepts: string,
  type: string,
): { body: Buffer; encoding: 'br' | 'gzip' } | null {
  if (typeof payload !== 'string' && !Buffer.isBuffer(payload)) return null
  if (payload.length < AT_LEAST || !KINDS.test(type)) return null
  if (/\bbr\b/.test(accepts))
    return {
      body: brotliCompressSync(payload, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } }),
      encoding: 'br',
    }
  if (/\bgzip\b/.test(accepts)) return { body: gzipSync(payload, { level: 6 }), encoding: 'gzip' }
  return null
}

// A file the window is made of (its script, its styles), streamed: compressed as it goes.
export function compressedStream(
  payload: unknown,
  accepts: string,
  type: string,
): { body: Readable; encoding: 'br' | 'gzip' } | null {
  const stream = payload as Readable | null
  if (!stream || typeof stream.pipe !== 'function' || !KINDS.test(type)) return null
  if (/\bbr\b/.test(accepts))
    return {
      body: stream.pipe(createBrotliCompress({ params: { [constants.BROTLI_PARAM_QUALITY]: 5 } })),
      encoding: 'br',
    }
  if (/\bgzip\b/.test(accepts))
    return { body: stream.pipe(createGzip({ level: 6 })), encoding: 'gzip' }
  return null
}
