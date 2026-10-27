// Acting on many rows: the ticked rows' bar (set a field on all of them, delete them, untick),
// and a paste waiting for the person's yes.
import type { FieldView, RowView } from '@alpha/core/api'
import { ClipboardPaste } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Button } from '../ui/button.tsx'
import { Confirm } from '../ui/dialog.tsx'
import { Field, Select } from '../ui/field.tsx'
import { Popover } from '../ui/popover.tsx'
import type { PastePlan } from './Grid.tsx'
import { useGoes } from './goes.ts'
import { TagPicker } from './Tags.tsx'
import { canType, isTags, readValue } from './values.ts'

export function TickedBar({
  tableId,
  rows,
  fields,
  onSet,
  onRemove,
  onClear,
}: {
  tableId: string
  rows: RowView[]
  fields: FieldView[]
  onSet: (field: FieldView, value: unknown) => Promise<boolean>
  onRemove: () => Promise<boolean>
  onClear: () => void
}) {
  const [setting, setSetting] = useState(false)
  const [removing, setRemoving] = useState(false)
  const goes = useGoes(tableId, removing ? rows.map((r) => r.id) : null)
  const setAnchor = useRef<HTMLButtonElement>(null)
  // rows holding a value the person typed: removing them is removing their own word
  const theirs = rows.filter((r) => Object.values(r.sources).some((s) => s?.kind === 'stated'))
  const n = rows.length
  // Escape lets go of the ticked rows, unless it is closing a menu or a dialog, or leaving a box
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (
        e.key !== 'Escape' ||
        e.defaultPrevented ||
        t.closest('input, textarea, select, [contenteditable=true]') ||
        document.querySelector('[data-popover], dialog[open]')
      )
        return
      e.preventDefault() // used here: the screen's own Escape leaves it
      onClear()
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClear])
  return (
    <div className="flex items-center gap-2 rounded-md bg-accent-soft py-0.5 pr-1 pl-3 text-accent text-md">
      <span className="font-medium">{n} selected</span>
      <Button ref={setAnchor} size="sm" variant="ghost" onClick={() => setSetting((o) => !o)}>
        Set…
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setRemoving(true)}>
        Delete
      </Button>
      <Button size="sm" variant="ghost" title="Escape" onClick={onClear}>
        Cancel
      </Button>
      <Popover anchor={setAnchor} open={setting} onClose={() => setSetting(false)}>
        <SetForm
          fields={fields.filter((f) => canType(f))}
          count={n}
          onSet={async (f, v) => {
            if (await onSet(f, v)) setSetting(false)
          }}
        />
      </Popover>
      <Confirm
        open={removing}
        title={`Delete ${n === 1 ? 'this row' : `these ${n} rows`}?`}
        yes={`Delete ${n === 1 ? 'it' : 'them'}`}
        onYes={async () => {
          if (await onRemove()) setRemoving(false)
        }}
        onClose={() => setRemoving(false)}
      >
        {theirs.length > 0 &&
          `${theirs.length === n ? (n === 1 ? 'It holds' : 'They hold') : `${theirs.length} of them hold`} values you typed. `}
        {goes}
      </Confirm>
    </div>
  )
}

function SetForm({
  fields,
  count,
  onSet,
}: {
  fields: FieldView[]
  count: number
  onSet: (f: FieldView, value: unknown) => void
}) {
  const [slug, setSlug] = useState(fields[0]?.slug ?? '')
  const [typed, setTyped] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const field = fields.find((f) => f.slug === slug)
  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!field) return
    const read = readValue(field, typed)
    if ('problem' in read) return setProblem(read.problem)
    onSet(field, read.value)
  }
  return (
    <form onSubmit={save} className="flex w-68 flex-col gap-2 p-1.5">
      <div className="font-medium text-ink">
        Set a field on {count} row{count === 1 ? '' : 's'}
      </div>
      <Select
        value={slug}
        onChange={(e) => {
          setSlug(e.target.value)
          setTyped('')
          setProblem(null)
        }}
        aria-label="Which field"
      >
        {fields.map((f) => (
          <option key={f.id} value={f.slug}>
            {f.name}
          </option>
        ))}
      </Select>
      {field && isTags(field) ? (
        <TagPicker field={field} typed={typed} onTyped={setTyped} />
      ) : field?.kind === 'choice' ? (
        <Select
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          aria-label="The value to set"
        >
          <option value="">Empty</option>
          {field.choices.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      ) : (
        <Field
          value={typed}
          type={field?.kind === 'date' ? 'date' : 'text'}
          placeholder="Empty clears it"
          aria-label="The value to set"
          onChange={(e) => {
            setTyped(e.target.value)
            setProblem(null)
          }}
        />
      )}
      {problem && <div className="text-bad text-sm">{problem}</div>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="primary" disabled={!field}>
          Set it, as yours
        </Button>
      </div>
    </form>
  )
}

export function PasteBar({
  plan,
  onYes,
  onNo,
}: {
  plan: PastePlan
  onYes: () => void
  onNo: () => void
}) {
  const cells = [...plan.set, ...plan.add].reduce((n, r) => n + Object.keys(r.values).length, 0)
  const ready = cells > 0 && plan.problems.length === 0
  return (
    <div className="mx-7 mb-2 flex flex-wrap items-center gap-2 rounded-md border border-accent-line bg-accent-soft px-3 py-2 text-md">
      <ClipboardPaste className="size-4 text-accent" />
      <span className="min-w-0 flex-1 text-ink">
        {plan.problems.length > 0
          ? `This paste can’t go in: ${plan.problems.slice(0, 2).join(' ')}${plan.problems.length > 2 ? ` And ${plan.problems.length - 2} more.` : ''}`
          : `${plan.fill ? 'Fill' : 'Paste'} ${cells} value${cells === 1 ? '' : 's'} into ${plan.set.length} row${plan.set.length === 1 ? '' : 's'}${plan.add.length ? `, and add ${plan.add.length} new row${plan.add.length === 1 ? '' : 's'}` : ''}? Each value will be yours.`}
        {plan.skipped.length > 0 &&
          ` ${plan.skipped.join(', ')} ${plan.skipped.length === 1 ? 'is' : 'are'} set by asking Alpha, so ${plan.skipped.length === 1 ? 'it is' : 'they are'} left out.`}
      </span>
      {ready && (
        <Button size="sm" variant="primary" onClick={onYes}>
          {plan.fill ? 'Fill' : 'Paste'}
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={onNo}>
        {ready ? 'Cancel' : 'Close'}
      </Button>
    </div>
  )
}
