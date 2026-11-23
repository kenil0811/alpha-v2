// Pages: files in a module's pages/ folder, drawn in a sandboxed frame with Alpha's
// blocks (frame/kit.js) and look (frame/kit.css). A page reads its own module's tables, never
// writes, and reaches nothing outside its frame but the window. The core prints the same page,
// with the same data, to a PDF, or to a picture for a look.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { renderPage } from '@alpha/connector-sdk'
import { Refused } from '../world/kinds.ts'
import type { Module } from '../world/shape/index.ts'
import type { World } from '../world/world.ts'

export interface PageInfo {
  name: string // the file's name without .html
  title: string // its <title>
  front: boolean // <meta name="alpha-front">: the page the module opens on
  // <meta name="alpha-record" content="Clients">: drawn for one record of that table, on its
  // page; the table as the page names it here, its id once listed (pagesFor)
  record: string | null
}
// <meta name="alpha-print" content="landscape">: a wide page prints across the paper

// Nothing leaves the frame: no requests, no frames inside it, no forms; fonts and pictures only
// as data the page carries.
const CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:"

const FRAME = join(import.meta.dirname, 'frame')
const asset = (name: string) => readFileSync(join(FRAME, name), 'utf8')

const NAME = /^[A-Za-z0-9_-]+$/
const TITLE = /<title>([^<]*)<\/title>/i

function fileOf(module: Module, name: string): string {
  const file = join(module.dir, 'pages', `${name}.html`)
  if (!NAME.test(name) || !existsSync(file))
    throw new Refused(`${module.name} has no page called ${name}.`)
  return readFileSync(file, 'utf8')
}

// A page renamed where its tab shows it: its <title>, put in its <head> (or first) when it has
// none (Vikas, 23 Nov).
export function retitlePage(module: Module, name: string, title: string): void {
  const html = fileOf(module, name)
  const t = title.replace(/[<>&]/g, '').trim()
  if (!t) throw new Refused('A page needs a name.')
  const tag = `<title>${t}</title>`
  const out = TITLE.test(html)
    ? html.replace(TITLE, tag)
    : /<head[^>]*>/i.test(html)
      ? html.replace(/<head[^>]*>/i, (h) => h + tag)
      : html.replace(/^(\s*<!doctype[^>]*>)?/i, (d) => d + tag)
  writeFileSync(join(module.dir, 'pages', `${name}.html`), out)
}

export function pagesOf(module: Module): PageInfo[] {
  const dir = join(module.dir, 'pages')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.html') && NAME.test(f.slice(0, -5)))
    .sort()
    .map((f) => {
      const html = readFileSync(join(dir, f), 'utf8')
      const name = f.slice(0, -5)
      return {
        name,
        title: TITLE.exec(html)?.[1]?.trim() || name,
        front: /<meta\s+name=["']alpha-front["']/i.test(html),
        record:
          /<meta\s+name=["']alpha-record["']\s+content=["']([^"']+)["']/i.exec(html)?.[1] ?? null,
      }
    })
    .sort((a, b) => Number(b.front) - Number(a.front))
}

// A module's table by its lasting key or its name, as a page names it (rules M5).
function tableNamed(world: World, module: Module, wanted: string) {
  const tables = world.shape.tables(module.id)
  const w = wanted.toLowerCase()
  return (
    tables.find((t) => t.key?.toLowerCase() === w) ?? tables.find((t) => t.name.toLowerCase() === w)
  )
}

// A module's pages as the window lists them: a record's page names its table by id.
export function pagesFor(world: World, module: Module): PageInfo[] {
  return pagesOf(module).map((p) => ({
    ...p,
    record: p.record ? (tableNamed(world, module, p.record)?.id ?? null) : null,
  }))
}

// The record a page is drawn for: one row of the table it names, else refused.
export function pageRecord(world: World, module: Module, name: string, row: string): string {
  const page = pagesFor(world, module).find((p) => p.name === name)
  if (!page?.record || world.records.tableOf(row)?.id !== page.record)
    throw new Refused(`${page?.title ?? name} is not drawn for that row.`)
  return row
}

// The window's own fonts, carried inside the page, since the frame fetches nothing.
let faces: string | null = null
function fontFaces(): string {
  if (faces !== null) return faces
  const need = createRequire(import.meta.url)
  const face = (family: string, file: string) => {
    const data = readFileSync(need.resolve(file)).toString('base64')
    return `@font-face{font-family:"${family}";font-style:normal;font-display:block;font-weight:100 900;src:url(data:font/woff2;base64,${data}) format("woff2")}`
  }
  faces =
    face('Geist Variable', '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2') +
    face(
      'Source Serif 4 Variable',
      '@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2',
    )
  return faces
}

// The whole document the frame shows: Alpha's head first (so its policy holds before any of the
// page's own words), then the page's file as it is, without its own html, head and body tags.
export function pageDocument(
  module: Module,
  name: string,
  inputs?: Record<string, string>,
  record?: string, // the row it is drawn for (pageRecord), as alpha.record
): string {
  const inner = fileOf(module, name)
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<\/?(html|head|body)\b[^>]*>/gi, '')
  const given =
    inputs || record
      ? `<script>${[
          inputs && `window.alphaInputs=${JSON.stringify(inputs).replace(/</g, '\\u003c')}`,
          record && `window.alphaRecord=${JSON.stringify(record).replace(/</g, '\\u003c')}`,
        ]
          .filter(Boolean)
          .join(';')}</script>`
      : ''
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
    '<meta name="viewport" content="width=device-width">',
    `<style>${fontFaces()}${asset('kit.css')}</style>`,
    given,
    `<script>${asset('runtime.js')}</script>`,
    `<script>${asset('kit.js')}</script>`,
    `<script>${asset('doc.js')}</script>`,
    `</head><body>${inner}</body></html>`,
  ].join('')
}

// What a page may ask: its module's rows, or when a field's values changed. Values come by field
// name, with the kind of each (stated, looked up, computed…); nothing here writes. A kit's page
// names its tables and fields as the kit did, by their lasting keys (rules M5).
export function pageAnswer(
  world: World,
  module: Module,
  op: string,
  args: Record<string, unknown>,
): unknown {
  const table = tableNamed(world, module, String(args.table ?? ''))
  if (!table) throw new Refused(`${module.name} has no table called ${String(args.table)}.`)
  const nameOf = new Map(table.fields.map((f) => [f.slug, f.key ?? f.name]))
  const rows = world.records.list(table.id)
  if (op === 'rows')
    return rows.map((r) => ({
      id: r.id,
      values: Object.fromEntries(
        Object.entries(r.values).map(([slug, v]) => [nameOf.get(slug) ?? slug, v]),
      ),
      kinds: Object.fromEntries(
        Object.entries(r.provenance).map(([slug, p]) => [nameOf.get(slug) ?? slug, p.kind]),
      ),
      at: r.createdAt,
    }))
  if (op === 'history') {
    const named = String(args.field ?? '').toLowerCase()
    const field =
      table.fields.find((f) => f.key?.toLowerCase() === named) ??
      table.fields.find((f) => f.name.toLowerCase() === named)
    if (!field) throw new Refused(`${table.name} has no field called ${String(args.field)}.`)
    // each row's values of the field, oldest first, with when each came
    return rows.map((r) => ({
      row: r.id,
      changes: world.records
        .history(r.id, field.slug)
        .reverse()
        .map((h) => ({ value: h.value, at: h.provenance?.at ?? r.createdAt })),
    }))
  }
  throw new Refused(`A page cannot ask for ${op}.`)
}

// The page printed by the core's own headless browser: a PDF to download, or a picture to look at.
export function printPage(
  world: World,
  module: Module,
  name: string,
  opts: {
    browsers: string
    inputs?: Record<string, string>
    record?: string
    as: 'pdf' | 'png' | 'text'
  },
): Promise<Buffer> {
  const html = pageDocument(module, name, opts.inputs ?? {}, opts.record)
  return renderPage(opts.browsers, html, {
    as: opts.as,
    landscape: /<meta\s+name=["']alpha-print["']\s+content=["']landscape["']/i.test(
      fileOf(module, name),
    ),
    ask: async (question) => {
      try {
        const q = JSON.parse(question) as { op: string; args: Record<string, unknown> }
        return JSON.stringify({ value: pageAnswer(world, module, q.op, q.args ?? {}) })
      } catch (err) {
        return JSON.stringify({ problem: err instanceof Error ? err.message : String(err) })
      }
    },
  })
}
