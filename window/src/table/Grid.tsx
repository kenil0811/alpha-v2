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
  EllipsisVertical,
  Filter,
  ListChecks,
  PanelRightOpen,
  Plus,
} from 'lucide-react'
import {
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { api, Problem } from '../api.ts'
import { Button } from '../ui/button.tsx'
import { cn } from '../ui/cn.ts'
import { Confirm } from '../ui/dialog.tsx'
import { Field, Select } from '../ui/field.tsx'
import { Pill } from '../ui/pill.tsx'
import { MenuItem, MenuLine, Popover, useContextMenu } from '../ui/popover.tsx'
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
import type { LayoutNow } from './layout.ts'
import { RowMenu } from './RowMenu.tsx'
import {
  CORRECTABLE,
  DOT,
  EMPTY_CELL,
  EMPTY_WORDS,
  INK,
  KIND_WORDS,
  MARK,
  NUMERIC,
  readValue,
  show,
  TINT,
  typedOf,
} from './values.ts'

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
  readOnly = false,
  onDuplicate,
  onRemove,
  layout,
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
  readOnly?: boolean // rows kept elsewhere (people, tasks): shown and opened, not typed into
  onDuplicate?: ((row: RowView) => Promise<boolean>) | undefined
  onRemove?: ((rows: RowView[]) => Promise<boolean>) | undefined
  layout: LayoutNow // frozen and wrapped columns, kept with the list
}) {
  const box = useRef<HTMLDivElement>(null)
  const [folded, setFolded] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<{ row: string; field: string } | null>(null)
  // a row's menu: from a right-click on it (with the cell under the pointer), Shift+F10, or its ⋮
  const [menu, setMenu] = useState<{
    row: RowView
    field: FieldView | null
    x: number
    y: number
  } | null>(null)
  const [removing, setRemoving] = useState<RowView | null>(null)
  const menuOn = (row: RowView, field: FieldView | null) => ({
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault()
      setMenu({ row, field, x: e.clientX, y: e.clientY })
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (!((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu')) return
      e.preventDefault()
      const r = (e.target as HTMLElement).getBoundingClientRect()
      setMenu({ row, field, x: r.left + 8, y: r.bottom })
    },
  })
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
  // the columns frozen at the left stay in place as the table scrolls across
  const lefts = widths.map((_, i) => TICK + widths.slice(0, i).reduce((a, b) => a + b, 0))
  const stick = (i: number) => (i < layout.frozen ? lefts[i] : undefined)
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
                left={stick(i)}
                edge={i === layout.frozen - 1}
                index={i}
                layout={layout}
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
                data-index={v.index}
                ref={virtual.measureElement}
                className={cn('group/row', r.id === openRow && '[&>td]:bg-accent-soft')}
              >
                <td
                  {...menuOn(r, null)}
                  className={cn(
                    'sticky left-0 z-1 border-hair border-b p-0 group-hover/row:bg-hover',
                    bg,
                    // the tick shows on hover, and on every row once one is ticked
                    !on &&
                      ticked.size === 0 &&
                      '[&_input]:opacity-0 group-hover/row:[&_input]:opacity-100 [&_input:focus]:opacity-100',
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
                      {...menuOn(r, f)}
                      style={stick(i) === undefined ? undefined : { left: stick(i) }}
                      className={cn(
                        'overflow-hidden border-hair border-b p-0 group-hover/row:bg-hover',
                        layout.wrap.includes(f.id) ? 'whitespace-normal' : 'whitespace-nowrap',
                        bg,
                        stick(i) !== undefined && 'sticky z-1',
                        i === layout.frozen - 1 && 'shadow-[inset_-1px_0_0_var(--hair)]',
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
                          wrap={layout.wrap.includes(f.id)}
                          tasks={i === 0 ? (tasks[r.id] ?? 0) : 0}
                          tone={toneOf(config, f, r.values[f.slug])}
                          selected={picked?.row === r.id && picked.field === f.slug}
                          onPick={() => pick(here)}
                          onEdit={
                            !readOnly && CORRECTABLE.has(f.kind)
                              ? () => startEditing(here)
                              : undefined
                          }
                          onOpen={i === 0 ? () => onOpen(r.id) : undefined}
                        />
                      )}
                    </td>
                  )
                })}
                <td className={cn('border-hair border-b p-0', bg)}>
                  <button
                    type="button"
                    aria-label="Actions for this row"
                    title="Open, duplicate, copy a link, delete…"
                    onClick={(e) => {
                      const b = e.currentTarget.getBoundingClientRect()
                      setMenu({ row: r, field: null, x: b.left, y: b.bottom })
                    }}
                    className="mx-auto grid size-6.5 place-items-center rounded-sm text-ink-3 opacity-0 hover:bg-hover hover:text-ink focus:opacity-100 group-hover/row:opacity-100"
                  >
                    <EllipsisVertical className="size-3.5" />
                  </button>
                </td>
              </tr>
            )
          })}
          {bottom > 0 && (
            <tr>
              <td colSpan={span} style={{ height: bottom }} />
            </tr>
          )}
          {/* an empty table keeps its frame: blank rows, the New row, the footer; no sentence */}
          {items.length === 0 &&
            [0, 1, 2].map((n) => (
              <tr key={`blank${n}`} aria-hidden>
                <td colSpan={span} className="h-9.5 border-hair border-b p-0" />
              </tr>
            ))}
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
                left={stick(i)}
                edge={i === layout.frozen - 1}
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
      <Popover point={menu && { x: menu.x, y: menu.y }} open={!!menu} onClose={() => setMenu(null)}>
        {menu && (
          <RowMenu
            tableId={tableId}
            row={menu.row}
            field={menu.field}
            names={names}
            readOnly={readOnly}
            elsewhere={!onRemove}
            onDone={() => setMenu(null)}
            onEdit={() => menu.field && startEditing({ row: menu.row.id, field: menu.field.slug })}
            onClear={() => menu.field && onEdit(menu.row, menu.field, null)}
            onHistory={() => menu.field && onPick({ row: menu.row.id, field: menu.field.slug })}
            onOpen={() => onOpen(menu.row.id)}
            onDuplicate={() => onDuplicate?.(menu.row)}
            onRemove={() => setRemoving(menu.row)}
          />
        )}
      </Popover>
      <Confirm
        open={!!removing}
        title="Delete this row?"
        yes="Delete row"
        onClose={() => setRemoving(null)}
        onYes={async () => {
          if (removing && (await onRemove?.([removing]))) setRemoving(null)
        }}
      >
        It can’t be brought back; Activity keeps what it held.
      </Confirm>
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
  left,
  edge,
  index,
  layout,
  config,
  shown,
  rows,
  names,
  width,
  onConfig,
}: {
  tableId: string
  field: FieldView
  left: number | undefined // where it stays when frozen
  edge: boolean // the last frozen column, with a line at its right
  index: number
  layout: LayoutNow
  config: ViewConfig
  shown: FieldView[]
  rows: RowView[]
  names: Record<string, string>
  width: number
  onConfig: (c: ViewConfig) => void
}) {
  const [open, setOpen] = useState(false)
  const [inserting, setInserting] = useState<'left' | 'right' | null>(null)
  const [over, setOver] = useState<'left' | 'right' | null>(null)
  const menu = useRef<HTMLButtonElement>(null)
  const head = useRef<HTMLTableCellElement>(null)
  const ctx = useContextMenu()
  const close = () => {
    setOpen(false)
    ctx.close()
  }
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
  // a column dropped on this one goes to the side of it the pointer is on
  const side = (e: DragEvent<HTMLTableCellElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return e.clientX < r.left + r.width / 2 ? 'left' : 'right'
  }
  const place = (moved: string, at: 'left' | 'right') => {
    const order = shown.map((x) => x.id).filter((id) => id !== moved)
    const i = order.indexOf(f.id)
    if (i < 0) return
    order.splice(at === 'left' ? i : i + 1, 0, moved)
    onConfig({ ...config, order: [...order, ...config.order.filter((id) => !order.includes(id))] })
  }
  // a new column, put beside this one once it is made
  const added = async (name: string) => {
    const at = inserting
    setInserting(null)
    const t = await api.get<{ fields: FieldView[] }>(`/api/tables/${tableId}`)
    const made = t.fields.find((x) => x.name === name && !shown.some((s) => s.id === x.id))
    if (made && at) place(made.id, at)
  }
  return (
    <th
      ref={head}
      style={left === undefined ? undefined : { left }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/x-alpha-column', f.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('text/x-alpha-column')) return
        e.preventDefault()
        setOver(side(e))
      }}
      onDragLeave={() => setOver(null)}
      onDrop={(e) => {
        const moved = e.dataTransfer.getData('text/x-alpha-column')
        setOver(null)
        if (moved && moved !== f.id) place(moved, side(e))
      }}
      {...ctx.on}
      className={cn(
        'group/head sticky top-0 z-10 h-9 border-line border-b bg-surface p-0 font-medium text-ink-3 text-sm',
        left !== undefined && 'z-20',
        edge && 'shadow-[inset_-1px_0_0_var(--hair)]',
        over === 'left' && 'shadow-[inset_2px_0_0_var(--accent)]',
        over === 'right' && 'shadow-[inset_-2px_0_0_var(--accent)]',
      )}
    >
      <div className={cn('relative flex h-9 items-center', numeric && 'flex-row-reverse')}>
        <button
          type="button"
          title={`${f.about ? `${f.about} ` : ''}Click to sort, shift-click to sort by it next; drag to move it; right-click for more.`}
          onClick={(e) => onConfig(cycleSort(config, f.id, e.shiftKey))}
          className={cn(
            'flex h-full min-w-0 flex-1 cursor-grab items-center gap-1 px-2.5 hover:text-ink active:cursor-grabbing',
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
          title={`${f.name}: sort, filter, group and more`}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'mx-1 grid size-6 shrink-0 place-items-center rounded-sm text-ink-3 hover:bg-hover hover:text-ink',
            open || ctx.open ? 'visible' : 'invisible group-hover/head:visible',
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
        point={ctx.point}
        open={open || ctx.open}
        onClose={close}
        align={numeric ? 'end' : 'start'}
      >
        <ColumnMenu
          tableId={tableId}
          field={f}
          index={index}
          layout={layout}
          config={config}
          shown={shown}
          rows={rows}
          names={names}
          onConfig={onConfig}
          onInsert={(at) => {
            close()
            setInserting(at)
          }}
          onClose={close}
        />
      </Popover>
      <Popover anchor={head} open={inserting !== null} onClose={() => setInserting(null)}>
        <AddFieldForm
          tableId={tableId}
          title={`Add a column to the ${inserting} of ${f.name}`}
          onAdded={added}
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
  wrap,
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
  wrap: boolean
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
          'group flex w-full min-w-0 items-center gap-0.75 px-2.5 text-left tabular-nums',
          wrap ? 'min-h-9.5 py-2' : 'h-9.5',
          NUMERIC.has(f.kind) && 'justify-end',
          onOpen && 'pr-8',
          selected && 'bg-accent-soft ring-2 ring-accent ring-inset',
        )}
      >
        {empty ? (
          <span className="text-ink-3" title={EMPTY_WORDS}>
            {EMPTY_CELL}
          </span>
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
              wrap ? 'break-words' : 'truncate',
              'decoration-dotted decoration-ink-3 underline-offset-3 group-hover:underline',
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
        {mark && !empty && source && (
          <span
            title={KIND_WORDS[source.kind]}
            className="self-start pt-2 text-ink-3 text-xs leading-none"
          >
            {mark}
          </span>
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
export function EditCell({
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
  left,
  edge,
  rows,
  config,
  names,
  onConfig,
}: {
  field: FieldView
  first: boolean
  left: number | undefined
  edge: boolean
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
      style={left === undefined ? undefined : { left }}
      className={cn(
        'sticky bottom-0 z-10 h-8.5 border-line border-t bg-canvas p-0 text-sm',
        left !== undefined && 'z-20',
        edge && 'shadow-[inset_-1px_0_0_var(--hair)]',
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
  const anchor = useRef<HTMLButtonElement>(null)
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
        <AddFieldForm tableId={tableId} title="Add a field" onAdded={() => setOpen(false)} />
      </Popover>
    </>
  )
}

// A new column: its name and kind, choices for a choice, the table a relation points at.
export function AddFieldForm({
  tableId,
  title,
  onAdded,
}: {
  tableId: string
  title: string
  onAdded: (name: string) => void
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState('text')
  const [choices, setChoices] = useState('')
  const [relatesTo, setRelatesTo] = useState('')
  const [tables, setTables] = useState<{ id: string; name: string }[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => {
    if (kind === 'relation' && !tables.length)
      api.get<{ tables: { id: string; name: string }[] }[]>('/api/modules').then(
        (ms) => setTables(ms.flatMap((m) => m.tables)),
        () => undefined,
      )
  }, [kind, tables.length])
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
      onAdded(name)
      setName('')
      setChoices('')
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That field was not added.')
    }
  }
  return (
    <form onSubmit={save} className="flex w-68 flex-col gap-2 p-1.5">
      <div className="font-medium text-ink">{title}</div>
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
  )
}
