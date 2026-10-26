// The metric strip over a table (Vikas, 25 Oct): a few tiles
// counted from what the table already holds: its rows, its first state field's choices (a red
// icon where the choice says something is wrong), and the rows holding a value Alpha guessed.
import type { FieldView, RowView } from '@alpha/core/api'
import { CircleAlert, CircleDot, Rows3, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../ui/cn.ts'

export function Metrics({ rows, fields }: { rows: RowView[]; fields: FieldView[] }) {
  const state =
    fields.find((f) => f.kind === 'choice' && Object.keys(f.tones).length) ??
    fields.find((f) => f.kind === 'choice')
  const guessed = rows.filter((r) =>
    Object.values(r.sources).some((s) => s?.kind === 'estimated' || s?.kind === 'assumed'),
  ).length
  const tiles: { label: string; n: number; icon: ReactNode; bad?: boolean }[] = [
    { label: 'Rows', n: rows.length, icon: <Rows3 className="size-4" /> },
    ...(state?.choices.slice(0, 3).map((c) => {
      const bad = state.tones[c] === 'bad' || state.tones[c] === 'warn'
      return {
        label: c,
        n: rows.filter((r) => r.values[state.slug] === c).length,
        icon: bad ? <CircleAlert className="size-4" /> : <CircleDot className="size-4" />,
        bad,
      }
    }) ?? []),
    { label: 'Guessed by Alpha', n: guessed, icon: <Sparkles className="size-4" /> },
  ]
  return (
    <div className="flex gap-3 overflow-x-auto px-7 pt-3">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="flex min-w-36 items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2"
        >
          <span
            className={cn(
              'grid size-8 shrink-0 place-items-center rounded-md',
              t.bad && t.n > 0 ? 'bg-bad-soft text-bad' : 'bg-accent-soft text-accent',
            )}
          >
            {t.icon}
          </span>
          <div className="min-w-0">
            <div className="truncate text-ink-3 text-sm">{t.label}</div>
            <div className="font-serif text-ink text-xl tabular-nums">{t.n}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
