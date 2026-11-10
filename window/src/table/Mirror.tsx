// A mirror of a system that keeps the record (rules D1, D8, D12): what the table says of it, the
// rows its source deleted (kept, out of the list until asked for), and when a row was last read.
import type { RowView, TableView } from '@alpha/core/api'
import { createContext, useContext } from 'react'
import { when } from './values.ts'

// Why this table's shape is fixed, on a managed module (rules M2): its controls grey with it.
export const ShapeFixed = createContext<string | undefined>(undefined)
export const useShapeFixed = () => useContext(ShapeFixed)
export const managedWhy = (managed: string | null) =>
  managed ? `Managed by ${managed}: its shape stays as it is` : undefined

// A mirror's gone rows, one click away on the line over the table (rules D8); no sentence about
// what a mirror is (Kenil, 10 Nov).
export function MirrorGone({
  data,
  showingGone,
  onGone,
}: {
  data: TableView
  showingGone: boolean
  onGone: (show: boolean) => void
}) {
  if (!data.mirror) return null
  const gone = data.rows.filter((r) => r.gone).length
  if (!gone && !showingGone) return null
  return (
    <button
      type="button"
      onClick={() => onGone(!showingGone)}
      className="text-accent text-sm hover:underline"
    >
      {showingGone
        ? `Showing what is gone from ${data.mirror}: back to the rest`
        : `${gone} gone from ${data.mirror}`}
    </button>
  )
}

// The rows a mirror shows: those still at its source, or only those gone from it.
export const mirrorRows = (rows: RowView[], showingGone: boolean) =>
  rows.filter((r) => (showingGone ? !!r.gone : !r.gone))

// Why a mirror's row cannot be deleted here, for its greyed Delete.
export const mirrorKeeps = (data: TableView) =>
  data.mirror ? `Its rows come and go with ${data.mirror}` : undefined

// On a row's page: when its system was last read, and whether the system deleted it.
export function ReadLine({ row }: { row: RowView }) {
  if (!row.read && !row.gone) return null
  return (
    <div className="border-hair border-b px-4.5 py-2.5 text-ink-3 text-sm">
      {row.gone ? `Gone from ${row.read?.from ?? 'its source'} ${when(row.gone)}; kept here. ` : ''}
      {row.read ? `Read from ${row.read.from} ${when(row.read.at)}.` : ''}
    </div>
  )
}
