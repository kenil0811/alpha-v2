// A value changed in place, in the grid and in an opened row (T4): typed, a choice, tags from a
// tick list (T15), or a related row or a person picked (Batch B, 14b; Pick.tsx). Out of Grid.tsx
// so that screen only shrinks (the window file wall).
import type { FieldView } from '@alpha/core/api'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { cn } from '../ui/cn.ts'
import { Popover } from '../ui/popover.tsx'
import { PickCell } from './Pick.tsx'
import { TagChips, TagPicker } from './Tags.tsx'
import { canPick, isTags, NUMERIC, readValue, typedOf } from './values.ts'

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
  const anchor = useRef<HTMLSpanElement>(null)
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
  // a related row or a person: picked from a list, never typed
  if (canPick(field)) return <PickCell field={field} value={value} box={box} onDone={onDone} />
  // tags: a tick list under the cell, saved when it closes
  if (isTags(field))
    return (
      <>
        <span ref={anchor} className={cn(box, 'flex items-center')} title={problem ?? undefined}>
          <TagChips field={field} value={typed.split(',').map((x) => x.trim())} />
        </span>
        <Popover anchor={anchor} open onClose={() => void save()}>
          {/* Escape leaves it as it was, as in every other cell; a click away keeps the ticks */}
          <TagPicker field={field} typed={typed} onTyped={setTyped} onKeyDown={key} />
        </Popover>
      </>
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
