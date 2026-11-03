// Pages (design §13): files in a module's pages/ folder, drawn in a sandboxed frame with Alpha's
// blocks (frame/kit.js) and look (frame/kit.css). A page reads its own module's tables, never
// writes, and reaches nothing outside its frame but the window. The core prints the same page,
// with the same data, to a PDF, or to a picture for a look.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
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
  // <meta name="alpha-for" content="Clients" data-input="Client">: a page of one row (a client's
  // report), opened from that row with its name as the input, never a tab (Vikas, 3 Nov)
  for: PageFor | null
}
// A row's page is a tab of the row's own page (Vikas, 3 Nov: a deal's phases), in its order
// (data-order), on the row's Overview instead when data-place="overview". data-when="CIM:
// Requested, Received" shows it only while the row's field is one of those; data-next="Request
// CIM: CIM = Requested" is a button under it, setting the field, while the field is empty or its
// first choice;
// data-upload="CIM" takes a document of that kind on the row there.
export interface PageFor {
  table: string
  input: string
  order: number
  place: 'tab' | 'overview'
  when: { field: string; values: string[] } | null
  next: { label: string; field: string; value: string } | null
  upload: string | null
}
// <meta name="alpha-print" content="landscape">: a wide page prints across the paper

// Nothing leaves the frame: no requests, no frames inside it, no forms; fonts and pictures only
// as data the page carries.
const CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:"

const FRAME = join(import.meta.dirname, 'frame')
const asset = (name: string) => readFileSync(join(FRAME, name), 'utf8')

const NAME = /^[A-Za-z0-9_-]+$/

function fileOf(module: Module, name: string): string {
  const file = join(module.dir, 'pages', `${name}.html`)
  if (!NAME.test(name) || !existsSync(file))
    throw new Refused(`${module.name} has no page called ${name}.`)
  return readFileSync(file, 'utf8')
}

const forOf = (html: string): PageInfo['for'] => {
  const tag = /<meta\s+name=["']alpha-for["'][^>]*>/i.exec(html)?.[0]
  const table = tag && /content=["']([^"']+)["']/i.exec(tag)?.[1]
  if (!tag || !table) return null
  const attr = (n: string) => new RegExp(`data-${n}=["']([^"']+)["']`, 'i').exec(tag)?.[1]?.trim()
  const when = /^([^:]+):(.+)$/.exec(attr('when') ?? '')
  const next = /^([^:]+):([^=]+)=(.+)$/.exec(attr('next') ?? '')
  return {
    table,
    input: attr('input') ?? table,
    order: Number(attr('order') ?? 50) || 50,
    place: attr('place') === 'overview' ? 'overview' : 'tab',
    when:
      when?.[1] && when[2]
        ? {
            field: when[1].trim(),
            values: when[2]
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean),
          }
        : null,
    next:
      next?.[1] && next[2] && next[3]
        ? { label: next[1].trim(), field: next[2].trim(), value: next[3].trim() }
        : null,
    upload: attr('upload') ?? null,
  }
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
        title: /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() || name,
        front: /<meta\s+name=["']alpha-front["']/i.test(html),
        for: forOf(html),
      }
    })
    .sort((a, b) => Number(b.front) - Number(a.front))
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
): string {
  const inner = fileOf(module, name)
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<\/?(html|head|body)\b[^>]*>/gi, '')
  // a page opened on its row keeps the row's input fixed: the record's own picker changes it
  const fixed = forOf(inner)?.input
  const given = inputs
    ? `<script>window.alphaInputs=${JSON.stringify(inputs).replace(/</g, '\\u003c')};window.alphaFixed=${JSON.stringify(fixed && fixed in inputs ? [fixed] : []).replace(/</g, '\\u003c')}</script>`
    : ''
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
    '<meta name="viewport" content="width=device-width">',
    `<style>${fontFaces()}${asset('kit.css')}</style>`,
    given,
    `<script>${asset('runtime.js')}</script>`,
    `<script>${asset('kit.js')}</script>`,
    `</head><body>${inner}</body></html>`,
  ].join('')
}

// What a page may ask: its module's rows, or when a field's values changed. Values come by field
// name, with the kind of each (stated, looked up, computed…); nothing here writes.
export function pageAnswer(
  world: World,
  module: Module,
  op: string,
  args: Record<string, unknown>,
): unknown {
  const wanted = String(args.table ?? '').toLowerCase()
  const table = world.shape.tables(module.id).find((t) => t.name.toLowerCase() === wanted)
  if (!table) throw new Refused(`${module.name} has no table called ${String(args.table)}.`)
  const nameOf = new Map(table.fields.map((f) => [f.slug, f.name]))
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
    const field = table.fields.find(
      (f) => f.name.toLowerCase() === String(args.field ?? '').toLowerCase(),
    )
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
  opts: { browsers: string; inputs?: Record<string, string>; as: 'pdf' | 'png' | 'text' },
): Promise<Buffer> {
  const html = pageDocument(module, name, opts.inputs ?? {})
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
