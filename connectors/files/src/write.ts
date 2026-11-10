// A table as a file the person keeps (Export): CSV, or an Excel workbook (SheetJS), of
// exactly the rows and columns they were looking at. Numbers stay numbers in Excel.
import * as XLSX from 'xlsx'

export type Cell = string | number | null

export function sheetBytes(
  name: string,
  header: string[],
  rows: Cell[][],
  as: 'csv' | 'xlsx',
): Uint8Array {
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
  if (as === 'csv') return new TextEncoder().encode(XLSX.utils.sheet_to_csv(ws))
  const book = XLSX.utils.book_new()
  // a sheet's name is at most 31 characters, without : \ / ? * [ ]
  XLSX.utils.book_append_sheet(book, ws, name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Sheet')
  return new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer)
}
