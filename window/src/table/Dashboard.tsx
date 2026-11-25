// A table's dashboard row: one strip, about four lines tall, between the chips and the rows (Vikas,
// 25 Nov). Every tile is the same: its number, what it counts, a chart, and buttons that show those
// rows. Worked out from the rows the view shows, never fetched apart; only what says something, and
// nothing at all when nothing does. Its right-click hides it for this person; the table's ⋮ brings it back.
import type { FieldView, FilterRule, RowView, ViewConfig } from '@alpha/core/api'
import { EyeOff } from 'lucide-react'
import { type ReactNode, useMemo } from 'react'
import { useLayout } from '../layout.ts'
import { fill } from '../ui/chart.tsx'
import { MenuItem, Popover, useContextMenu } from '../ui/popover.tsx'
import { setRule } from './edits.ts'
import { groupRows, numberOf } from './engine.ts'
import { money } from './values.ts'

const DAY = 86_400_000
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10)
const startOfToday = () => new Date(new Date().toDateString()).getTime()

export interface Tile {
  key: string
  label: string
  value: string
  hint?: string
  parts?: { label: string; value: number; pick?: () => ViewConfig }[] // the chart, a segment each
  buttons: { label: string; pick: () => ViewConfig }[]
}

// The tiles, from the shape and the rows, only where they say something (Vikas, 25 Nov): a choice
// split two ways or more with none above nine in ten, a sum of two or more different numbers, and a
// date some rows hold ahead. How many rows there are is on the tab and at the foot already.
export const relevant = {
  choice: (counts: number[]) => {
    const all = counts.reduce((a, b) => a + b, 0)
    return counts.length >= 2 && Math.max(...counts) <= all * 0.9
  },
  sum: (known: number[]) => known.length >= 2 && new Set(known).size >= 2,
  date: (ahead: number) => ahead > 0,
}

export function tilesOf(
  rows: RowView[],
  total: number,
  fields: FieldView[],
  names: Record<string, string>,
  config: ViewConfig,
): Tile[] {
  if (total === 0 || rows.length === 0) return []
  const rule = (r: FilterRule) => () => setRule(config, r)
  const sort = (f: FieldView) => () => ({
    ...config,
    sorts: [{ field: f.id, dir: 'desc' as const }],
  })
  const tiles: Tile[] = []

  // each choice's groups, the ones that tell something, two at most
  const choices = fields
    .filter((f) => f.kind === 'choice' && !f.many)
    .map((f) => ({ f, groups: groupRows(rows, f, names).filter((g) => g.key) }))
    .filter((c) => relevant.choice(c.groups.map((g) => g.rows.length)))
    .slice(0, 2)
  for (const { f, groups } of choices) {
    const top = [...groups].sort((a, b) => b.rows.length - a.rows.length)
    const pick = (key: string) => rule({ field: f.id, op: 'in', values: [key] })
    tiles.push({
      key: f.id,
      label: f.name,
      value: (top[0]?.rows.length ?? 0).toLocaleString(),
      hint: `${top[0]?.label ?? ''}, the most of ${groups.length}`,
      parts: groups.map((g) => ({ label: g.label, value: g.rows.length, pick: pick(g.key) })),
      buttons: top.slice(0, 2).map((g) => ({ label: g.label, pick: pick(g.key) })),
    })
  }

  const by = choices[0]
  for (const f of fields.filter((x) => x.kind === 'money' || x.kind === 'number')) {
    if (tiles.length >= choices.length + 2) break
    const values = rows.map((r) => numberOf(f, r.values[f.slug]))
    const known = values.filter((v): v is number => v !== null)
    if (!relevant.sum(known)) continue
    const sum = known.reduce((a, b) => a + b, 0)
    const currency =
      f.kind === 'money'
        ? ((rows.find((r) => r.values[f.slug])?.values[f.slug] as { currency?: string })
            ?.currency ?? 'USD')
        : null
    const words = (n: number) =>
      currency ? money(n, currency, true) : Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1)
    const empty = values.length - known.length
    tiles.push({
      key: f.id,
      label: `Total ${f.name.toLowerCase()}`,
      value: words(sum),
      hint: `avg ${words(sum / known.length)}`,
      ...(by
        ? {
            parts: by.groups.map((g) => ({
              label: g.label,
              value: g.rows.reduce((n, r) => n + (numberOf(f, r.values[f.slug]) ?? 0), 0),
              pick: rule({ field: by.f.id, op: 'in', values: [g.key] }),
            })),
          }
        : {}),
      buttons: [
        { label: 'Largest first', pick: sort(f) },
        ...(empty ? [{ label: `Empty ${empty}`, pick: rule({ field: f.id, op: 'empty' }) }] : []),
      ],
    })
  }

  const date = fields.find((f) => f.kind === 'date')
  if (date) {
    const today = startOfToday()
    const at = rows.map((r) => numberOf(date, r.values[date.slug]))
    const ahead = at.filter((t) => t !== null && t >= today).length
    if (relevant.date(ahead)) {
      const week = at.filter((t) => t !== null && t >= today && t < today + 7 * DAY).length
      const between = (from: number, to: number) =>
        rule({ field: date.id, op: 'between', value: ymd(from), value2: ymd(to) })
      tiles.push({
        key: date.id,
        label: `${date.name}, next 7 days`,
        value: week.toLocaleString(),
        hint: `${ahead.toLocaleString()} ahead in all`,
        parts: [
          { label: 'Next 7 days', value: week, pick: between(today, today + 6 * DAY) },
          { label: 'Later', value: ahead - week },
        ],
        buttons: [{ label: 'Next 7 days', pick: between(today, today + 6 * DAY) }],
      })
    }
  }
  return tiles
}

// Whether this person shows a table's dashboard row, and the switch the ⋮ and the right-click use
export function useDashboard(table: string, on: boolean) {
  const { layout, change } = useLayout()
  const shown = on && !layout.dashboardHidden.includes(table)
  const onToggle = () =>
    change({
      dashboardHidden: shown
        ? [...layout.dashboardHidden, table]
        : layout.dashboardHidden.filter((t) => t !== table),
    })
  return { shown, onToggle }
}

export function Dashboard({
  rows,
  total,
  fields,
  names,
  config,
  onConfig,
  onHide,
}: {
  rows: RowView[]
  total: number
  fields: FieldView[]
  names: Record<string, string>
  config: ViewConfig
  onConfig: (c: ViewConfig) => void
  onHide: () => void
}) {
  const tiles = useMemo(
    () => tilesOf(rows, total, fields, names, config),
    [rows, total, fields, names, config],
  )
  const menu = useContextMenu()
  if (!tiles.length) return null
  return (
    <section
      aria-label="Dashboard"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: its right-click opens by the keyboard too
      tabIndex={0}
      {...menu.on}
      className="scroll-quiet flex shrink-0 gap-3 overflow-x-auto border-hair border-b px-4 py-2.5 outline-none"
    >
      {tiles.map((t) => (
        <TileCard key={t.key} tile={t} onConfig={onConfig} />
      ))}
      <Popover point={menu.point} open={menu.open} onClose={menu.close}>
        <MenuItem
          onClick={() => {
            menu.close()
            onHide()
          }}
        >
          <EyeOff className="size-3.5 text-ink-3" />
          Hide the dashboard row
        </MenuItem>
      </Popover>
    </section>
  )
}

// One tile, four lines (Vikas, 25 Nov): its number over the first two at the left, what it counts
// and a word more to the right of it; under them its chart at the left and its buttons at the right.
function TileCard({ tile, onConfig }: { tile: Tile; onConfig: (c: ViewConfig) => void }) {
  const sum = tile.parts?.reduce((a, p) => a + p.value, 0) ?? 0
  return (
    <div className="flex h-24 min-w-58 max-w-sm flex-1 flex-col justify-between rounded-lg border border-line bg-surface px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0 font-medium font-serif text-2xl text-ink leading-none tabular-nums">
          {tile.value}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-ink text-sm">{tile.label}</span>
          {tile.hint && <span className="truncate text-ink-3 text-sm">{tile.hint}</span>}
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-2 min-w-8 flex-1 overflow-hidden rounded-full bg-sunk">
          {sum > 0 &&
            tile.parts?.map((p, i) =>
              segment(
                p.label,
                (p.value / sum) * 100,
                i,
                p.pick && (() => onConfig((p.pick as () => ViewConfig)())),
              ),
            )}
        </div>
        <div className="ml-auto flex shrink-0 gap-1">
          {tile.buttons.map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={() => onConfig(b.pick())}
              className="h-6 max-w-28 truncate rounded-full border border-line px-2 text-ink-2 text-xs hover:bg-hover hover:text-ink"
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const segment = (label: string, width: number, i: number, pick?: () => void): ReactNode =>
  pick ? (
    <button
      key={label}
      type="button"
      aria-label={`Show ${label}`}
      data-tip={label}
      onClick={pick}
      className="h-full hover:opacity-75"
      style={{ width: `${width}%`, background: fill(i) }}
    />
  ) : (
    <span
      key={label}
      data-tip={label}
      className="h-full"
      style={{ width: `${width}%`, background: fill(i) }}
    />
  )
