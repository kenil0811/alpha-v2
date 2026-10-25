// The table view's grid: one scrolling list drawn as it scrolls (TanStack Virtual), with a sticky
// header and name column, columns that resize by their edge, sort by a click (shift for a second
// level), a menu in each header, groups that fold, and totals along the foot. Rows are ticked to
// act on many; a value is changed in place (double-click, Enter or F2) as the person's word; a
// block pasted from a spreadsheet fills across and down; + at the end adds a field.
import type { FieldView, RowView, ViewConfig } from '@alpha/core/api'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Filter,
  ListChecks,
  PanelRightOpen,
  Plus,
} from 'lucide-react'
import {
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { api, Problem } from '../api.ts'
import { Button } from '../ui/button.tsx'
import { cn } from '../ui/cn.ts'
import { Field, Select } from '../ui/field.tsx'
import { Pill } from '../ui/pill.tsx'
import { MenuItem, MenuLine, Popover } from '../ui/popover.tsx'
import { ColumnMenu } from './ColumnMenu.tsx'
import { cycleSort, setTotal, setWidth } from './edits.ts'
import {
  family,
  type Group,
  groupRows,
  TOTAL_WORDS,
  TOTALS,
  tintOf,
  toneOf,
  total,
  widthOf,
} from './engine.ts'
import { CORRECTABLE, DOT, INK, MARK, NUMERIC, readValue, show, TINT, typedOf } from './values.ts'

type Item = { kind: 'group'; group: Group } | { kind: 'row'; row: RowView }

// What a paste would do, for the person's yes: values by field name, per row and for new rows.
export interface PastePlan {
  set: { row: string; values: Record<string, unknown> }[]
  add: { values: Record<string, unknown> }[]
  problems: string[]
  skipped: string[] // fields that are set by asking Alpha
}

const TICK = 36 // the ticks' column
const ADD = 44 // the + column

export function Grid({
  tableId,
  rows,
  allRows,
  fields,
  shown,
  config,
  names,
  tasks,
  picked,
  openRow,
  ticked,
  onPick,
  onConfig,
  onTick,
  onEdit,
  onOpen,
  onPaste,
  onNew,
  counted,
}: {
  tableId: string
  rows: RowView[] // filtered and sorted
  allRows: RowView[] // for a filter's counts
  fields: FieldView[]
  shown: FieldView[]
  config: ViewConfig
  names: Record<string, string>
  tasks: Record<string, number> // open tasks on each row
  picked: { row: string; field: string } | null
  openRow: string | null
  ticked: Set<string>
  onPick: (p: { row: string; field: string }) => void
  onConfig: (c: ViewConfig) => void
  onTick: (ids: Set<string>) => void
  onEdit: (row: RowView, field: FieldView, value: unknown) => Promise<boolean>
  onOpen: (row: string) => void
  onPaste: (plan: PastePlan) => void
  onNew: (() => void) | string // adds a row, or why one can't be added here
  counted?: RowView[] // what the footer totals: every row the view holds, not only this page
}) {
  const box = useRef<HTMLDivElement>(null)
  const [folded, setFolded] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<{ row: string; field: string } | null>(null)
  // A first click opens the source panel a moment later, so a double-click can change the value
  // instead (the panel would push the table and move the cell under the second click). With the
  // panel already open, a click shows the new value at once.
  const soon = useRef<number | undefined>(undefined)
  const at = useRef<{ row: string; field: string } | null>(null) // the cell last clicked, at once
  const pick = (p: { row: string; field: string }) => {
    at.current = p
    window.clearTimeout(soon.current)
    if (picked) onPick(p)
    else soon.current = window.setTimeout(() => onPick(p), 250)
  }
  const startEditing = (p: { row: string; field: string }) => {
    window.clearTimeout(soon.current)
    setEditing(p)
  }
  const groupField = fields.find((f) => f.id === config.group)
  const groups = useMemo(
    () => (groupField ? groupRows(rows, groupField, names) : null),
    [rows, groupField, names],
  )
  const items: Item[] = useMemo(
    () =>
      groups
        ? groups.flatMap((g) => [
            { kind: 'group' as const, group: g },
            ...(folded.has(g.key) ? [] : g.rows.map((row) => ({ kind: 'row' as const, row }))),
          ])
        : rows.map((row) => ({ kind: 'row' as const, row })),
    [groups, rows, folded],
  )
  // the rows in the order they are drawn, for a paste going down
  const drawn = useMemo(() => items.flatMap((x) => (x.kind === 'row' ? [x.row] : [])), [items])
  const virtual = useVirtualizer({
    count: items.length,
    getScrollElement: () => box.current,
    estimateSize: (i) => (items[i]?.kind === 'group' ? 37 : 39),
    overscan: 12,
  })
  useEffect(() => {
    if (!openRow) return
    const i = items.findIndex((x) => x.kind === 'row' && x.row.id === openRow)
    if (i >= 0) virtual.scrollToIndex(i, { align: 'center' })
  }, [openRow, items, virtual])

  const widths = shown.map((f, i) => widthOf(f, config, i === 0))
  const width = TICK + widths.reduce((a, b) => a + b, 0) + ADD
  const vitems = virtual.getVirtualItems()
  const top = vitems[0]?.start ?? 0
  const bottom = virtual.getTotalSize() - (vitems.at(-1)?.end ?? 0)
  const span = shown.length + 2
  const all = rows.length > 0 && rows.every((r) => ticked.has(r.id))
  const some = !all && rows.some((r) => ticked.has(r.id))

  // A block from a spreadsheet, from the picked value across and down; lines past the last row
  // become new rows. Nothing is written until the person says yes.
  const paste = (e: ClipboardEvent<HTMLDivElement>) => {
    const from = at.current ?? picked
    if (!from || editing) return
    const text = e.clipboardData.getData('text/plain')
    if (!text) return
    e.preventDefault()
    const lines = text.replace(/\r/g, '').split('\n')
    if (lines.at(-1) === '') lines.pop()
    const cells = lines.map((l) => l.split('\t').map((c) => c.replace(/^"(.*)"$/s, '$1')))
    const startRow = drawn.findIndex((r) => r.id === from.row)
    const startCol = shown.findIndex((f) => f.slug === from.field)
    if (startRow < 0 || startCol < 0) return
    const plan: PastePlan = { set: [], add: [], problems: [], skipped: [] }
    cells.forEach((line, i) => {
      const row = drawn[startRow + i]
      const values: Record<string, unknown> = {}
      line.forEach((cell, j) => {
        const f = shown[startCol + j]
        if (!f) return
        if (!CORRECTABLE.has(f.kind)) {
          if (!plan.skipped.includes(f.name)) plan.skipped.push(f.name)
          return
        }
        if (!cell.trim()) return
        const read = readValue(f, cell, row?.values[f.slug])
        if ('problem' in read) plan.problems.push(read.problem)
        else values[f.name] = read.value
      })
      if (!Object.keys(values).length) return
      if (row) plan.set.push({ row: row.id, values })
      else plan.add.push({ values })
    })
    onPaste(plan)
  }

  return (
    <div
      ref={box}
      onPaste={paste}
      className="mx-7 mb-6 min-h-0 flex-1 overflow-auto rounded-lg border border-line bg-surface"
    >
      <table className="table-fixed border-separate border-spacing-0 text-md" style={{ width }}>
        <colgroup>
          <col style={{ width: TICK }} />
          {shown.map((f, i) => (
            <col key={f.id} style={{ width: widths[i] }} />
          ))}
          <col style={{ width: ADD }} />
        </colgroup>
        <thead>
          <tr>
            <th className="sticky top-0 left-0 z-30 h-9 border-line border-b bg-surface p-0">
              <Tick
                label={all ? 'Untick every row' : 'Tick every row shown'}
                checked={all}
                mixed={some}
                onChange={(on) => onTick(on ? new Set(rows.map((r) => r.id)) : new Set())}
              />
            </th>
            {shown.map((f, i) => (
              <Header
                key={f.id}
                tableId={tableId}
                field={f}
                first={i === 0}
                config={config}
                shown={shown}
                rows={allRows}
                names={names}
                width={widths[i] as number}
                onConfig={onConfig}
              />
            ))}
            <th className="sticky top-0 z-10 h-9 border-line border-b bg-surface p-0">
              <AddField tableId={tableId} />
            </th>
          </tr>
        </thead>
        <tbody>
          {top > 0 && (
            <tr>
              <td colSpan={span} style={{ height: top }} />
            </tr>
          )}
          {vitems.map((v) => {
            const item = items[v.index]
            if (!item) return null
            if (item.kind === 'group')
              return (
                <GroupRow
                  key={`g${item.group.key}`}
                  group={item.group}
                  shown={shown}
                  config={config}
                  names={names}
                  folded={folded.has(item.group.key)}
                  onFold={() =>
                    setFolded((s) => {
                      const n = new Set(s)
                      if (n.has(item.group.key)) n.delete(item.group.key)
                      else n.add(item.group.key)
                      return n
                    })
                  }
                />
              )
            const r = item.row
            const tint = tintOf(config, fields, r)
            const on = ticked.has(r.id)
            const bg = on ? 'bg-accent-soft' : tint ? TINT[tint] : 'bg-surface'
            return (
              <tr
                key={r.id}
                id={`row-${r.id}`}
                className={cn('group/row', r.id === openRow && '[&>td]:bg-accent-soft')}
              >
                <td
                  className={cn(
                    'sticky left-0 z-1 border-hair border-b p-0 group-hover/row:bg-hover',
                    bg,
                  )}
                >
                  <Tick
                    label={on ? 'Untick this row' : 'Tick this row'}
                    checked={on}
                    onChange={(yes) => {
                      const n = new Set(ticked)
                      if (yes) n.add(r.id)
                      else n.delete(r.id)
                      onTick(n)
                    }}
                  />
                </td>
                {shown.map((f, i) => {
                  const here = { row: r.id, field: f.slug }
                  const isEditing = editing?.row === r.id && editing.field === f.slug
                  return (
                    <td
                      key={f.id}
                      style={i === 0 ? { left: TICK } : undefined}
                      className={cn(
                        'overflow-hidden whitespace-nowrap border-hair border-b p-0 group-hover/row:bg-hover',
                        bg,
                        i === 0 && 'sticky z-1 shadow-[inset_-1px_0_0_var(--hair)]',
                      )}
                    >
                      {isEditing ? (
                        <EditCell
                          field={f}
                          value={r.values[f.slug]}
                          onDone={async (value) => {
                            const ok = value === undefined ? true : await onEdit(r, f, value)
                            if (ok) setEditing(null)
                            return ok
                          }}
                        />
                      ) : (
                        <Cell
                          field={f}
                          row={r}
                          names={names}
                          first={i === 0}
                          tasks={i === 0 ? (tasks[r.id] ?? 0) : 0}
                          tone={toneOf(config, f, r.values[f.slug])}
                          selected={picked?.row === r.id && picked.field === f.slug}
                          onPick={() => pick(here)}
                          onEdit={CORRECTABLE.has(f.kind) ? () => startEditing(here) : undefined}
                          onOpen={i === 0 ? () => onOpen(r.id) : undefined}
                        />
                      )}
                    </td>
                  )
                })}
                <td className={cn('border-hair border-b p-0', bg)} />
              </tr>
            )
          })}
          {bottom > 0 && (
            <tr>
              <td colSpan={span} style={{ height: bottom }} />
            </tr>
          )}
          <tr>
            <td colSpan={span} className="border-hair border-b p-0">
              <button
                type="button"
                disabled={typeof onNew === 'string'}
                title={typeof onNew === 'string' ? onNew : undefined}
                onClick={typeof onNew === 'string' ? undefined : onNew}
                className="sticky left-0 flex h-9 items-center gap-1.5 px-3 text-ink-3 hover:text-ink disabled:opacity-50 disabled:hover:text-ink-3"
              >
                <Plus className="size-3.5" />
                New
              </button>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td className="sticky bottom-0 left-0 z-20 h-8.5 border-line border-t bg-canvas p-0" />
            {shown.map((f, i) => (
              <Foot
                key={f.id}
                field={f}
                first={i === 0}
                rows={counted ?? rows}
                config={config}
                names={names}
                onConfig={onConfig}
              />
            ))}
            <td className="sticky bottom-0 z-10 h-8.5 border-line border-t bg-canvas p-0" />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function Tick({
  label,
  checked,
  mixed,
  onChange,
}: {
  label: string
  checked: boolean
  mixed?: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <label className="grid h-9 w-full cursor-pointer place-items-center">
      <input
        type="checkbox"
        aria-label={label}
        className="accent-accent"
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = !!mixed
        }}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}

function Header({
  tableId,
  field: f,
  first,
  config,
  shown,
  rows,
  names,
  width,
  onConfig,
}: {
  tableId: string
  field: FieldView
  first: boolean
  config: ViewConfig
  shown: FieldView[]
  rows: RowView[]
  names: Record<string, string>
  width: number
  onConfig: (c: ViewConfig) => void
}) {
  const [open, setOpen] = useState(false)
  const menu = useRef<HTMLButtonElement>(null)
  const level = config.sorts.findIndex((s) => s.field === f.id)
  const dir = config.sorts[level]?.dir
  const filtered = config.filters.rules.some((r) => r.field === f.id)
  const numeric = NUMERIC.has(f.kind)
  // dragging the edge: the width follows the pointer, at least 64px
  const resize = (e: PointerEvent<HTMLSpanElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const start = e.clientX
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const moveTo = (m: globalThis.PointerEvent) =>
      onConfig(setWidth(config, f.id, width + m.clientX - start))
    const up = () => {
      el.removeEventListener('pointermove', moveTo)
      el.removeEventListener('pointerup', up)
    }
    el.addEventListener('pointermove', moveTo)
    el.addEventListener('pointerup', up)
  }
  return (
    <th
      style={first ? { left: TICK } : undefined}
      className={cn(
        'group/head sticky top-0 z-10 h-9 border-line border-b bg-surface p-0 font-medium text-ink-3 text-sm',
        first && 'z-20 shadow-[inset_-1px_0_0_var(--hair)]',
      )}
    >
      <div className={cn('relative flex h-9 items-center', numeric && 'flex-row-reverse')}>
        <button
          type="button"
          title={f.about ?? 'Sort by this column; shift-click to add it as the next sort'}
          onClick={(e) => onConfig(cycleSort(config, f.id, e.shiftKey))}
          className={cn(
            'flex h-full min-w-0 flex-1 items-center gap-1 px-2.5 hover:text-ink',
            numeric && 'justify-end',
            (dir || filtered) && 'text-ink',
          )}
        >
          <span className="truncate">{f.name}</span>
          {filtered && <Filter className="size-3 shrink-0 text-accent" />}
          {dir && (
            <span className="flex shrink-0 items-center text-accent">
              {dir === 'asc' ? (
                <ArrowUp className="size-3.25" />
              ) : (
                <ArrowDown className="size-3.25" />
              )}
              {config.sorts.length > 1 && <span className="text-xs">{level + 1}</span>}
            </span>
          )}
        </button>
        <button
          ref={menu}
          type="button"
          aria-label={`${f.name}: sort, filter, group and more`}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'mx-1 grid size-6 shrink-0 place-items-center rounded-sm text-ink-3 hover:bg-hover hover:text-ink',
            open ? 'visible' : 'invisible group-hover/head:visible',
          )}
        >
          <ChevronDown className="size-3.5" />
        </button>
        <span
          aria-hidden="true"
          onPointerDown={resize}
          title={`Drag to resize ${f.name}`}
          className="absolute top-0 -right-1 z-10 h-full w-2 cursor-col-resize hover:bg-accent-line"
        />
      </div>
      <Popover
        anchor={menu}
        open={open}
        onClose={() => setOpen(false)}
        align={numeric ? 'end' : 'start'}
      >
        <ColumnMenu
          tableId={tableId}
          field={f}
          config={config}
          shown={shown}
          rows={rows}
          names={names}
          onConfig={onConfig}
          onClose={() => setOpen(false)}
        />
      </Popover>
    </th>
  )
}

function Cell({
  field: f,
  row: r,
  names,
  first,
  tasks,
  tone,
  selected,
  onPick,
  onEdit,
  onOpen,
}: {
  field: FieldView
  row: RowView
  names: Record<string, string>
  first: boolean
  tasks: number
  tone: string | null
  selected: boolean
  onPick: () => void
  onEdit: (() => void) | undefined
  onOpen: (() => void) | undefined
}) {
  const value = r.values[f.slug]
  const source = r.sources[f.slug]
  const text = show(f, value, names)
  const mark = source ? MARK[source.kind] : undefined
  const empty = value === null || value === undefined || text === ''
  const key = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (onEdit && (e.key === 'Enter' || e.key === 'F2')) {
      e.preventDefault()
      onEdit()
    }
  }
  return (
    <div className="group/cell relative flex">
      <button
        type="button"
        // WebKit does not focus a button on a click; the cell needs it for Enter, F2 and a paste
        onClick={(e) => {
          e.currentTarget.focus({ preventScroll: true })
          onPick()
        }}
        onDoubleClick={onEdit}
        onKeyDown={key}
        title={onEdit ? 'Double-click, Enter or F2 to change it' : undefined}
        className={cn(
          'group flex h-9.5 w-full min-w-0 items-center gap-0.75 px-2.5 text-left tabular-nums',
          NUMERIC.has(f.kind) && 'justify-end',
          onOpen && 'pr-8',
          selected && 'bg-accent-soft ring-2 ring-accent ring-inset',
        )}
      >
        {empty ? (
          NUMERIC.has(f.kind) ? (
            <span className="text-ink-3">None given</span>
          ) : null
        ) : f.kind === 'choice' && f.tones[text] ? (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span className={cn('size-1.75 shrink-0 rounded-full', DOT[f.tones[text]])} />
            <span className="truncate">{text}</span>
          </span>
        ) : f.kind === 'choice' ? (
          <Pill>{text}</Pill>
        ) : (
          <span
            className={cn(
              'truncate decoration-dotted decoration-ink-3 underline-offset-3 group-hover:underline',
              first && 'font-medium',
              // an italic glyph leans past its box; the room keeps it whole
              mark && 'pr-0.5 text-ink-2 italic',
              tone && INK[tone],
            )}
            title={text.length > 30 ? text : undefined}
          >
            {text}
          </span>
        )}
        {mark && !empty && (
          <span className="self-start pt-2 font-bold text-warn text-xs leading-none">{mark}</span>
        )}
        {tasks > 0 && (
          <span
            title={tasks === 1 ? '1 open task' : `${tasks} open tasks`}
            className="ml-auto flex shrink-0 items-center gap-0.5 pl-1.5 text-ink-3 text-xs"
          >
            <ListChecks className="size-3" />
            {tasks}
          </span>
        )}
      </button>
      {onOpen && (
        <button
          type="button"
          aria-label="Open the row"
          title="Open the row"
          onClick={onOpen}
          className="absolute top-1.5 right-1.5 grid size-6.5 place-items-center rounded-sm text-ink-3 opacity-0 hover:bg-hover hover:text-ink focus:opacity-100 group-hover/row:opacity-100"
        >
          <PanelRightOpen className="size-3.5" />
        </button>
      )}
    </div>
  )
}

// A value being changed in place: Enter or leaving saves it as the person's word, Escape leaves it.
function EditCell({
  field,
  value,
  onDone,
}: {
  field: FieldView
  value: unknown
  onDone: (value: unknown) => Promise<boolean> // undefined: left as it was
}) {
  const start = typedOf(field, value)
  const [typed, setTyped] = useState(start)
  const [problem, setProblem] = useState<string | null>(null)
  const done = useRef(false)
  const input = useRef<HTMLInputElement & HTMLSelectElement>(null)
  useEffect(() => {
    input.current?.focus()
    if (input.current && 'select' in input.current) input.current.select?.()
  }, [])
  const save = async () => {
    if (done.current) return
    if (typed === start) {
      done.current = true
      await onDone(undefined)
      return
    }
    const read = readValue(field, typed, value)
    if ('problem' in read) return setProblem(read.problem)
    done.current = true
    if (!(await onDone(read.value))) done.current = false
  }
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void save()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      done.current = true
      void onDone(undefined)
    }
  }
  const box = cn(
    'h-9.5 w-full rounded-none border-0 bg-surface px-2.5 text-md text-ink outline-none ring-2 ring-accent ring-inset',
    problem && 'ring-bad',
  )
  return field.kind === 'choice' ? (
    <select
      ref={input}
      value={typed}
      aria-label={field.name}
      title={problem ?? undefined}
      onChange={(e) => setTyped(e.target.value)}
      onBlur={() => void save()}
      onKeyDown={key}
      className={box}
    >
      <option value="" />
      {field.choices.map((c) => (
        <option key={c}>{c}</option>
      ))}
    </select>
  ) : (
    <input
      ref={input}
      value={typed}
      aria-label={field.name}
      title={problem ?? undefined}
      type={field.kind === 'date' ? 'date' : 'text'}
      inputMode={NUMERIC.has(field.kind) ? 'decimal' : undefined}
      onChange={(e) => {
        setTyped(e.target.value)
        setProblem(null)
      }}
      onBlur={() => void save()}
      onKeyDown={key}
      className={cn(box, NUMERIC.has(field.kind) && 'text-right tabular-nums')}
    />
  )
}

function GroupRow({
  group,
  shown,
  config,
  names,
  folded,
  onFold,
}: {
  group: Group
  shown: FieldView[]
  config: ViewConfig
  names: Record<string, string>
  folded: boolean
  onFold: () => void
}) {
  return (
    <tr>
      <td className="sticky left-0 z-1 h-9 border-line border-b bg-sunk p-0" />
      {shown.map((f, i) => (
        <td
          key={f.id}
          style={i === 0 ? { left: TICK } : undefined}
          className={cn(
            'h-9 whitespace-nowrap border-line border-b bg-sunk p-0',
            i === 0 && 'sticky z-1',
          )}
        >
          {i === 0 ? (
            <button
              type="button"
              onClick={onFold}
              className="flex h-9 w-full items-center gap-1.5 px-2 text-left font-medium text-ink"
            >
              {folded ? (
                <ChevronRight className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
              <span className="truncate">{group.label}</span>
              <span className="font-normal text-ink-3 text-sm tabular-nums">
                {group.rows.length}
              </span>
            </button>
          ) : config.totals[f.id] ? (
            <div
              className={cn(
                'truncate px-2.5 text-ink-2 text-sm tabular-nums',
                NUMERIC.has(f.kind) && 'text-right',
              )}
            >
              {total(config.totals[f.id] as never, f, group.rows, names, true)}
            </div>
          ) : null}
        </td>
      ))}
      <td className="h-9 border-line border-b bg-sunk p-0" />
    </tr>
  )
}

// A column's foot: its total over every row shown, or a quiet place to choose one.
function Foot({
  field: f,
  first,
  rows,
  config,
  names,
  onConfig,
}: {
  field: FieldView
  first: boolean
  rows: RowView[]
  config: ViewConfig
  names: Record<string, string>
  onConfig: (c: ViewConfig) => void
}) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  const op = config.totals[f.id]
  const numeric = NUMERIC.has(f.kind)
  return (
    <td
      style={first ? { left: TICK } : undefined}
      className={cn(
        'sticky bottom-0 z-10 h-8.5 border-line border-t bg-canvas p-0 text-sm',
        first && 'z-20 shadow-[inset_-1px_0_0_var(--hair)]',
      )}
    >
      <button
        ref={anchor}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={op ? `${TOTAL_WORDS[op]}: ${total(op, f, rows, names)}` : 'Choose a total'}
        className={cn(
          'group/foot flex h-8.5 w-full items-center gap-1.5 px-2.5 tabular-nums hover:bg-hover',
          numeric && 'justify-end',
        )}
      >
        {op ? (
          <>
            <span className="text-ink-3">{TOTAL_WORDS[op]}</span>
            <span className="truncate font-medium text-ink">{total(op, f, rows, names, true)}</span>
          </>
        ) : first ? (
          <span className="text-ink-3">
            {rows.length} row{rows.length === 1 ? '' : 's'}
          </span>
        ) : (
          <span className="invisible text-ink-3 group-hover/foot:visible">Total</span>
        )}
      </button>
      <Popover
        anchor={anchor}
        open={open}
        onClose={() => setOpen(false)}
        align={numeric ? 'end' : 'start'}
      >
        <div className="flex flex-col">
          {TOTALS[family(f.kind)].map((o) => (
            <MenuItem
              key={o}
              checked={op === o}
              onClick={() => {
                onConfig(setTotal(config, f.id, o))
                setOpen(false)
              }}
            >
              {TOTAL_WORDS[o]}
            </MenuItem>
          ))}
          <MenuLine />
          <MenuItem
            checked={!op}
            onClick={() => {
              onConfig(setTotal(config, f.id, null))
              setOpen(false)
            }}
          >
            No total
          </MenuItem>
        </div>
      </Popover>
    </td>
  )
}

const KINDS: [string, string][] = [
  ['text', 'Words'],
  ['number', 'A number'],
  ['money', 'Money'],
  ['date', 'A date'],
  ['choice', 'A choice'],
  ['link', 'A link'],
  ['email', 'An email address'],
  ['phone', 'A phone number'],
  ['relation', 'A row of another table'],
  ['person', 'A person'],
  ['file', 'A file'],
]

// + at the end of the header: a field the person adds, with its kind.
function AddField({ tableId }: { tableId: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState('text')
  const [choices, setChoices] = useState('')
  const [relatesTo, setRelatesTo] = useState('')
  const [tables, setTables] = useState<{ id: string; name: string }[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const anchor = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (open && kind === 'relation' && !tables.length)
      api.get<{ tables: { id: string; name: string }[] }[]>('/api/modules').then(
        (ms) => setTables(ms.flatMap((m) => m.tables)),
        () => undefined,
      )
  }, [open, kind, tables.length])
  const save = async (e: FormEvent) => {
    e.preventDefault()
    setProblem(null)
    try {
      await api.post(`/api/tables/${tableId}/fields`, {
        name,
        kind,
        ...(kind === 'choice'
          ? {
              choices: choices
                .split(',')
                .map((c) => c.trim())
                .filter(Boolean),
            }
          : {}),
        ...(kind === 'relation' ? { relatesTo } : {}),
      })
      setOpen(false)
      setName('')
      setChoices('')
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That field was not added.')
    }
  }
  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label="Add a field"
        title="Add a field"
        onClick={() => setOpen((o) => !o)}
        className="grid h-9 w-full place-items-center text-ink-3 hover:bg-hover hover:text-ink"
      >
        <Plus className="size-3.75" />
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} align="end">
        <form onSubmit={save} className="flex w-68 flex-col gap-2 p-1.5">
          <div className="font-medium text-ink">Add a field</div>
          <Field
            autoFocus
            value={name}
            placeholder="Its name"
            aria-label="The field’s name"
            onChange={(e) => setName(e.target.value)}
          />
          <Select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Its kind">
            {KINDS.map(([k, w]) => (
              <option key={k} value={k}>
                {w}
              </option>
            ))}
          </Select>
          {kind === 'choice' && (
            <Field
              value={choices}
              placeholder="Its choices, with commas: New, Looking, Passed"
              aria-label="Its choices"
              onChange={(e) => setChoices(e.target.value)}
            />
          )}
          {kind === 'relation' && (
            <Select
              value={relatesTo}
              onChange={(e) => setRelatesTo(e.target.value)}
              aria-label="The table it points at"
            >
              <option value="">Which table?</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          )}
          {problem && <div className="text-bad text-sm">{problem}</div>}
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              variant="primary"
              disabled={
                !name.trim() ||
                (kind === 'choice' && !choices.trim()) ||
                (kind === 'relation' && !relatesTo)
              }
            >
              Add it
            </Button>
          </div>
        </form>
      </Popover>
    </>
  )
}
