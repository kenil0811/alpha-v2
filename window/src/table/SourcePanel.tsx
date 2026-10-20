import type { FieldView, HistoryView, RowView } from '@alpha/core/api'
import { ExternalLink, FileText } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { api, Problem } from '../api.ts'
import { Button } from '../ui/button.tsx'
import { cn } from '../ui/cn.ts'
import { Field, Select } from '../ui/field.tsx'
import { Pill } from '../ui/pill.tsx'
import { SidePanel } from '../ui/side-panel.tsx'
import { CORRECTABLE, KIND_TONE, KIND_WORDS, MARK, show, when } from './values.ts'

// The source panel: one value, where it came from, and its history; Correct it makes the value
// the person's own word. A value they typed over keeps Alpha's figure beside it, with Reset.
export function SourcePanel({
  tableId,
  row,
  field,
  rowName,
  names,
  onClose,
}: {
  tableId: string
  row: RowView
  field: FieldView
  rowName: string
  names: Record<string, string>
  onClose: () => void
}) {
  const value = row.values[field.slug]
  const source = row.sources[field.slug]
  const text = show(field, value, names)
  const [history, setHistory] = useState<HistoryView[]>([])
  const [correcting, setCorrecting] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const reset = async () => {
    setProblem(null)
    try {
      await api.post(`/api/tables/${tableId}/rows/${row.id}/reset`, { field: field.name })
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That was not reset.')
    }
  }
  useEffect(() => {
    setCorrecting(false)
    api
      .get<HistoryView[]>(`/api/tables/${tableId}/rows/${row.id}/history?field=${field.slug}`)
      .then(setHistory, () => setHistory([]))
  }, [tableId, row.id, field.slug, row.values[field.slug]])
  const open = source?.open
  return (
    <SidePanel title={field.name} onClose={onClose}>
      <div className="flex flex-col gap-3.5 p-4.5">
        <div>
          <div
            className={cn(
              'flex items-start gap-1 font-medium font-serif text-ink tabular-nums',
              text.length > 18 ? 'text-xl' : 'text-2xl',
            )}
          >
            <span className="min-w-0 break-words">{text || 'None given'}</span>
            {source && MARK[source.kind] && (
              <span className="pt-1 font-bold font-sans text-sm text-warn">
                {MARK[source.kind]}
              </span>
            )}
          </div>
          {rowName && <div className="mt-1 truncate text-ink-3 text-sm">{rowName}</div>}
        </div>
        {source ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={KIND_TONE[source.kind]}>{KIND_WORDS[source.kind]}</Pill>
              <span className="text-ink-3 text-sm">{when(source.at)}</span>
            </div>
            <p className="text-ink text-md leading-relaxed">{source.words}</p>
            {source.note && (
              <div className="whitespace-pre-wrap rounded-md bg-sunk px-3 py-2.5 font-mono text-ink text-sm tabular-nums leading-relaxed">
                {source.note}
              </div>
            )}
            {source.beside && (
              <div className="flex flex-col gap-2 rounded-md border border-line px-3 py-2.5">
                <div className="flex items-baseline gap-2">
                  <span className="flex-1 text-ink-2 text-sm">{source.beside.words}</span>
                  <span className="font-medium text-ink tabular-nums">
                    {show(field, source.beside.value, names)}
                  </span>
                </div>
                {source.beside.note && (
                  <div className="whitespace-pre-wrap font-mono text-ink-3 text-sm tabular-nums">
                    {source.beside.note}
                  </div>
                )}
                <div>
                  <Button size="sm" onClick={reset}>
                    Reset to Alpha's figure
                  </Button>
                </div>
                {problem && <div className="text-bad text-sm">{problem}</div>}
              </div>
            )}
          </>
        ) : (
          <p className="text-ink-3 text-md">Nothing is kept here yet.</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {open && 'url' in open && (
            <Button size="sm" onClick={() => window.open(open.url, '_blank', 'noreferrer')}>
              <ExternalLink className="size-3.25" />
              Open the page
            </Button>
          )}
          {open && 'file' in open && (
            <Button
              size="sm"
              onClick={() => window.open(api.fileUrl(open.file), '_blank', 'noreferrer')}
            >
              <FileText className="size-3.25" />
              Open the file{open.cell ? ` at ${open.cell}` : ''}
            </Button>
          )}
          {CORRECTABLE.has(field.kind) && !correcting && (
            <Button size="sm" variant="ghost" onClick={() => setCorrecting(true)}>
              Correct it
            </Button>
          )}
        </div>
        {correcting && (
          <Correct
            tableId={tableId}
            rowId={row.id}
            field={field}
            value={value}
            onDone={() => setCorrecting(false)}
          />
        )}
        {history.length > 1 && (
          <div>
            <div className="font-semibold text-ink-3 text-xs uppercase tracking-label">History</div>
            <ol className="mt-1.5">
              {history.map((h, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[84px_1fr] gap-x-2.5 gap-y-0.5 border-hair border-t py-2 text-sm"
                >
                  <span className="row-span-2 text-ink-3 tabular-nums">
                    {h.source ? when(h.source.at) : ''}
                  </span>
                  <span className="font-medium text-ink tabular-nums">
                    {show(field, h.value, names)}
                  </span>
                  <span className="text-ink-3">
                    {h.source ? KIND_WORDS[h.source.kind] : ''}
                    {i === 0 ? ' · now' : ''}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </SidePanel>
  )
}

// Correct it: the value as the person types it, read for its kind, saved as their word.
function Correct({
  tableId,
  rowId,
  field,
  value,
  onDone,
}: {
  tableId: string
  rowId: string
  field: FieldView
  value: unknown
  onDone: () => void
}) {
  const start =
    field.kind === 'money' && value && typeof value === 'object'
      ? String((value as { amount: number }).amount)
      : value === null || value === undefined
        ? ''
        : String(value)
  const [typed, setTyped] = useState(start)
  const [problem, setProblem] = useState<string | null>(null)
  const save = async (e: FormEvent) => {
    e.preventDefault()
    setProblem(null)
    const t = typed.trim()
    const amount = Number(t.replace(/[$,\s]/g, ''))
    const read =
      field.kind === 'money'
        ? {
            amount,
            currency:
              (value && typeof value === 'object' && (value as { currency?: string }).currency) ||
              'USD',
          }
        : field.kind === 'number'
          ? amount
          : t
    if ((field.kind === 'money' || field.kind === 'number') && Number.isNaN(amount)) {
      setProblem('That is not a number.')
      return
    }
    try {
      await api.post(`/api/tables/${tableId}/rows/${rowId}`, { field: field.name, value: read })
      onDone()
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That was not saved.')
    }
  }
  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      {field.kind === 'choice' ? (
        <Select value={typed} onChange={(e) => setTyped(e.target.value)} aria-label={field.name}>
          {field.choices.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      ) : (
        <Field
          autoFocus
          value={typed}
          aria-label={field.name}
          type={field.kind === 'date' ? 'date' : 'text'}
          onChange={(e) => setTyped(e.target.value)}
        />
      )}
      {problem && <div className="text-bad text-sm">{problem}</div>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="primary">
          Save as yours
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
