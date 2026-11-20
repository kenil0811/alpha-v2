// The window's only way to the core: HTTP with the per-install token, and one websocket.
import type { LiveEvent } from '@alpha/core/api'

// The address the core prints carries the token once. Here it is traded for a cookie the page
// cannot read (POST /api/enter) and dropped from the address, so no link, picture, file or socket
// shows it. Everything waits on `ready`.
const entering = (): Promise<void> => {
  if (typeof window === 'undefined') return Promise.resolve() // a test renders on the server
  const url = new URL(window.location.href)
  const given = url.searchParams.get('t')
  if (!given) return Promise.resolve()
  return fetch('/api/enter', { method: 'POST', headers: { 'x-alpha-token': given } }).then(
    (res) => {
      if (!res.ok) return
      url.searchParams.delete('t')
      window.history.replaceState(null, '', url)
    },
    () => undefined,
  )
}
export const ready = entering()

export class Problem extends Error {}

// The window's words for a core that gave none: it is on this Mac, so "not answering" is the
// whole story.
export const NOT_ANSWERING = "Alpha isn't answering right now."

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
  await ready
  const res = await fetch(path, {
    method,
    headers: {
      ...(body !== undefined && !(body instanceof Blob)
        ? { 'content-type': 'application/json' }
        : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: body instanceof Blob ? body : JSON.stringify(body) } : {}),
  })
  const data = (await res.json().catch(() => ({}))) as T & { problem?: string }
  // a session that ran out: the sign-in page again
  if (res.status === 401) window.dispatchEvent(new Event('alpha:signed-out'))
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
  // a core address the browser opens itself (a picture, a download): the cookie goes with it
  tokened: (path: string) => path,
  fileUrl: (hash: string) => `/api/files/${hash}`,
  // a file the core makes (an export), saved by the browser under the name given
  download: async (path: string, body: unknown, name: string) => {
    await ready
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
    if (closed) return
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    ws = new WebSocket(`${proto}://${window.location.host}/ws`)
    ws.onmessage = (m) => on(JSON.parse(String(m.data)) as LiveEvent)
    ws.onopen = () => {
      on({ type: 'lines' })
      void sameBuild()
    }
    ws.onclose = () => {
      if (!closed) retry = setTimeout(open, 1500)
    }
  }
  void ready.then(open)
  return () => {
    closed = true
    clearTimeout(retry)
    ws?.close()
  }
}
