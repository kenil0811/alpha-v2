// What a view does, said above its table as chips: each filter (opens to change it), all or any,
// Clear all when there are several, the sorts, the group; and Filter to add one; Columns, inside ⋮,
// show, hide and order them.
import type { FieldView, FilterRule, RowView, ViewConfig } from '@alpha/core/api'
import { ArrowDown, ArrowUp, ListFilter, Rows3, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { cn } from '../ui/cn.ts'
import { MenuItem, MenuLine, Popover, SubMenu } from '../ui/popover.tsx'
import { RuleEditor } from './ColumnMenu.tsx'
import { hide, move, removeRule, setGroup, setRule } from './edits.ts'
import { columns, ruleWords } from './engine.ts'

const chip =
  'inline-flex h-7.5 max-w-80 items-center gap-1 rounded-md border border-accent-line bg-accent-soft pr-1 pl-2.5 text-accent text-md'

function Remove({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-5 shrink-0 place-items-center rounded-sm hover:bg-hover"
    >
      <X className="size-3.25" />
    </button>
  )
}

export function Chips({
  fields,
  config,
  rows,
  names,
  onConfig,
}: {
  fields: FieldView[]
  config: ViewConfig
  rows: RowView[]
  names: Record<string, string>
  onConfig: (c: ViewConfig) => void
}) {
  const rules = config.filters.rules
    .map((r) => ({ rule: r, field: fields.find((f) => f.id === r.field) }))
    .filter((x): x is { rule: FilterRule; field: FieldView } => !!x.field)
  const sorts = config.sorts
    .map((s) => ({ ...s, field: fields.find((f) => f.id === s.field) }))
    .filter((s): s is { field: FieldView; dir: 'asc' | 'desc' } => !!s.field)
  // a board's columns are its group already
  const group = config.kind === 'board' ? undefined : fields.find((f) => f.id === config.group)
  return (
    <>
      {rules.map(({ rule, field }, i) => (
        <span key={field.id} className="contents">
          {i > 0 && (
            <button
              type="button"
              title="Rows must meet all the filters, or any one of them"
              onClick={() =>
                onConfig({
                  ...config,
                  filters: {
                    ...config.filters,
                    match: config.filters.match === 'all' ? 'any' : 'all',
                  },
                })
              }
              className="h-7.5 rounded-md px-1.5 text-ink-3 text-sm hover:bg-hover hover:text-ink"
            >
              {config.filters.match === 'all' ? 'and' : 'or'}
            </button>
          )}
          <RuleChip
            rule={rule}
            field={field}
            rows={rows}
            names={names}
            onSave={(r) => onConfig(setRule(config, r))}
            onRemove={() => onConfig(removeRule(config, field.id))}
          />
        </span>
      ))}
      {rules.length > 1 && (
        <button
          type="button"
          onClick={() => onConfig({ ...config, filters: { ...config.filters, rules: [] } })}
          className="h-7.5 rounded-md px-1.5 text-accent text-md hover:underline"
        >
          Clear all
        </button>
      )}
      {sorts.length > 0 && (
        <span className={chip}>
          {sorts.map((s, i) => (
            <span key={s.field.id} className="inline-flex items-center gap-0.5 truncate">
              {i === 0 ? 'Sorted by ' : ', then '}
              {s.field.name}
              {s.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            </span>
          ))}
          <Remove label="Stop sorting" onClick={() => onConfig({ ...config, sorts: [] })} />
        </span>
      )}
      {group && (
        <span className={chip}>
          <Rows3 className="size-3.25" />
          Grouped by {group.name}
          <Remove label="Stop grouping" onClick={() => onConfig(setGroup(config, null))} />
        </span>
      )}
    </>
  )
}

function RuleChip({
  rule,
  field,
  rows,
  names,
  onSave,
  onRemove,
}: {
  rule: FilterRule
  field: FieldView
  rows: RowView[]
  names: Record<string, string>
  onSave: (r: FilterRule) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  return (
    <span className={chip}>
      <button
        ref={anchor}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="truncate"
        title="Change this filter"
      >
        {ruleWords(rule, field)}
      </button>
      <Remove label={`Clear the filter on ${field.name}`} onClick={onRemove} />
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)}>
        <RuleEditor
          field={field}
          rule={rule}
          rows={rows}
          names={names}
          onSave={(r) => {
            setOpen(false)
            onSave(r)
          }}
          onRemove={() => {
            setOpen(false)
            onRemove()
          }}
        />
      </Popover>
    </span>
  )
}

// A page's own list, kept in its address (Tasks' Today, This week…)
export type QuickFilter = { label: string; count?: number | undefined; on: boolean; href: string }

// + Filter: a page's Quick filters first when it has some, not a row of their own (Vikas, 1 Nov),
// then a field and its rule. Filter names the quick filter in use.
export function AddFilter({
  fields,
  config,
  rows,
  names,
  onConfig,
  quick,
}: {
  fields: FieldView[]
  config: ViewConfig
  rows: RowView[]
  names: Record<string, string>
  onConfig: (c: ViewConfig) => void
  quick?: QuickFilter[] | undefined
}) {
  const [open, setOpen] = useState(false)
  const [field, setField] = useState<FieldView | null>(null)
  const anchor = useRef<HTMLButtonElement>(null)
  const close = () => {
    setOpen(false)
    setField(null)
  }
  const at = quick?.find((q) => q.on)
  return (
    <>
      <button
        ref={anchor}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        className="flex h-7.5 items-center gap-1.5 rounded-md border border-line border-dashed px-2.5 text-ink-2 text-md hover:border-accent-line hover:bg-accent-soft hover:text-accent"
      >
        <ListFilter className="size-3.25" />
        {at ? `Filter: ${at.label}` : 'Filter'}
      </button>
      <Popover anchor={anchor} open={open} onClose={close}>
        {field ? (
          <RuleEditor
            field={field}
            rule={config.filters.rules.find((r) => r.field === field.id)}
            rows={rows}
            names={names}
            onSave={(r) => {
              close()
              onConfig(setRule(config, r))
            }}
          />
        ) : (
          <div className="flex max-h-80 flex-col overflow-y-auto">
            {quick?.length ? (
              <>
                <SubMenu label="Quick filters" hint={at?.label}>
                  {quick.map((q) => (
                    <MenuItem
                      key={q.href}
                      checked={q.on}
                      onClick={() => {
                        close()
                        window.location.hash = q.href
                      }}
                    >
                      <span className="flex-1">{q.label}</span>
                      {q.count ? <span className="text-ink-3 tabular-nums">{q.count}</span> : null}
                    </MenuItem>
                  ))}
                </SubMenu>
                <MenuLine />
              </>
            ) : null}
            {fields.map((f) => (
              <MenuItem
                key={f.id}
                checked={config.filters.rules.some((r) => r.field === f.id)}
                onClick={() => setField(f)}
              >
                {f.name}
              </MenuItem>
            ))}
          </div>
        )}
      </Popover>
    </>
  )
}

// Columns, inside ⋮ (Vikas, 27 Oct): each field shown or hidden, and moved up or down the order.
export function ColumnsList({
  fields,
  config,
  onConfig,
}: {
  fields: FieldView[]
  config: ViewConfig
  onConfig: (c: ViewConfig) => void
}) {
  const shown = columns(fields, config)
  const ordered = [...shown, ...fields.filter((f) => config.hidden.includes(f.id))]
  return (
    <div className="flex max-h-96 w-64 flex-col overflow-y-auto">
      <div className="flex h-7.5 items-center justify-between px-1.5 text-sm">
        <button
          type="button"
          disabled={!config.hidden.length}
          onClick={() => onConfig({ ...config, hidden: [] })}
          className="text-accent hover:underline disabled:text-ink-3 disabled:no-underline"
        >
          Show all
        </button>
        <button
          type="button"
          title="Keeps the first column"
          disabled={shown.length <= 1}
          onClick={() =>
            onConfig({
              ...config,
              hidden: fields.filter((f) => f.id !== shown[0]?.id).map((f) => f.id),
            })
          }
          className="text-accent hover:underline disabled:text-ink-3 disabled:no-underline"
        >
          Hide all
        </button>
      </div>
      <MenuLine />
      {ordered.map((f) => {
        const hidden = config.hidden.includes(f.id)
        const at = shown.findIndex((x) => x.id === f.id)
        return (
          <div
            key={f.id}
            className="flex h-7.5 items-center gap-2 rounded-sm px-1.5 hover:bg-hover"
          >
            <input
              type="checkbox"
              className="accent-accent"
              checked={!hidden}
              disabled={!hidden && shown.length <= 1}
              aria-label={`Show ${f.name}`}
              onChange={(e) => onConfig(hide(config, f.id, !e.target.checked))}
            />
            <span className={cn('min-w-0 flex-1 truncate', hidden ? 'text-ink-3' : 'text-ink')}>
              {f.name}
            </span>
            {!hidden && (
              <>
                <button
                  type="button"
                  aria-label={`Move ${f.name} up`}
                  disabled={at <= 0}
                  onClick={() => onConfig(move(config, shown, f.id, -1))}
                  className="grid size-5 place-items-center rounded-sm text-ink-3 hover:text-ink disabled:opacity-30"
                >
                  <ArrowUp className="size-3.25" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${f.name} down`}
                  disabled={at >= shown.length - 1}
                  onClick={() => onConfig(move(config, shown, f.id, 1))}
                  className="grid size-5 place-items-center rounded-sm text-ink-3 hover:text-ink disabled:opacity-30"
                >
                  <ArrowDown className="size-3.25" />
                </button>
              </>
            )}
          </div>
        )
      })}
      {Object.keys(config.widths).length > 0 && (
        <>
          <MenuLine />
          <MenuItem onClick={() => onConfig({ ...config, widths: {} })}>
            Reset the column widths
          </MenuItem>
        </>
      )}
    </div>
  )
}
