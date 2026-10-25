// The window's only way to the core: HTTP with the per-install token, and one websocket.
import type { LiveEvent } from '@alpha/core/api'

const KEY = 'alpha-token'

function token(): string {
  const fromUrl = new URLSearchParams(window.location.search).get('t')
  if (fromUrl) {
    try {
      sessionStorage.setItem(KEY, fromUrl)
    } catch {
      // a private window: the token stays in the address
    }
    return fromUrl
  }
  try {
    return sessionStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

export class Problem extends Error {}

// The window's words for a core that gave none: it is on this Mac, so "not answering" is the
// whole story (item 30 of the problems list, 25 Oct).
export const NOT_ANSWERING = "Alpha isn't answering on this Mac right now."

// A failure in words a person reads: the core's own when it refused, else the line above (never
// the browser's, like "Load failed").
export function wordsOf(err: unknown): string {
  return err instanceof Problem ? err.message : NOT_ANSWERING
}

async function call<T>(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: {
      'x-alpha-token': token(),
      ...(body !== undefined && !(body instanceof Blob)
        ? { 'content-type': 'application/json' }
        : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: body instanceof Blob ? body : JSON.stringify(body) } : {}),
  })
  const data = (await res.json().catch(() => ({}))) as T & { problem?: string }
  if (!res.ok) throw new Problem(data.problem ?? NOT_ANSWERING)
  return data
}

export const api = {
  get: <T>(path: string) => call<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => call<T>('POST', path, body),
  put: <T>(path: string, body: unknown = {}) => call<T>('PUT', path, body),
  delete: <T>(path: string) => call<T>('DELETE', path),
  upload: (file: File) =>
    call<{ name: string; readable: boolean; pieces: number }>('POST', '/api/files', file, {
      'content-type': file.type || 'application/octet-stream',
      'x-file-name': encodeURIComponent(file.name),
    }),
  // a file dropped on a row: kept there at once
  uploadTo: <T>(path: string, file: File) =>
    call<T>('POST', path, file, {
      'content-type': file.type || 'application/octet-stream',
      'x-file-name': encodeURIComponent(file.name),
    }),
  // a core address the browser opens itself (a picture, a download), with the token
  tokened: (path: string) =>
    `${path}${path.includes('?') ? '&' : '?'}t=${encodeURIComponent(token())}`,
  fileUrl: (hash: string) => `/api/files/${hash}?t=${encodeURIComponent(token())}`,
  // a file the core makes (an export), saved by the browser under the name given
  download: async (path: string, body: unknown, name: string) => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'x-alpha-token': token(), 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { problem?: string }
      throw new Problem(data.problem ?? NOT_ANSWERING)
    }
    const url = URL.createObjectURL(await res.blob())
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  },
}

// A core back with a newer window (Alpha restarted after a change): this page reloads, so it
// never shows the old one's screens against the new core.
let build: string | null | undefined
async function sameBuild(): Promise<void> {
  const h = await fetch('/api/health')
    .then((r) => r.json() as Promise<{ build?: string | null }>)
    .catch(() => null)
  if (!h) return
  if (build === undefined) build = h.build ?? null
  else if (h.build && h.build !== build) window.location.reload()
}

// Live events from the core; reconnects when the core comes back.
export function listen(on: (e: LiveEvent) => void): () => void {
  let ws: WebSocket | null = null
  let closed = false
  let retry: ReturnType<typeof setTimeout> | undefined
  const open = () => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    ws = new WebSocket(`${proto}://${window.location.host}/ws?t=${encodeURIComponent(token())}`)
    ws.onmessage = (m) => on(JSON.parse(String(m.data)) as LiveEvent)
    ws.onopen = () => {
      on({ type: 'lines' })
      void sameBuild()
    }
    ws.onclose = () => {
      if (!closed) retry = setTimeout(open, 1500)
    }
  }
  open()
  return () => {
    closed = true
    clearTimeout(retry)
    ws?.close()
  }
}
