// Files as the window shows them (split from types.ts for its wall): a document at a value's
// place, every file kept, a module's files and a row's. Re-exported by types.ts.

// A document as the window shows it at a value's place: a sheet's cells, a PDF's pages (drawn by /api/files/:hash/page/:n), or a text's lines.
export interface FileView {
  hash: string
  name: string
  mime: string
  kind: 'sheet' | 'pdf' | 'text' | 'kept' | 'reading'
  sheets?: { name: string; cells: { cell: string; row: number; col: number; words: string }[] }[]
  pages?: number
  lines?: { line: number; words: string }[]
}

// Intelligence › Files: every file Alpha has kept, the newest first.
export interface KeptFileView {
  hash: string
  name: string
  size: number
  mime: string
  from: string // what brought it, in words: You, Folder, Gmail, Alpha
  at: string
  read: 'read' | 'reading' | 'failed' | 'kept' // read with its places, being read, not, or kept as it is
  words: string | null // how much was read (419 lines), or why it could not be
  modules: { id: string; name: string }[] // through the rows it sits on; none for a file on no row
}

// A file on a module's rows, as its Setup lists it: the row it sits on and when it came there.
export interface ModuleFileView {
  hash: string
  name: string
  mime: string
  row: { id: string; name: string; table: string }
  at: string
}

// A file on a row: a deal's CIM, a client's export.
export interface RowFileView {
  hash: string
  name: string
  size: number
  mime: string
  kind: string | null
  by: string // who put it there, in words
  at: string
  read: 'read' | 'reading' | 'kept' // read with its places, being read, or kept as it is
}
