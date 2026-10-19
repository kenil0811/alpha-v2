// Reading a file into pieces with their places (design §8): sheets cell by cell (SheetJS), text
// line by line. What it cannot read yet is kept as it is.
import { extname } from 'node:path'
import * as XLSX from 'xlsx'

export interface Position {
  sheet?: string
  cell?: string
  row?: number
  line?: number
  page?: number
  box?: [number, number, number, number]
  table?: number
  column?: number
}

export interface Piece {
  position: Position
  words: string
}

const SHEETS = new Set(['.csv', '.tsv', '.xlsx', '.xls', '.xlsm', '.ods', '.numbers'])
const TEXTS = new Set(['.txt', '.md', '.json', '.yaml', '.yml', '.html', '.xml', '.log'])

export type Readable = { kind: 'sheet' | 'text'; chunks: Piece[] } | { kind: 'kept'; chunks: [] }

export function readBytes(bytes: Uint8Array, name: string, mime: string): Readable {
  const ext = extname(name).toLowerCase()
  if (SHEETS.has(ext)) {
    const book = XLSX.read(bytes, {
      type: 'array',
      raw: ext === '.csv' || ext === '.tsv',
      cellDates: false,
    })
    const chunks: Piece[] = []
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
