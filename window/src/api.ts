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
  if (!res.ok) throw new Problem(data.problem ?? 'The core did not answer.')
  return data
}

export const api = {
  get: <T>(path: string) => call<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => call<T>('POST', path, body),
  upload: (file: File) =>
    call<{ name: string; readable: boolean; pieces: number }>('POST', '/api/files', file, {
      'content-type': file.type || 'application/octet-stream',
      'x-file-name': encodeURIComponent(file.name),
    }),
  fileUrl: (hash: string) => `/api/files/${hash}?t=${encodeURIComponent(token())}`,
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
    ws.onopen = () => on({ type: 'lines' })
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
