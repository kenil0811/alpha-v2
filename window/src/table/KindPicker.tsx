// How the rows are shown, and what that view goes by (a board's choice, a calendar's date, a
// chart's bars and what they add up). The standard views (Vikas, 25 Oct) are Table, Card,
// Timeline and Calendar, with Board and Form; each is offered when the table has what it needs.
// List comes after Table. Chart is no longer offered, but a view saved as one still opens as it was.
import type { FieldView, RowView, ViewConfig, ViewKind } from '@alpha/core/api'
import {
  CalendarDays,
  ChartBarBig,
  ChartGantt,
  ChevronDown,
  ClipboardList,
  Kanban,
  LayoutGrid,
  List,
  Table2,
} from 'lucide-react'
import { type ReactNode, useRef, useState } from 'react'
import { Select } from '../ui/field.tsx'
import { MenuItem, Popover } from '../ui/popover.tsx'

const KINDS: { kind: ViewKind; words: string; icon: ReactNode }[] = [
  { kind: 'table', words: 'Table', icon: <Table2 className="size-3.5" /> },
  { kind: 'list', words: 'List', icon: <List className="size-3.5" /> },
  { kind: 'gallery', words: 'Card', icon: <LayoutGrid className="size-3.5" /> },
  { kind: 'timeline', words: 'Timeline', icon: <ChartGantt className="size-3.5" /> },
  { kind: 'calendar', words: 'Calendar', icon: <CalendarDays className="size-3.5" /> },
  { kind: 'board', words: 'Board', icon: <Kanban className="size-3.5" /> },
  { kind: 'form', words: 'Form', icon: <ClipboardList className="size-3.5" /> },
  { kind: 'chart', words: 'Chart', icon: <ChartBarBig className="size-3.5" /> },
]

// what the picker offers: all but Chart, kept only to name a view saved as one
const OFFERED = KINDS.slice(0, 7)

export function KindPicker({
  fields,
  rows,
  config,
  onConfig,
}: {
  fields: FieldView[]
  rows: RowView[]
  config: ViewConfig
  onConfig: (c: ViewConfig) => void
}) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  const choices = fields.filter(
    (f) => f.kind === 'choice' && !f.many && !f.summary && f.choices.length,
  )
  const dates = fields.filter((f) => f.kind === 'date')
  const numbers = fields.filter((f) => f.kind === 'number' || f.kind === 'money')
  const groupable = [...choices, ...fields.filter((f) => f.kind === 'text')]
  const can = (k: ViewKind) =>
    k === 'board'
      ? choices.length > 0
      : k === 'calendar' || k === 'timeline'
        ? dates.length > 0
        : k === 'chart'
          ? choices.length > 0 || dates.length > 0
          : true
  // why a view can't show this table, said on the greyed line
  const why = (k: ViewKind) =>
    can(k)
      ? undefined
      : k === 'board'
        ? 'A board needs a choice column. Ask Alpha to add one.'
        : k === 'chart'
          ? 'A chart needs a choice or a date column. Ask Alpha to add one.'
          : `A ${k} needs a date column. Ask Alpha to add one.`
  const current = KINDS.find((k) => k.kind === config.kind) ?? KINDS[0]
  // switching to a view that needs a field gives it one, as the core would
  // a calendar or timeline starts on the date most rows have; a board's columns and a chart's bars
  // are left to the person (the table shows Stage, or the first choice, until they choose)
  const switchTo = (kind: ViewKind) => {
    const next = { ...config, kind }
    if ((kind === 'calendar' || kind === 'timeline') && !dates.some((f) => f.id === next.by)) {
      const filled = (f: FieldView) => rows.filter((r) => r.values[f.slug]).length
      next.by = [...dates].sort((a, b) => filled(b) - filled(a))[0]?.id ?? null
    }
    onConfig(next)
  }
  const pick = (
    label: string,
    value: string,
    options: FieldView[],
    set: (id: string) => void,
    none?: string,
  ) => (
    <Select
      aria-label={label}
      value={value}
      onChange={(e) => set(e.target.value)}
      className="h-7.5 max-w-44 text-md"
    >
      {none !== undefined && <option value="">{none}</option>}
      {options.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
        </option>
      ))}
    </Select>
  )
  return (
    <span className="flex items-center gap-2">
      <button
        ref={anchor}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-7.5 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-ink text-md hover:bg-hover"
      >
        {current?.icon}
        {current?.words}
        <ChevronDown className="size-3.5 text-ink-3" />
      </button>
      {config.kind === 'board' &&
        pick(
          'The board’s columns',
          config.group ?? (choices.find((f) => f.name === 'Stage') ?? choices[0])?.id ?? '',
          choices,
          (id) => onConfig({ ...config, group: id }),
        )}
      {(config.kind === 'calendar' || config.kind === 'timeline') &&
        pick('The date it is laid on', config.by ?? '', dates, (id) =>
          onConfig({ ...config, by: id }),
        )}
      {config.kind === 'chart' && (
        <>
          <Select
            aria-label="The bars go by"
            value={
              config.group
                ? `g:${config.group}`
                : config.by
                  ? `d:${config.by}`
                  : `g:${(choices.find((f) => f.name === 'Stage') ?? choices[0])?.id ?? ''}`
            }
            onChange={(e) => {
              const [k, id] = e.target.value.split(':')
              onConfig({
                ...config,
                group: k === 'g' ? (id ?? null) : null,
                by: k === 'd' ? (id ?? null) : null,
              })
            }}
            className="h-7.5 max-w-44 text-md"
          >
            {groupable.map((f) => (
              <option key={f.id} value={`g:${f.id}`}>
                By {f.name}
              </option>
            ))}
            {dates.map((f) => (
              <option key={f.id} value={`d:${f.id}`}>
                By month of {f.name}
              </option>
            ))}
          </Select>
          {pick(
            'What the bars add up',
            config.measure ?? '',
            numbers,
            (id) => onConfig({ ...config, measure: id || null }),
            'Rows',
          )}
        </>
      )}
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} align="end">
        {OFFERED.map((k) => (
          <MenuItem
            key={k.kind}
            checked={k.kind === config.kind}
            reason={why(k.kind)}
            onClick={() => {
              setOpen(false)
              switchTo(k.kind)
            }}
          >
            <span className="text-ink-3">{k.icon}</span>
            {k.words}
          </MenuItem>
        ))}
      </Popover>
    </span>
  )
}
