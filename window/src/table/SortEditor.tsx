// The sorts of a view, in order: each one's column and direction, moved up or down, taken away;
// another added; all cleared. Each change shows at once.
import type { FieldView, ViewConfig } from '@alpha/core/api'
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import { Button, IconButton } from '../ui/button.tsx'
import { Select } from '../ui/field.tsx'
import { family } from './engine.ts'

const words = (f: FieldView | undefined, dir: 'asc' | 'desc') => {
  const fam = f ? family(f.kind) : 'text'
  if (fam === 'number') return dir === 'asc' ? 'Smallest first' : 'Largest first'
  if (fam === 'date') return dir === 'asc' ? 'Oldest first' : 'Newest first'
  return dir === 'asc' ? 'A to Z' : 'Z to A'
}

export function SortEditor({
  fields,
  config,
  onConfig,
}: {
  fields: FieldView[]
  config: ViewConfig
  onConfig: (c: ViewConfig) => void
}) {
  const sorts = config.sorts
  const set = (next: ViewConfig['sorts']) => onConfig({ ...config, sorts: next })
  const free = fields.filter((f) => !sorts.some((s) => s.field === f.id))
  const swap = (i: number, j: number) => {
    const next = [...sorts]
    ;[next[i], next[j]] = [next[j] as (typeof next)[0], next[i] as (typeof next)[0]]
    set(next)
  }
  return (
    <div className="flex w-96 flex-col gap-2 p-1.5">
      <div className="font-medium text-ink">Sort</div>
      {sorts.length === 0 && <p className="text-ink-3 text-sm">Not sorted.</p>}
      {sorts.map((s, i) => {
        const f = fields.find((x) => x.id === s.field)
        return (
          <div key={s.field} className="flex items-center gap-1.5">
            <span className="w-12 shrink-0 text-ink-3 text-sm">{i === 0 ? 'Sort by' : 'then'}</span>
            <Select
              aria-label="Sort by"
              className="min-w-0 flex-1"
              value={s.field}
              onChange={(e) =>
                set(sorts.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))
              }
            >
              {[f, ...free].filter(Boolean).map((x) => (
                <option key={x?.id} value={x?.id}>
                  {x?.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Direction"
              className="w-32"
              value={s.dir}
              onChange={(e) =>
                set(
                  sorts.map((x, j) =>
                    j === i ? { ...x, dir: e.target.value as 'asc' | 'desc' } : x,
                  ),
                )
              }
            >
              <option value="asc">{words(f, 'asc')}</option>
              <option value="desc">{words(f, 'desc')}</option>
            </Select>
            <IconButton
              label={`Move ${f?.name} up`}
              disabled={i === 0}
              onClick={() => swap(i, i - 1)}
            >
              <ArrowUp className="size-3.5" />
            </IconButton>
            <IconButton
              label={`Move ${f?.name} down`}
              disabled={i === sorts.length - 1}
              onClick={() => swap(i, i + 1)}
            >
              <ArrowDown className="size-3.5" />
            </IconButton>
            <IconButton
              label={`Stop sorting by ${f?.name}`}
              onClick={() => set(sorts.filter((_, j) => j !== i))}
            >
              <X className="size-3.5" />
            </IconButton>
          </div>
        )
      })}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          disabled={!free.length}
          className="disabled:pointer-events-auto"
          data-tip={free.length ? undefined : 'Every column is already sorted.'}
          onClick={() => free[0] && set([...sorts, { field: free[0].id, dir: 'asc' }])}
        >
          <Plus className="size-3.25" />
          {sorts.length ? 'Add a tie-breaker' : 'Add sort'}
        </Button>
        {sorts.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => set([])}>
            Clear sorts
          </Button>
        )}
      </div>
    </div>
  )
}
