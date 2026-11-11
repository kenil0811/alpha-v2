// A journey's made-up site, served on loopback from the repository, never a real one. A later
// step can move it to another state: a page in the site's states/<state>/ folder is
// served over the page of the same name, at the same address, as a real site changes its pages.
import { existsSync, readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { join, normalize } from 'node:path'

export interface Site {
  server: Server
  url: string
  dir: string
  state: string | null
  requests: string[] // every address asked of it, its path and query, for site_requests
}

export function serve(dir: string, state: string | null = null): Promise<Site> {
  const site = { dir, state, requests: [] as string[] } as Site
  const server = createServer((req, res) => {
    site.requests.push(req.url ?? '/')
    const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/'))
    const now = site.state ? join(site.dir, 'states', site.state, path) : null
    const file = now && existsSync(now) ? now : join(site.dir, path)
    if (!file.startsWith(site.dir) || !existsSync(file) || path.endsWith('/')) {
      res.writeHead(404).end('Not found')
      return
    }
    res.writeHead(200, { 'content-type': file.endsWith('.txt') ? 'text/plain' : 'text/html' })
    res.end(readFileSync(file))
  })
  return new Promise((r) =>
    server.listen(0, '127.0.0.1', () => {
      const a = server.address()
      site.server = server
      site.url = `http://127.0.0.1:${typeof a === 'object' && a ? a.port : 0}`
      r(site)
    }),
  )
}
