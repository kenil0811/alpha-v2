import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderPage } from '@alpha/connector-files'
import { z } from 'zod'
import { stillBeingRead } from '../../files/documents.ts'
import { Refused } from '../../world/kinds.ts'
import type { Ctx } from '../ctx.ts'
import type { FileView, RowFileView } from '../types.ts'

// What a browser may show as itself: documents and pictures that carry no script.
const INLINE = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
  'text/markdown',
])
// What shows only in a sandbox: markup that could carry a script.
const SANDBOXED = new Set(['text/html', 'image/svg+xml', 'application/xhtml+xml'])

export function registerFiles(ctx: Ctx): void {
  const { app, world, engine, user, person, live } = ctx
  const { byWords, columnOf } = ctx.views

  app.post('/api/files', async (req) => {
    const name = decodeURIComponent(String(req.headers['x-file-name'] ?? 'file'))
    const mime = String(req.headers['content-type'] ?? 'application/octet-stream')
    const body = req.body as Buffer
    const out = engine.drop(user, new Uint8Array(body), name, mime)
    return { name: out.file.name, readable: out.readable, pieces: out.document?.chunks ?? 0 }
  })

  const rowOf = (params: unknown) => {
    const { id, row } = z.object({ id: z.string(), row: z.string() }).parse(params)
    const t = world.shape.table(id)
    const rec = world.records.get(row)
    if (!t || rec?.table.id !== t.id) throw new Refused('That row is not there.')
    return rec
  }
  const rowFiles = (record: string): RowFileView[] =>
    world.rowFiles(record).map((f) => ({
      hash: f.file.hash,
      name: f.file.name,
      size: f.file.size,
      mime: f.file.mime,
      kind: f.kind,
      by: byWords(f.placedBy),
      at: f.placedAt,
      read: f.document ? 'read' : stillBeingRead(f.file.hash) ? 'reading' : 'kept',
    }))
  app.get(
    '/api/tables/:id/rows/:row/files',
    async (req): Promise<RowFileView[]> => rowFiles(rowOf(req.params).record.id),
  )
  app.post('/api/tables/:id/rows/:row/files', async (req): Promise<RowFileView[]> => {
    const rec = rowOf(req.params)
    const name = decodeURIComponent(String(req.headers['x-file-name'] ?? 'file'))
    const mime = String(req.headers['content-type'] ?? 'application/octet-stream')
    const kind = req.headers['x-file-kind']
      ? decodeURIComponent(String(req.headers['x-file-kind']))
      : null
    const out = engine.drop(user, new Uint8Array(req.body as Buffer), name, mime)
    world.placeFile(out.file.hash, rec.record.id, kind, { actor: person, user: user.id })
    live()
    return rowFiles(rec.record.id)
  })
  app.post('/api/tables/:id/rows/:row/files/:hash', async (req): Promise<RowFileView[]> => {
    const rec = rowOf(req.params)
    const { hash } = z.object({ hash: z.string() }).parse(req.params)
    const { kind, off } = z
      .object({ kind: z.string().nullable().optional(), off: z.boolean().optional() })
      .parse(req.body ?? {})
    if (off) world.unplaceFile(hash, rec.record.id, { actor: person, user: user.id })
    else world.placeFile(hash, rec.record.id, kind ?? null, { actor: person, user: user.id })
    live()
    return rowFiles(rec.record.id)
  })

  // A document as the window shows it at a value's place, and a PDF's page drawn.
  app.get('/api/files/:hash/view', async (req, reply): Promise<FileView | undefined> => {
    const { hash } = z.object({ hash: z.string() }).parse(req.params)
    const f = world.files.file(hash)
    if (!f) return reply.code(404).send({ problem: 'That file is not there.' })
    const doc = world.files.document(hash)
    const base = { hash, name: f.name, mime: f.mime }
    if (!doc) return { ...base, kind: stillBeingRead(hash) ? 'reading' : 'kept' }
    const chunks = world.files.chunks(doc.id)
    if (doc.kind === 'sheet') {
      const sheets = new Map<string, NonNullable<FileView['sheets']>[number]['cells']>()
      for (const c of chunks) {
        const sheet = c.position.sheet ?? 'Sheet'
        const cell = c.position.cell ?? ''
        if (!sheets.has(sheet)) sheets.set(sheet, [])
        sheets.get(sheet)?.push({
          cell,
          row: c.position.row ?? Number(cell.replace(/^[A-Z]+/, '')),
          col: columnOf(cell),
          words: c.words,
        })
      }
      return {
        ...base,
        kind: 'sheet',
        sheets: [...sheets].map(([name, cells]) => ({ name, cells })),
      }
    }
    if (doc.kind === 'pdf')
      return {
        ...base,
        kind: 'pdf',
        pages: Math.max(1, ...chunks.map((c) => c.position.page ?? 1)),
      }
    return {
      ...base,
      kind: 'text',
      lines: chunks.map((c, i) => ({ line: c.position.line ?? i + 1, words: c.words })),
    }
  })
  app.get('/api/files/:hash/page/:n', async (req, reply) => {
    const { hash, n } = z
      .object({ hash: z.string(), n: z.coerce.number().int().min(1) })
      .parse(req.params)
    const f = world.files.file(hash)
    if (!f || !(f.mime === 'application/pdf' || /\.pdf$/i.test(f.name)))
      return reply.code(404).send({ problem: 'That is not a PDF.' })
    const dir = join(world.paths.dir, 'cache', 'pages')
    const png = join(dir, `${hash}-${n}.png`)
    if (!existsSync(png)) {
      const page = await renderPage(world.files.path(hash), n, world.paths.envs)
      mkdirSync(dir, { recursive: true })
      writeFileSync(png, page.png)
    }
    return reply
      .type('image/png')
      .header('cache-control', 'private, max-age=86400')
      .send(readFileSync(png))
  })

  // A stored file came from outside (a mailed attachment, a drop), so it never runs as Alpha's own
  // page: the harmless kinds show inline, HTML and SVG show in a sandbox that runs nothing and
  // sends nothing, everything else downloads, and no browser guesses a type.
  // A browse step's picture, by its hash: no file row of its own
  app.get('/api/pictures/:hash', async (req, reply) => {
    const { hash } = z.object({ hash: z.string().regex(/^[0-9a-f]{64}$/) }).parse(req.params)
    const p = world.files.path(hash)
    if (!existsSync(p)) return reply.code(404).send({ problem: 'That picture is not there.' })
    return reply
      .type('image/jpeg')
      .header('cache-control', 'private, max-age=86400')
      .send(readFileSync(p))
  })

  app.get('/api/files/:hash', async (req, reply) => {
    const { hash } = z.object({ hash: z.string() }).parse(req.params)
    const f = world.files.file(hash)
    if (!f) return reply.code(404).send({ problem: 'That file is not there.' })
    const mime = (f.mime.split(';')[0] ?? '').trim().toLowerCase() || 'application/octet-stream'
    const name = encodeURIComponent(f.name)
    reply.header('x-content-type-options', 'nosniff')
    if (INLINE.has(mime))
      return reply
        .type(mime)
        .header('content-disposition', `inline; filename="${name}"`)
        .send(world.files.bytes(hash))
    if (SANDBOXED.has(mime))
      return reply
        .type(mime)
        .header(
          'content-security-policy',
          "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'",
        )
        .header('referrer-policy', 'no-referrer')
        .header('content-disposition', `inline; filename="${name}"`)
        .send(world.files.bytes(hash))
    return reply
      .type('application/octet-stream')
      .header('content-disposition', `attachment; filename="${name}"`)
      .send(world.files.bytes(hash))
  })
}
