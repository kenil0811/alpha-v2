// A column's menu, in the column itself (Kenil, 12 Oct, "like AG Grid"): sort, filter, group by
// it, a total, colours, move it, hide it. And the rule editor a filter chip opens too.
import type { FieldView, FilterOp, FilterRule, RowView, TotalOp, ViewConfig } from '@alpha/core/api'
import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftToLine,
  ArrowRight,
  ArrowRightToLine,
  ArrowUp,
  EyeOff,
  MessageSquareText,
  Pin,
  Rows3,
  WrapText,
} from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { api, Problem } from '../api.ts'
import { Button } from '../ui/button.tsx'
import { Field, Select } from '../ui/field.tsx'
import { MenuItem, MenuLine } from '../ui/popover.tsx'
import {
  hide,
  move,
  removeRule,
  setGroup,
  setRule,
  setSort,
  setTint,
  setTotal,
  setWhen,
} from './edits.ts'
import { family, GROUPABLE, needs, OP_WORDS, OPS, TOTAL_WORDS, TOTALS } from './engine.ts'
import type { LayoutNow } from './layout.ts'
import { show } from './values.ts'

type Tone = 'good' | 'warn' | 'bad' | 'accent'
const TONE_WORDS: Record<Tone, string> = {
  good: 'Green',
  warn: 'Amber',
  bad: 'Red',
  accent: 'Blue',
}

// Whose sentence a field's about is, as the menu says it.
const ABOUT_BY: Record<'kit' | 'alpha' | 'person', string> = {
  kit: 'From the module',
  alpha: 'Assumed by Alpha',
  person: 'Yours',
}

export function ColumnMenu({
  tableId,
  field,
  index,
  layout,
  config,
  shown,
  rows,
  names,
  onConfig,
  onInsert,
  onClose,
}: {
  tableId: string
  field: FieldView
  index: number
  layout: LayoutNow
  config: ViewConfig
  shown: FieldView[]
  rows: RowView[]
  names: Record<string, string>
  onConfig: (c: ViewConfig) => void
  onInsert: (side: 'left' | 'right') => void
  onClose: () => void
}) {
  const [page, setPage] = useState<'main' | 'filter' | 'total' | 'colour' | 'describe'>('main')
  const apply = (c: ViewConfig) => {
    onConfig(c)
    onClose()
  }
  const sorted = config.sorts.find((s) => s.field === field.id)?.dir
  const rule = config.filters.rules.find((r) => r.field === field.id)
  const fam = family(field.kind)
  const at = shown.findIndex((f) => f.id === field.id)

  if (page === 'filter')
    return (
      <RuleEditor
        field={field}
        rule={rule}
        rows={rows}
        names={names}
        onSave={(r) => apply(setRule(config, r))}
        onRemove={rule ? () => apply(removeRule(config, field.id)) : undefined}
      />
    )
  if (page === 'total')
    return (
      <div className="flex flex-col">
        {TOTALS[fam].map((op) => (
          <MenuItem
            key={op}
            checked={config.totals[field.id] === op}
            onClick={() => apply(setTotal(config, field.id, op))}
          >
            {TOTAL_WORDS[op]}
          </MenuItem>
        ))}
        <MenuLine />
        <MenuItem
          checked={!config.totals[field.id]}
          onClick={() => apply(setTotal(config, field.id, null))}
        >
          No total
        </MenuItem>
      </div>
    )
  if (page === 'colour') return <ColourEditor field={field} config={config} onSave={apply} />
  if (page === 'describe') return <AboutEditor tableId={tableId} field={field} onDone={onClose} />

  const canColour =
    (field.kind === 'choice' && Object.keys(field.tones).length > 0) ||
    fam === 'number' ||
    fam === 'date'
  return (
    <div className="flex flex-col">
      <div className="flex max-w-72 flex-col gap-0.5 whitespace-normal px-3 pt-1.5 pb-1">
        <span className="text-ink text-sm">
          {field.about ?? <span className="text-ink-3">No sentence on what it means yet.</span>}
        </span>
        <span className="text-ink-3 text-xs">{field.aboutBy ? ABOUT_BY[field.aboutBy] : ''}</span>
      </div>
      <MenuItem onClick={() => setPage('describe')}>
        <MessageSquareText className="size-3.5 text-ink-3" />
        {field.about ? 'Describe it your way…' : 'Describe…'}
      </MenuItem>
      <MenuLine />
      <MenuItem checked={sorted === 'asc'} onClick={() => apply(setSort(config, field.id, 'asc'))}>
        <ArrowUp className="size-3.5 text-ink-3" />
        Sort {fam === 'number' ? 'smallest first' : fam === 'date' ? 'oldest first' : 'A to Z'}
      </MenuItem>
      <MenuItem
        checked={sorted === 'desc'}
        onClick={() => apply(setSort(config, field.id, 'desc'))}
      >
        <ArrowDown className="size-3.5 text-ink-3" />
        Sort {fam === 'number' ? 'largest first' : fam === 'date' ? 'newest first' : 'Z to A'}
      </MenuItem>
      {sorted && (
        <MenuItem onClick={() => apply(setSort(config, field.id, null))}>
          Stop sorting by it
        </MenuItem>
      )}
      <MenuLine />
      <MenuItem checked={!!rule} onClick={() => setPage('filter')}>
        Filter…
      </MenuItem>
      {GROUPABLE.has(field.kind) && (
        <MenuItem
          checked={config.group === field.id}
          onClick={() => apply(setGroup(config, config.group === field.id ? null : field.id))}
        >
          <Rows3 className="size-3.5 text-ink-3" />
          {config.group === field.id ? 'Stop grouping' : 'Group by this column'}
        </MenuItem>
      )}
      <MenuItem checked={!!config.totals[field.id]} onClick={() => setPage('total')}>
        Total…
      </MenuItem>
      {canColour && (
        <MenuItem
          checked={
            config.colours.tint === field.id ||
            config.colours.when.some((w) => w.field === field.id)
          }
          onClick={() => setPage('colour')}
        >
          Colour…
        </MenuItem>
      )}
      <MenuLine />
      <MenuItem
        reason={at <= 0 ? 'It is already the first column.' : undefined}
        onClick={() => apply(move(config, shown, field.id, -1))}
      >
        <ArrowLeft className="size-3.5 text-ink-3" />
        Move left
      </MenuItem>
      <MenuItem
        reason={at < 0 || at >= shown.length - 1 ? 'It is already the last column.' : undefined}
        onClick={() => apply(move(config, shown, field.id, 1))}
      >
        <ArrowRight className="size-3.5 text-ink-3" />
        Move right
      </MenuItem>
      <MenuItem
        reason={shown.length <= 1 ? 'A table keeps at least one column.' : undefined}
        onClick={() => apply(hide(config, field.id, true))}
      >
        <EyeOff className="size-3.5 text-ink-3" />
        Hide column
      </MenuItem>
      {index + 1 < layout.frozen ? (
        <MenuItem
          onClick={() => {
            layout.setFrozen(1)
            onClose()
          }}
        >
          <Pin className="size-3.5 text-ink-3" />
          Unfreeze columns
        </MenuItem>
      ) : (
        <MenuItem
          checked={index > 0 && index + 1 === layout.frozen}
          reason={index === 0 ? 'The first column always stays in place.' : undefined}
          onClick={() => {
            layout.setFrozen(index + 1 === layout.frozen ? 1 : index + 1)
            onClose()
          }}
        >
          <Pin className="size-3.5 text-ink-3" />
          {index + 1 === layout.frozen && index > 0 ? 'Unfreeze columns' : 'Freeze up to here'}
        </MenuItem>
      )}
      <MenuItem
        checked={layout.wrap.includes(field.id)}
        onClick={() => {
          layout.toggleWrap(field.id)
          onClose()
        }}
      >
        <WrapText className="size-3.5 text-ink-3" />
        Wrap text
      </MenuItem>
      <MenuLine />
      <MenuItem onClick={() => onInsert('left')}>
        <ArrowLeftToLine className="size-3.5 text-ink-3" />
        Insert column left
      </MenuItem>
      <MenuItem onClick={() => onInsert('right')}>
        <ArrowRightToLine className="size-3.5 text-ink-3" />
        Insert column right
      </MenuItem>
    </div>
  )
}

// One rule on one field: its op for the field's kind, and what it needs.
export function RuleEditor({
  field,
  rule,
  rows,
  names,
  onSave,
  onRemove,
}: {
  field: FieldView
  rule: FilterRule | undefined
  rows: RowView[]
  names: Record<string, string>
  onSave: (r: FilterRule) => void
  onRemove?: (() => void) | undefined
}) {
  const fam = family(field.kind)
  const ops = OPS[fam]
  const [op, setOp] = useState<FilterOp>(rule?.op ?? (ops[0] as FilterOp))
  const [value, setValue] = useState(String(rule?.value ?? ''))
  const [value2, setValue2] = useState(String(rule?.value2 ?? ''))
  const [values, setValues] = useState<string[]>(rule?.values ?? [])
  const need = needs(op)
  const read = (v: string) => (fam === 'number' || op === 'next_days' ? Number(v) : v)
  const kind = op === 'next_days' || fam === 'number' ? 'number' : fam === 'date' ? 'date' : 'text'
  const counts = new Map<string, number>()
  for (const r of rows) {
    const v = show(field, r.values[field.slug], names)
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  const ready =
    need === 0 ||
    (need === 'list'
      ? values.length > 0
      : value.trim() !== '' && (need === 1 || value2.trim() !== ''))
  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    onSave({
      field: field.id,
      op,
      ...(need === 1 || need === 2 ? { value: read(value) } : {}),
      ...(need === 2 ? { value2: read(value2) } : {}),
      ...(need === 'list' ? { values } : {}),
    })
  }
  return (
    <form onSubmit={save} className="flex w-68 flex-col gap-2 p-1.5">
      <div className="font-medium text-ink">{field.name}</div>
      <Select value={op} onChange={(e) => setOp(e.target.value as FilterOp)} aria-label="How">
        {ops.map((o) => (
          <option key={o} value={o}>
            {o === 'in' ? 'is any of' : OP_WORDS[o]}
          </option>
        ))}
      </Select>
      {(need === 1 || need === 2) && (
        <div className="flex items-center gap-2">
          <Field
            autoFocus
            type={kind}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label={need === 2 ? 'From' : 'Value'}
          />
          {need === 2 && (
            <>
              <span className="text-ink-3">and</span>
              <Field
                type={kind}
                value={value2}
                onChange={(e) => setValue2(e.target.value)}
                aria-label="To"
              />
            </>
          )}
          {op === 'next_days' && <span className="text-ink-3">days</span>}
        </div>
      )}
      {need === 'list' && (
        <div className="flex max-h-60 flex-col overflow-y-auto">
          {field.choices.map((c) => (
            <label
              key={c}
              className="flex h-7.5 items-center gap-2 rounded-sm px-1.5 hover:bg-hover"
            >
              <input
                type="checkbox"
                className="accent-accent"
                checked={values.includes(c)}
                onChange={(e) =>
                  setValues((vs) => (e.target.checked ? [...vs, c] : vs.filter((x) => x !== c)))
                }
              />
              <span className="min-w-0 flex-1 truncate text-ink">{c}</span>
              <span className="text-ink-3 text-sm tabular-nums">{counts.get(c) ?? 0}</span>
            </label>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="primary" disabled={!ready}>
          Apply
        </Button>
        {onRemove && (
          <Button size="sm" variant="ghost" onClick={onRemove}>
            Clear the filter
          </Button>
        )}
      </div>
    </form>
  )
}

// Colours for a column: rows tinted by a choice's colours, or a value coloured when it meets one
// condition.
function ColourEditor({
  field,
  config,
  onSave,
}: {
  field: FieldView
  config: ViewConfig
  onSave: (c: ViewConfig) => void
}) {
  const fam = family(field.kind)
  const was = config.colours.when.find((w) => w.field === field.id)
  const [op, setOp] = useState<'gt' | 'lt' | 'eq' | 'before' | 'after'>(
    was?.op ?? (fam === 'date' ? 'before' : 'gt'),
  )
  const [value, setValue] = useState(String(was?.value ?? ''))
  const [tone, setTone] = useState<Tone>(was?.tone ?? 'bad')
  if (field.kind === 'choice')
    return (
      <div className="flex flex-col">
        <MenuItem
          checked={config.colours.tint === field.id}
          onClick={() =>
            onSave(setTint(config, config.colours.tint === field.id ? null : field.id))
          }
        >
          Tint rows by its colours
        </MenuItem>
      </div>
    )
  const ops = fam === 'date' ? (['before', 'after'] as const) : (['gt', 'lt', 'eq'] as const)
  return (
    <form
      className="flex w-68 flex-col gap-2 p-1.5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!value.trim()) return
        onSave(
          setWhen(config, field.id, { op, value: fam === 'date' ? value : Number(value), tone }),
        )
      }}
    >
      <div className="font-medium text-ink">Colour {field.name} when it is</div>
      <div className="flex items-center gap-2">
        <Select value={op} onChange={(e) => setOp(e.target.value as typeof op)} aria-label="When">
          {ops.map((o) => (
            <option key={o} value={o}>
              {OP_WORDS[o]}
            </option>
          ))}
        </Select>
        <Field
          type={fam === 'date' ? 'date' : 'number'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Value"
        />
      </div>
      <Select value={tone} onChange={(e) => setTone(e.target.value as Tone)} aria-label="Colour">
        {(Object.keys(TONE_WORDS) as Tone[]).map((t) => (
          <option key={t} value={t}>
            {TONE_WORDS[t]}
          </option>
        ))}
      </Select>
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="primary" disabled={!value.trim()}>
          Apply
        </Button>
        {was && (
          <Button size="sm" variant="ghost" onClick={() => onSave(setWhen(config, field.id, null))}>
            No colour
          </Button>
        )}
      </div>
    </form>
  )
}

export type { TotalOp }

// The person's own sentence on what a field means: theirs from then on, so a kit's update or
// Alpha's guess never writes over it (the semantic layer, 24 Oct).
function AboutEditor({
  tableId,
  field,
  onDone,
}: {
  tableId: string
  field: FieldView
  onDone: () => void
}) {
  const [about, setAbout] = useState(field.about ?? '')
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setProblem(null)
    try {
      await api.post(`/api/tables/${tableId}/about`, {
        field: field.id,
        about: about.trim() || null,
      })
      onDone()
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'The sentence was not kept.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={save} className="flex w-72 flex-col gap-2 p-3">
      <label className="text-ink-2 text-sm" htmlFor={`about-${field.id}`}>
        What {field.name} means, in a sentence
      </label>
      <textarea
        id={`about-${field.id}`}
        value={about}
        onChange={(e) => setAbout(e.target.value)}
        rows={3}
        maxLength={300}
        className="rounded-sm border border-line bg-surface px-2 py-1.5 text-md text-ink outline-none focus:border-accent"
      />
      {problem && <div className="text-bad text-sm">{problem}</div>}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Leave it
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? 'Keeping…' : 'Keep'}
        </Button>
      </div>
    </form>
  )
}
