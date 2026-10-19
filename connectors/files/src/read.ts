// The files connector, minimal (week 1): a dropped file is kept by its hash and read into a
// document with places, cell by cell for sheets (SheetJS) and line by line for text. It moves
// onto the connector SDK in week 2, with PDFs.
import { extname } from 'node:path'
import * as XLSX from 'xlsx'
import { config } from '../config.ts'
import type { ChunkInput, FileOut } from '../world/files.ts'
import { checkValue, type ProvenanceInput, Refused } from '../world/kinds.ts'
import type { RecordCtx } from '../world/records.ts'
import type { Table, WriteCtx } from '../world/shape.ts'
import type { World } from '../world/world.ts'

const SHEETS = new Set(['.csv', '.tsv', '.xlsx', '.xls', '.xlsm', '.ods', '.numbers'])
const TEXTS = new Set(['.txt', '.md', '.json', '.yaml', '.yml', '.html', '.xml', '.log'])

export type Readable =
  | { kind: 'sheet' | 'text'; chunks: ChunkInput[] }
  | { kind: 'kept'; chunks: [] }

export function readBytes(bytes: Uint8Array, name: string, mime: string): Readable {
  const ext = extname(name).toLowerCase()
  if (SHEETS.has(ext)) {
    const book = XLSX.read(bytes, {
      type: 'array',
      raw: ext === '.csv' || ext === '.tsv',
      cellDates: false,
    })
    const chunks: ChunkInput[] = []
    for (const sheet of book.SheetNames) {
      const ws = book.Sheets[sheet]
      if (!ws?.['!ref']) continue
      const range = XLSX.utils.decode_range(ws['!ref'])
      for (let r = range.s.r; r <= range.e.r; r++)
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined
          if (!cell || cell.v === undefined || cell.v === null || cell.v === '') continue
          const words = String(cell.w ?? cell.v).trim()
          if (words)
            chunks.push({
              position: { sheet, cell: XLSX.utils.encode_cell({ r, c }), row: r + 1 },
              words,
            })
        }
    }
    return { kind: 'sheet', chunks }
  }
  if (TEXTS.has(ext) || mime.startsWith('text/')) {
    const text = new TextDecoder().decode(bytes)
    const chunks = text
      .split(/\r?\n/)
      .map((words, i) => ({ position: { line: i + 1 }, words: words.trim() }))
      .filter((c) => c.words)
    return { kind: 'text', chunks }
  }
  return { kind: 'kept', chunks: [] }
}

// What the person drops is filed at once (design §12): the file, and its document when readable.
export function takeIn(world: World, bytes: Uint8Array, name: string, mime: string, ctx: WriteCtx) {
  const { file } = world.files.take(bytes, name, mime || 'application/octet-stream', ctx)
  const read = readBytes(bytes, name, file.mime)
  const document =
    read.kind === 'kept'
      ? null
      : world.files.addDocument(file.hash, name, read.kind, read.chunks, ctx)
  return { file, document, readable: read.kind !== 'kept' }
}

export function readDocument(world: World, hash: string, offset: number) {
  const f = world.files.file(hash) as FileOut
  const doc = world.files.document(hash)
  if (!doc)
    return { file: f.name, readable: false, words: 'This kind of file is kept but not read yet.' }
  const page = config.limits().document_page_chunks
  const all = world.files.chunks(doc.id)
  return {
    file: f.name,
    kind: doc.kind,
    total: all.length,
    offset,
    pieces: all.slice(offset, offset + page).map((c) => ({ place: c.position, words: c.words })),
  }
}

function toValue(words: string, kind: string): unknown {
  if (kind === 'number') {
    const n = Number(words.replace(/[,\s]/g, ''))
    return Number.isFinite(n) ? n : words
  }
  return words
}

// A sheet's rows into a table: the first row with values is the headers; every value keeps its
// cell as its source.
export function importRows(
  world: World,
  hash: string,
  table: Table,
  columns: Record<string, string>,
  sheet: string | null,
  ctx: RecordCtx,
): string {
  const doc = world.files.document(hash)
  if (doc?.kind !== 'sheet') throw new Refused('Only a sheet can be imported into a table.')
  const chunks = world.files
    .chunks(doc.id)
    .filter((c) => c.position.sheet && (!sheet || c.position.sheet === sheet))
  if (!chunks.length)
    throw new Refused(sheet ? `There is no sheet called ${sheet}.` : 'The sheet is empty.')
  const sheetName = sheet ?? (chunks[0]?.position.sheet as string)
  const rows = new Map<number, Map<string, { words: string; cell: string }>>()
  for (const c of chunks) {
    if (c.position.sheet !== sheetName) continue
    const col = (c.position.cell as string).replace(/\d+$/, '')
    const row = c.position.row as number
    if (!rows.has(row)) rows.set(row, new Map())
    rows.get(row)?.set(col, { words: c.words, cell: c.position.cell as string })
  }
  const order = [...rows.keys()].sort((a, b) => a - b)
  const headerRow = rows.get(order[0] as number) as Map<string, { words: string }>
  const colOf = new Map<string, string>()
  for (const [col, h] of headerRow) colOf.set(h.words.toLowerCase(), col)
  const missing = Object.keys(columns).filter((h) => !colOf.has(h.toLowerCase()))
  if (missing.length)
    throw new Refused(
      `The sheet has no column ${missing.join(', ')}; its headers are ${[...headerRow.values()].map((h) => h.words).join(', ')}.`,
    )
  const out: {
    values: Record<string, unknown>
    provenance: ProvenanceInput
    per_field: Record<string, ProvenanceInput>
  }[] = []
  const skipped: string[] = []
  for (const r of order.slice(1)) {
    const cells = rows.get(r) as Map<string, { words: string; cell: string }>
    const values: Record<string, unknown> = {}
    const perField: Record<string, ProvenanceInput> = {}
    let bad: string | null = null
    for (const [header, fieldName] of Object.entries(columns)) {
      const cell = cells.get(colOf.get(header.toLowerCase()) as string)
      if (!cell) continue
      const field = table.fields.find(
        (f) => f.name.toLowerCase() === fieldName.toLowerCase() || f.slug === fieldName,
      ) as Table['fields'][number]
      const value = toValue(cell.words, field.kind)
      try {
        values[field.name] = checkValue(field.kind, field.name, value, field.choices)
      } catch (err) {
        bad = `row ${r}: ${(err as Error).message}`
        break
      }
      perField[field.name] = {
        kind: 'looked_up',
        source: { file: hash, sheet: sheetName, cell: cell.cell },
      }
    }
    if (bad) skipped.push(bad)
    else if (Object.keys(values).length)
      out.push({
        values,
        provenance: { kind: 'looked_up', source: { file: hash } },
        per_field: perField,
      })
  }
  const ids = out.length ? world.records.add(table.id, out, ctx) : []
  return `Imported ${ids.length} row${ids.length === 1 ? '' : 's'} into ${table.name} from ${doc.title}${
    skipped.length ? `; skipped ${skipped.length}: ${skipped.slice(0, 5).join('; ')}` : ''
  }.`
}
