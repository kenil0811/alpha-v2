// Documents in the world: what the person drops is filed at once, read with its places by the
// files connector; a document is read back in pages, and a sheet imported into a table with
// each value's cell as its source.
import { extname } from 'node:path'
import { readBytes, readPdf } from '@alpha/connector-files'
import { config } from '../config.ts'
import type { FileOut } from '../world/files.ts'
import { checkValue, type ProvenanceInput, Refused } from '../world/kinds.ts'
import type { RecordCtx } from '../world/records/index.ts'
import type { Table, WriteCtx } from '../world/shape.ts'
import type { World } from '../world/world.ts'

// PDFs being read now, by file: a second drop of the same bytes waits for the first.
const reading = new Map<string, Promise<void>>()

// What the person drops is filed at once (design §12): the file, and its document when readable.
// A PDF is read in the background by Docling (a minute or two the first time, while its
// environment is made); the journal says when it starts and when it is read.
export function takeIn(world: World, bytes: Uint8Array, name: string, mime: string, ctx: WriteCtx) {
  const { file } = world.files.take(bytes, name, mime || 'application/octet-stream', ctx)
  if (extname(name).toLowerCase() === '.pdf') {
    if (!world.files.document(file.hash) && !reading.has(file.hash)) {
      world.line({
        actor: ctx.actor,
        kind: 'filed',
        words: `Reading ${name}…`,
        data: { file: file.hash },
        user: ctx.user ?? null,
      })
      const p = readPdf(bytes, world.paths.envs)
        .then((out) => {
          world.files.addDocument(file.hash, name, 'pdf', out.pieces, ctx)
        })
        .catch((err: unknown) => {
          world.line({
            actor: { kind: 'system' },
            kind: 'error',
            words: `${name} could not be read: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`,
            data: { file: file.hash },
            user: ctx.user ?? null,
          })
        })
        .finally(() => reading.delete(file.hash))
      reading.set(file.hash, p)
    }
    return {
      file,
      document: world.files.document(file.hash) ?? null,
      readable: true,
      reading: reading.get(file.hash) ?? null,
    }
  }
  const read = readBytes(bytes, name, file.mime)
  const document =
    read.kind === 'kept'
      ? null
      : world.files.addDocument(file.hash, name, read.kind, read.chunks, ctx)
  return { file, document, readable: read.kind !== 'kept', reading: null }
}

// Whether a PDF is being read now.
export function stillBeingRead(hash: string): boolean {
  return reading.has(hash)
}

// For journeys and tests: what is still being read.
export function stillReading(): Promise<void> {
  return Promise.all([...reading.values()]).then(() => undefined)
}

export function readDocument(world: World, hash: string, offset: number) {
  const f = world.files.file(hash) as FileOut
  const doc = world.files.document(hash)
  if (!doc)
    return reading.has(hash)
      ? {
          file: f.name,
          readable: true,
          words: 'Still being read: a PDF takes a minute or two the first time.',
        }
      : { file: f.name, readable: false, words: 'This kind of file is kept but not read yet.' }
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
