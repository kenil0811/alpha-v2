// A document at the place a value was read from (design §4): a sheet with that cell marked, a
// PDF's page with that piece's box marked, or a text with that line marked. The file itself is a
// download away.
import type { FileView as FileData } from '@alpha/core/api'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from './api.ts'
import { Button, IconButton } from './ui/button.tsx'
import { cn } from './ui/cn.ts'

export interface FilePlace {
  hash: string
  sheet: string | null
  cell: string | null
  page: number | null
  box: [number, number, number, number] | null // points, counted up from the page's foot
  line: number | null
}

// The cell a #/file address names, and the address for a value's place.
export function fileHref(open: {
  file: string
  sheet?: string
  cell?: string
  page?: number
  box?: [number, number, number, number]
  line?: number
}): string {
  const q = new URLSearchParams()
  if (open.sheet) q.set('sheet', open.sheet)
  if (open.cell) q.set('cell', open.cell)
  if (open.page) q.set('page', String(open.page))
  if (open.box) q.set('box', open.box.join(','))
  if (open.line) q.set('line', String(open.line))
  const s = q.toString()
  return `#/file/${open.file}${s ? `?${s}` : ''}`
}

const letters = (n: number) => {
  let s = ''
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26))
    s = String.fromCharCode(65 + ((x - 1) % 26)) + s
  return s
}

export function FileView({ place, onName }: { place: FilePlace; onName: (n: string) => void }) {
  const [data, setData] = useState<FileData | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => {
    api.get<FileData>(`/api/files/${place.hash}/view`).then(
      (d) => {
        setData(d)
        onName(d.name)
      },
      () => setProblem('That file is not there.'),
    )
  }, [place.hash, onName])
  if (problem) return <p className="p-6 text-ink-3">{problem}</p>
  if (!data) return null
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-line border-b px-6 py-2.5">
        <div className="min-w-0 flex-1 truncate font-medium text-ink">{data.name}</div>
        {place.cell && (
          <span className="text-ink-3 text-sm">
            {place.sheet ? `${place.sheet}, ` : ''}cell {place.cell}
          </span>
        )}
        <Button
          size="sm"
          onClick={() => window.open(api.fileUrl(data.hash), '_blank', 'noreferrer')}
        >
          <Download className="size-3.25" />
          The file
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {data.kind === 'sheet' && <Sheet data={data} place={place} />}
        {data.kind === 'pdf' && <Pages data={data} place={place} />}
        {data.kind === 'text' && <Lines data={data} line={place.line} />}
        {data.kind === 'reading' && (
          <p className="p-6 text-ink-3">
            Alpha is still reading this file; it shows here when it is read.
          </p>
        )}
        {data.kind === 'kept' && (
          <p className="p-6 text-ink-3">
            Alpha keeps this file but does not read its kind yet. Open the file to see it.
          </p>
        )}
      </div>
    </div>
  )
}

function Sheet({ data, place }: { data: FileData; place: FilePlace }) {
  const sheets = data.sheets ?? []
  const [name, setName] = useState(place.sheet ?? sheets[0]?.name ?? '')
  useEffect(() => setName(place.sheet ?? sheets[0]?.name ?? ''), [place.sheet, sheets])
  const marked = useRef<HTMLTableCellElement>(null)
  const sheet = sheets.find((s) => s.name === name) ?? sheets[0]
  useEffect(() => {
    marked.current?.scrollIntoView({ block: 'center', inline: 'nearest' })
  }, [sheet])
  if (!sheet) return null
  const rows = Math.max(0, ...sheet.cells.map((c) => c.row))
  const cols = Math.max(0, ...sheet.cells.map((c) => c.col))
  const at = new Map(sheet.cells.map((c) => [`${c.row}:${c.col}`, c.words]))
  const here = sheet.name === place.sheet ? place.cell : null
  return (
    <div className="flex flex-col">
      {sheets.length > 1 && (
        <div className="sticky top-0 left-0 z-2 flex w-full gap-1 border-line border-b bg-canvas px-6 py-1.5">
          {sheets.map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => setName(s.name)}
              className={cn(
                'rounded-sm px-2 py-0.5 text-sm',
                s.name === sheet.name ? 'bg-accent-soft text-accent' : 'text-ink-3 hover:bg-hover',
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <table className="border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky top-0 left-0 z-1 border-line border-r border-b bg-sunken" />
            {Array.from({ length: cols }, (_, i) => (
              <th
                key={i}
                className="sticky top-0 border-line border-r border-b bg-sunken px-2 py-1 font-normal text-ink-3"
              >
                {letters(i + 1)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              <th className="sticky left-0 border-line border-r border-b bg-sunken px-2 py-1 text-right font-normal text-ink-3 tabular-nums">
                {r + 1}
              </th>
              {Array.from({ length: cols }, (_, c) => {
                const ref = `${letters(c + 1)}${r + 1}`
                const mine = ref === here
                return (
                  <td
                    key={c}
                    ref={mine ? marked : undefined}
                    title={at.get(`${r + 1}:${c + 1}`)}
                    className={cn(
                      'max-w-80 truncate border-hair border-r border-b px-2 py-1 text-ink',
                      mine && 'bg-accent-soft outline-2 outline-accent -outline-offset-2',
                    )}
                  >
                    {at.get(`${r + 1}:${c + 1}`) ?? ''}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Pages({ data, place }: { data: FileData; place: FilePlace }) {
  const pages = data.pages ?? 1
  const [page, setPage] = useState(place.page ?? 1)
  useEffect(() => setPage(place.page ?? 1), [place.page])
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  // the piece's box, a little wider than its words so the mark does not hide them
  const box: [number, number, number, number] | null =
    page === place.page && place.box
      ? [place.box[0] - 3, place.box[1] + 3, place.box[2] + 3, place.box[3] - 3]
      : null
  const marked = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (size) marked.current?.scrollIntoView({ block: 'center' })
  }, [size])
  // drawn at twice the page's points, so a box in points is half the picture's pixels
  const mark =
    box && size
      ? {
          left: `${((box[0] * 2) / size.w) * 100}%`,
          top: `${(((size.h / 2 - box[1]) * 2) / size.h) * 100}%`,
          width: `${(((box[2] - box[0]) * 2) / size.w) * 100}%`,
          height: `${(((box[1] - box[3]) * 2) / size.h) * 100}%`,
        }
      : null
  return (
    <div className="mx-auto flex max-w-page flex-col items-center gap-3 px-6 py-4">
      <div className="flex items-center gap-2 text-ink-3 text-sm">
        <IconButton label="The page before" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          <ChevronLeft className="size-3.5" />
        </IconButton>
        Page {page} of {pages}
        <IconButton
          label="The next page"
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
        >
          <ChevronRight className="size-3.5" />
        </IconButton>
      </div>
      <div className="relative w-full border border-line bg-surface shadow-sm">
        <img
          key={page}
          src={api.tokened(`/api/files/${data.hash}/page/${page}`)}
          alt={`Page ${page} of ${data.name}`}
          className="block w-full"
          onLoad={(e) =>
            setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
          }
        />
        {mark && (
          <div
            ref={marked}
            className="pointer-events-none absolute rounded-xs bg-accent-soft/40 outline-2 outline-accent"
            style={mark}
          />
        )}
      </div>
    </div>
  )
}

function Lines({ data, line }: { data: FileData; line: number | null }) {
  const marked = useRef<HTMLDivElement>(null)
  useEffect(() => marked.current?.scrollIntoView({ block: 'center' }), [])
  return (
    <div className="mx-auto max-w-page px-6 py-4 font-mono text-sm">
      {(data.lines ?? []).map((l) => (
        <div
          key={l.line}
          ref={l.line === line ? marked : undefined}
          className={cn('flex gap-3 px-2', l.line === line && 'bg-accent-soft')}
        >
          <span className="w-10 shrink-0 text-right text-ink-3 tabular-nums">{l.line}</span>
          <span className="whitespace-pre-wrap text-ink">{l.words}</span>
        </div>
      ))}
    </div>
  )
}
