// A row opened: every field with its value and mark, each opening to where it came from, and the
// pages and files its values were read from.
import type { FieldView, RowView } from '@alpha/core/api'
import { ExternalLink, FileText } from 'lucide-react'
import { api } from '../api.ts'
import { Button } from '../ui/button.tsx'
import { cn } from '../ui/cn.ts'
import { SidePanel } from '../ui/side-panel.tsx'
import { KIND_WORDS, MARK, show } from './values.ts'

export function RowPanel({
  row,
  fields,
  names,
  title,
  onField,
  onClose,
}: {
  row: RowView
  fields: FieldView[]
  names: Record<string, string>
  title: string
  onField: (slug: string) => void
  onClose: () => void
}) {
  // the places its values came from, once each
  const places = new Map<string, { url?: string; file?: string; label: string }>()
  for (const s of Object.values(row.sources)) {
    const o = s?.open
    if (!o) continue
    if ('url' in o && URL.canParse(o.url))
      places.set(o.url, { url: o.url, label: new URL(o.url).host })
    if ('file' in o) places.set(o.file, { file: o.file, label: o.sheet ?? 'The file' })
  }
  return (
    <SidePanel title={title || 'A row'} onClose={onClose}>
      <dl className="flex flex-col">
        {fields.map((f) => {
          const source = row.sources[f.slug]
          const text = show(f, row.values[f.slug], names)
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onField(f.slug)}
              className="flex flex-col gap-0.5 border-hair border-b px-4.5 py-2.5 text-left hover:bg-hover"
            >
              <dt className="flex items-center gap-2 text-ink-3 text-sm">
                {f.name}
                {source && <span className="text-xs">{KIND_WORDS[source.kind]}</span>}
              </dt>
              <dd
                className={cn(
                  'whitespace-pre-wrap break-words text-md',
                  text ? 'text-ink' : 'text-ink-3',
                  source && MARK[source.kind] && 'italic',
                )}
              >
                {text || 'None given'}
                {source && MARK[source.kind] && (
                  <span className="ml-1 font-bold text-warn text-xs not-italic">
                    {MARK[source.kind]}
                  </span>
                )}
              </dd>
            </button>
          )
        })}
      </dl>
      {places.size > 0 && (
        <div className="flex flex-col gap-2 p-4.5">
          <div className="font-semibold text-ink-3 text-xs uppercase tracking-label">Read from</div>
          <div className="flex flex-wrap gap-1.5">
            {[...places.values()].map((p) => (
              <Button
                key={p.url ?? p.file}
                size="sm"
                onClick={() =>
                  window.open(p.url ?? api.fileUrl(p.file as string), '_blank', 'noreferrer')
                }
              >
                {p.url ? (
                  <ExternalLink className="size-3.25" />
                ) : (
                  <FileText className="size-3.25" />
                )}
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </SidePanel>
  )
}
