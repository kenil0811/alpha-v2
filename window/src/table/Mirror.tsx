// A mirror of a system that keeps the record (rules D1, D8, D12): what the table says of it, the
// rows its source deleted (kept, out of the list until asked for), and when a row was last read.
import type { RowView, TableView } from '@alpha/core/api'
import { when } from './values.ts'

// The line under a mirror's tabs: whose it is, and its gone rows one click away.
export function MirrorLine({
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
  return (
    <div className="flex items-center gap-3 border-line border-b px-7 py-2 text-ink-3 text-sm">
      <span className="flex-1">
        {showingGone
          ? `Showing what is gone from ${data.mirror}: kept here, with what you added to it.`
          : `A mirror of ${data.mirror}: its rows come and go with it. Fields you add are yours.`}
      </span>
      {(gone > 0 || showingGone) && (
        <button
          type="button"
          onClick={() => onGone(!showingGone)}
          className="font-medium text-accent hover:underline"
        >
          {showingGone ? 'Back to the rest' : `${gone} gone from ${data.mirror}`}
        </button>
      )}
    </div>
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
