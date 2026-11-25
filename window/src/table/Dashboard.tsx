// A table's dashboard row: one strip, about four lines tall, between the chips and the rows (Vikas,
// 25 Nov). Every tile is the same: what it counts, its number, a chart, and buttons that show those
// rows. Worked out from the rows the view shows, never fetched apart, and nothing at all when there
// is nothing to count. Its right-click hides it for this person; the table's ⋮ brings it back.
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

// The tiles, from the shape and the rows: how many, each choice (two at most), each sum (two at
// most), and the first date's week ahead.
export function tilesOf(
  rows: RowView[],
  total: number,
  fields: FieldView[],
  names: Record<string, string>,
  config: ViewConfig,
): Tile[] {
  if (total === 0) return []
  const rule = (r: FilterRule) => () => setRule(config, r)
  const sort = (f: FieldView) => () => ({
    ...config,
    sorts: [{ field: f.id, dir: 'desc' as const }],
  })
  // the choices that hold something, two at most: an empty one says nothing
  const choices = fields
    .filter((f) => f.kind === 'choice' && !f.many)
    .filter((f) => rows.some((r) => groupRows([r], f, names)[0]?.key))
    .slice(0, 2)
  const sums = fields.filter((f) => f.kind === 'money' || f.kind === 'number').slice(0, 2)
  const date = fields.find((f) => f.kind === 'date')
  const tiles: Tile[] = []

  tiles.push({
    key: 'rows',
    label: 'Rows',
    value: rows.length.toLocaleString(),
    ...(rows.length !== total ? { hint: `of ${total.toLocaleString()}` } : {}),
    ...(date
      ? {
          parts: groupRows(rows, date, names)
            .filter((g) => g.key)
            .sort((a, b) => a.key.localeCompare(b.key))
            .slice(-6)
            .map((g) => ({ label: g.label, value: g.rows.length })),
        }
      : {}),
    buttons: date ? [{ label: 'Newest first', pick: sort(date) }] : [],
  })

  for (const f of choices) {
    const groups = groupRows(rows, f, names).filter((g) => g.key)
    const top = [...groups].sort((a, b) => b.rows.length - a.rows.length)
    const parts = groups.map((g) => ({
      label: g.label,
      value: g.rows.length,
      pick: rule({ field: f.id, op: 'in', values: [g.key] }),
    }))
    tiles.push({
      key: f.id,
      label: f.name,
      value: `${top[0]?.rows.length ?? 0} ${top[0]?.label ?? ''}`,
      hint: `${groups.length} in use`,
      parts,
      buttons: top.slice(0, 3).map((g) => ({
        label: `${g.label} ${g.rows.length}`,
        pick: rule({ field: f.id, op: 'in', values: [g.key] }),
      })),
    })
  }

  for (const f of sums) {
    const values = rows.map((r) => numberOf(f, r.values[f.slug]))
    const known = values.filter((v): v is number => v !== null)
    if (!known.length) continue
    const sum = known.reduce((a, b) => a + b, 0)
    const currency =
      f.kind === 'money'
        ? ((rows.find((r) => r.values[f.slug])?.values[f.slug] as { currency?: string })
            ?.currency ?? 'USD')
        : null
    const words = (n: number) =>
      currency ? money(n, currency, true) : Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1)
    const empty = values.length - known.length
    const by = choices[0]
    tiles.push({
      key: f.id,
      label: `Total ${f.name.toLowerCase()}`,
      value: words(sum),
      hint: `avg ${words(sum / known.length)}`,
      ...(by
        ? {
            parts: groupRows(rows, by, names)
              .filter((g) => g.key)
              .map((g) => ({
                label: g.label,
                value: g.rows.reduce((n, r) => n + (numberOf(f, r.values[f.slug]) ?? 0), 0),
                pick: rule({ field: by.id, op: 'in', values: [g.key] }),
              })),
          }
        : {}),
      buttons: [
        { label: 'Largest first', pick: sort(f) },
        ...(empty ? [{ label: `Empty ${empty}`, pick: rule({ field: f.id, op: 'empty' }) }] : []),
      ],
    })
  }

  if (date) {
    const today = startOfToday()
    const at = rows.map((r) => numberOf(date, r.values[date.slug]))
    const week = at.filter((t) => t !== null && t >= today && t < today + 7 * DAY).length
    const before = at.filter((t) => t !== null && t < today).length
    const next = {
      field: date.id,
      op: 'between' as const,
      value: ymd(today),
      value2: ymd(today + 6 * DAY),
    }
    tiles.push({
      key: date.id,
      label: `${date.name}, next 7 days`,
      value: week.toLocaleString(),
      hint: `${before} before today`,
      buttons: [
        { label: 'Next 7 days', pick: rule(next) },
        ...(before
          ? [
              {
                label: 'Before today',
                pick: rule({
                  field: date.id,
                  op: 'between',
                  value: '1900-01-01',
                  value2: ymd(today - DAY),
                }),
              },
            ]
          : []),
      ],
    })
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

// One tile, four lines: what it counts, its number, its chart, its buttons
function TileCard({ tile, onConfig }: { tile: Tile; onConfig: (c: ViewConfig) => void }) {
  const sum = tile.parts?.reduce((a, p) => a + p.value, 0) ?? 0
  return (
    <div className="flex h-24 w-56 shrink-0 flex-col justify-between rounded-lg border border-line bg-surface px-3 py-2">
      <div className="truncate text-ink-3 text-sm">{tile.label}</div>
      <div className="flex items-baseline gap-2">
        <span className="truncate font-medium text-ink text-lg tabular-nums">{tile.value}</span>
        {tile.hint && <span className="truncate text-ink-3 text-sm">{tile.hint}</span>}
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-sunk">
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
      <div className="flex min-w-0 gap-1 overflow-hidden">
        {tile.buttons.map((b) => (
          <button
            key={b.label}
            type="button"
            onClick={() => onConfig(b.pick())}
            className="h-5.5 shrink-0 truncate rounded-full border border-line px-2 text-ink-2 text-xs hover:bg-hover hover:text-ink"
          >
            {b.label}
          </button>
        ))}
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
